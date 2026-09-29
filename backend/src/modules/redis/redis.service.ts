import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';

interface ChannelState {
  subject: Subject<string>;
  refCount: number;
}

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private pub: Redis;
  private sub: Redis;
  private readonly channels = new Map<string, ChannelState>();

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    const host = this.config.get('REDIS_HOST', 'localhost');
    const port = this.config.get<number>('REDIS_PORT', 6379);
    this.pub = new Redis({ host, port, lazyConnect: true });
    this.sub = new Redis({ host, port, lazyConnect: true });

    this.pub.on('error', (err) => this.logger.error(`Redis pub error: ${err.message}`));
    this.pub.on('close', () => this.logger.warn('Redis pub connection closed, reconnecting...'));
    this.sub.on('error', (err) => this.logger.error(`Redis sub error: ${err.message}`));
    this.sub.on('close', () => this.logger.warn('Redis sub connection closed, reconnecting...'));
  }

  async onModuleInit() {
    await this.pub.connect();
    this.logger.log('Redis pub connected');
    await this.sub.connect();
    this.logger.log('Redis sub connected');

    this.sub.on('message', (channel: string, message: string) => {
      const state = this.channels.get(channel);
      if (state) state.subject.next(message);
    });
  }

  async onModuleDestroy() {
    this.channels.forEach((s) => s.subject.complete());
    this.channels.clear();
    await this.pub.quit();
    await this.sub.quit();
    this.logger.log('Redis disconnected');
  }

  async get(key: string): Promise<string | null> {
    return this.pub.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.pub.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.pub.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.pub.del(key);
  }

  async delByPattern(pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [next, keys] = await this.pub.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length > 0) await this.pub.del(...keys);
    } while (cursor !== '0');
  }

  async publish(channel: string, data: unknown): Promise<void> {
    let serialized: string;
    try {
      serialized = JSON.stringify(data);
    } catch (err) {
      this.logger.error(`Failed to serialize message for ${channel}: ${(err as Error).message}`);
      return;
    }
    const start = performance.now();
    try {
      await this.pub.publish(channel, serialized);
      this.metrics.eventsPublished.add(1, { channel });
    } catch (err) {
      this.metrics.redisPublishErrors.add(1, { channel });
      this.logger.error(`Redis publish failed on ${channel}: ${(err as Error).message}`);
      throw err;
    } finally {
      this.metrics.redisPublishDuration.record(performance.now() - start, {
        channel,
      });
    }
  }

  /**
   * Cold observable over a Redis pub/sub channel. The underlying subject and
   * Redis SUBSCRIBE are created lazily per subscription (not at call time), so a
   * downstream `share()` that resets after the last subscriber leaves gets a
   * fresh subject on re-subscription instead of an already-completed one.
   */
  subscribe(channel: string): Observable<string> {
    return new Observable<string>((subscriber) => {
      let state = this.channels.get(channel);
      if (!state) {
        state = { subject: new Subject<string>(), refCount: 0 };
        this.channels.set(channel, state);
        this.sub.subscribe(channel).catch((err) => {
          this.logger.error(`Failed to subscribe to ${channel}: ${err.message}`);
        });
      }
      const captured = state;
      captured.refCount++;
      const inner = captured.subject.subscribe(subscriber);

      return () => {
        inner.unsubscribe();
        // Only touch the state we incremented; a newer state for the same
        // channel may exist if this teardown runs late.
        if (this.channels.get(channel) !== captured) return;
        captured.refCount--;
        if (captured.refCount <= 0) {
          this.channels.delete(channel);
          captured.subject.complete();
          this.sub.unsubscribe(channel).catch((err) => {
            this.logger.error(`Failed to unsubscribe from ${channel}: ${err.message}`);
          });
        }
      };
    });
  }
}
