import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, Subject } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';
import { buildRedisConnection } from './redis-options';
import { RateLimitedLog } from '../../common/util/rate-limited-log';

interface ChannelState {
  subject: Subject<string>;
  refCount: number;
}

const ENV_KEYS = ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'] as const;

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly logger = new Logger(RedisService.name);
  private readonly logGate = new RateLimitedLog(60_000);
  private pub: Redis;
  private sub: Redis;
  private readonly channels = new Map<string, ChannelState>();
  private readonly shutdownSubject = new Subject<void>();
  private closed = false;

  /** Emits once when the app starts shutting down; SSE streams end on it. */
  readonly shutdown$: Observable<void> = this.shutdownSubject.asObservable();

  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {
    const env: Record<string, string | undefined> = {};
    for (const k of ENV_KEYS) env[k] = this.config.get<string>(k);
    const conn = buildRedisConnection(env);
    this.pub = conn.url ? new Redis(conn.url, conn.pub) : new Redis(conn.pub);
    this.sub = conn.url ? new Redis(conn.url, conn.sub) : new Redis(conn.sub);
    this.logger.log(`Redis target ${conn.description}`);

    for (const [name, client] of [['pub', this.pub], ['sub', this.sub]] as const) {
      client.on('error', (err) => {
        if (this.logGate.shouldLog(`${name}:error`)) {
          this.logger.error(`Redis ${name} error (logged once a minute): ${err.message}`);
        }
      });
      client.on('ready', () => this.logger.log(`Redis ${name} ready`));
    }
  }

  /**
   * Boot never waits for Redis: connect in the background and let ioredis keep
   * retrying. Until it is up, cache calls fall back to the DB (CacheService),
   * publishes are logged and dropped, and /health/ready reports it.
   */
  onModuleInit() {
    this.sub.on('message', (channel: string, message: string) => {
      const state = this.channels.get(channel);
      if (state) state.subject.next(message);
    });
    for (const [name, client] of [['pub', this.pub], ['sub', this.sub]] as const) {
      client.connect().catch((err: Error) => {
        this.logger.warn(`Redis ${name} not reachable at boot, retrying in the background: ${err.message}`);
      });
    }
  }

  /** Step 1 of shutdown: end every SSE stream so the HTTP server can close. */
  completeStreams() {
    this.shutdownSubject.next();
    this.shutdownSubject.complete();
    // Clear first so subscriber teardowns skip UNSUBSCRIBE on a closing connection.
    const states = [...this.channels.values()];
    this.channels.clear();
    states.forEach((s) => s.subject.complete());
  }

  /** Step 2 of shutdown (after the HTTP server closed): close both connections. */
  async close() {
    if (this.closed) return;
    this.closed = true;
    await Promise.all(
      [this.pub, this.sub].map((c) =>
        c.status === 'ready' ? c.quit().catch(() => c.disconnect()) : Promise.resolve(c.disconnect()),
      ),
    );
    this.logger.log('Redis disconnected');
  }

  /** PING with a hard timeout; throws on failure or timeout. */
  async ping(timeoutMs = 2000): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Redis PING timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    try {
      await Promise.race([this.pub.ping(), timeout]);
    } finally {
      clearTimeout(timer);
    }
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

  /**
   * Publish to a channel. Never throws: callers publish after a committed DB
   * write, so a Redis failure is logged and counted, not returned to the client.
   * Resolves true when the message was handed to Redis.
   */
  async publish(channel: string, data: unknown): Promise<boolean> {
    let serialized: string;
    try {
      serialized = JSON.stringify(data);
    } catch (err) {
      this.logger.error(`Failed to serialize message for ${channel}: ${(err as Error).message}`);
      return false;
    }
    const start = performance.now();
    try {
      await this.pub.publish(channel, serialized);
      this.metrics.eventsPublished.add(1, { channel });
      return true;
    } catch (err) {
      this.metrics.redisPublishErrors.add(1, { channel });
      this.logger.error(`Redis publish failed on ${channel}: ${(err as Error).message}`);
      return false;
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
