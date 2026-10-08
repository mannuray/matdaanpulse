import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { MetricsService } from '../metrics/metrics.service';
import { buildRedisConnection } from './redis-options';
import { RateLimitedLog } from '../../common/util/rate-limited-log';
import type { KeyValueStore, OwnedLockStore, PubSub, RedisHealth, RedisLifecycle } from './redis.ports';
import type { CounterStore, ThrottleHit } from '../../common/throttle/rate-limit-counters';

interface ChannelState {
  subject: Subject<string>;
  refCount: number;
}

const ENV_KEYS = ['REDIS_URL', 'REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'] as const;

@Injectable()
export class RedisService implements OnModuleInit, KeyValueStore, PubSub, OwnedLockStore, RedisHealth, RedisLifecycle, CounterStore {
  private readonly logger = new Logger(RedisService.name);
  private readonly logGate = new RateLimitedLog(60_000);
  private pub: Redis;
  private sub: Redis;
  private readonly channels = new Map<string, ChannelState>();
  // Replays to late subscribers: an SSE request racing SIGTERM ends immediately.
  private readonly shutdownSubject = new ReplaySubject<void>(1);
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
          this.logger.error(`Redis ${name} error (logged once a minute): ${err.message || (err as NodeJS.ErrnoException).code || err.name}`);
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
    // ioredis only resubscribes channels whose SUBSCRIBE reply it saw. A SUBSCRIBE
    // that failed during an outage would leave the channel deaf forever (viewers
    // keep sharing the stream and receiving heartbeats), so on every (re)connect
    // re-issue SUBSCRIBE for every channel we serve. Idempotent in Redis.
    this.sub.on('ready', () => this.resubscribeAll());
    for (const [name, client] of [['pub', this.pub], ['sub', this.sub]] as const) {
      client.connect().catch((err: Error) => {
        this.logger.warn(`Redis ${name} not reachable at boot, retrying in the background: ${err.message}`);
      });
    }
  }

  private resubscribeAll() {
    if (this.closed || this.channels.size === 0) return;
    const channels = [...this.channels.keys()];
    this.sub.subscribe(...channels).catch((err: Error) => {
      this.logger.error(`Resubscribe of ${channels.length} channel(s) failed: ${err.message}`);
    });
  }

  /** True when the subscriber connection is up (live SSE events can flow). */
  isSubscriberReady(): boolean {
    return this.sub.status === 'ready';
  }

  /** Connection states for the admin status page (no hostnames). */
  connectionStates(): { pubReady: boolean; subReady: boolean } {
    return { pubReady: this.pub.status === 'ready', subReady: this.sub.status === 'ready' };
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

  /** True when the command connection is up. `pub` has no offline queue, so callers check this to fail fast. */
  isPubReady(): boolean {
    return this.pub.status === 'ready';
  }

  /**
   * Take or refresh an owned key atomically. The value is JSON with a `user_id`.
   * Returns null on success, otherwise the current holder's value.
   */
  async acquireOwned(key: string, owner: string, value: string, ttlSeconds: number): Promise<string | null> {
    const script = `
      local cur = redis.call('GET', KEYS[1])
      if cur then
        local ok, parsed = pcall(cjson.decode, cur)
        if not ok or parsed.user_id ~= ARGV[1] then return cur end
      end
      redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
      return false`;
    const res = await this.pub.eval(script, 1, key, owner, value, String(ttlSeconds));
    return typeof res === 'string' ? res : null;
  }

  /** Delete an owned key only if `owner` still holds it. */
  async releaseOwned(key: string, owner: string): Promise<boolean> {
    const script = `
      local cur = redis.call('GET', KEYS[1])
      if not cur then return 0 end
      local ok, parsed = pcall(cjson.decode, cur)
      if ok and parsed.user_id == ARGV[1] then return redis.call('DEL', KEYS[1]) end
      return 0`;
    return (await this.pub.eval(script, 1, key, owner)) === 1;
  }

  /**
   * One throttler hit (fixed window). KEYS: hit counter, block flag (one hash tag, so one slot). Returns
   * [hits, window ms left, block ms left]; while blocked the hit is not counted.
   */
  async throttleHit(key: string, ttlMs: number, limit: number, blockMs: number): Promise<ThrottleHit> {
    const script = `
      local blocked = redis.call('PTTL', KEYS[2])
      if blocked > 0 then
        return { tonumber(redis.call('GET', KEYS[1]) or '0'), math.max(redis.call('PTTL', KEYS[1]), 0), blocked }
      end
      local hits = redis.call('INCR', KEYS[1])
      local ttl = redis.call('PTTL', KEYS[1])
      if hits == 1 or ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
      if hits > tonumber(ARGV[2]) then
        redis.call('SET', KEYS[2], '1', 'PX', ARGV[3])
        return { hits, ttl, tonumber(ARGV[3]) }
      end
      return { hits, ttl, 0 }`;
    const [hits, ttl, block] = (await this.pub.eval(script, 2, `${key}:hits`, `${key}:block`, String(ttlMs), String(limit), String(blockMs))) as number[];
    return { hits: Number(hits), ttlMs: Number(ttl), blockMs: Number(block) };
  }

  /** +1 on a counter that expires `windowMs` after its first hit; the `extendAt`-th hit resets its expiry to `extendMs`. */
  async incrCounter(key: string, windowMs: number, extendAt: number, extendMs: number): Promise<number> {
    const script = `
      local n = redis.call('INCR', KEYS[1])
      if n == tonumber(ARGV[2]) then redis.call('PEXPIRE', KEYS[1], ARGV[3])
      elseif n == 1 or redis.call('PTTL', KEYS[1]) < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
      return n`;
    return Number(await this.pub.eval(script, 1, key, String(windowMs), String(extendAt), String(extendMs)));
  }

  async getCounter(key: string): Promise<number> {
    return Number((await this.pub.get(key)) ?? 0) || 0;
  }

  async delCounter(key: string): Promise<void> {
    await this.pub.del(key);
  }

  /** Overwrite a key (take-over) and return what was there. */
  async forceSet(key: string, value: string, ttlSeconds: number): Promise<string | null> {
    const prev = await this.pub.get(key);
    await this.pub.set(key, value, 'EX', ttlSeconds);
    return prev;
  }

  /** Values of every key matching `pattern` (SCAN, never KEYS). */
  async getMany(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.pub.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length === 0) return [];
    const values = await this.pub.mget(...keys);
    return values.filter((v): v is string => typeof v === 'string');
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
