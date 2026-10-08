import { Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RateLimitedLog } from '../util/rate-limited-log';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

export interface ThrottleHit { hits: number; ttlMs: number; blockMs: number }

/**
 * Rate-limit counters (throttler storage, failed-login lockout). RedisService implements it, so counts are shared
 * by every instance; MemoryCounters is the per-process fallback while Redis is down.
 */
export interface CounterStore {
  isPubReady(): boolean;
  /** One hit in a fixed window of `ttlMs`; past `limit` the key is blocked for `blockMs` (hits are not counted while blocked). */
  throttleHit(key: string, ttlMs: number, limit: number, blockMs: number): Promise<ThrottleHit>;
  /** +1 on a counter that expires `windowMs` after its first hit; reaching `extendAt` resets its expiry to `extendMs`. */
  incrCounter(key: string, windowMs: number, extendAt: number, extendMs: number): Promise<number>;
  getCounter(key: string): Promise<number>;
  delCounter(key: string): Promise<void>;
}

interface Entry { count: number; expiresAt: number; blockedUntil: number }

/** In-process counters with the same semantics as the Redis scripts. Bounded: the oldest keys go first. */
export class MemoryCounters {
  private readonly map = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now, private readonly maxKeys = 50_000) {}

  get size() { return this.map.size; }

  private live(key: string): Entry | undefined {
    const e = this.map.get(key);
    if (e && e.expiresAt <= this.now() && e.blockedUntil <= this.now()) {
      this.map.delete(key);
      return undefined;
    }
    return e;
  }

  private put(key: string, e: Entry) {
    this.map.delete(key);
    this.map.set(key, e);
    while (this.map.size > this.maxKeys) this.map.delete(this.map.keys().next().value as string);
  }

  throttleHit(key: string, ttlMs: number, limit: number, blockMs: number): ThrottleHit {
    const now = this.now();
    let e = this.live(key);
    if (e && e.blockedUntil > now) return { hits: e.count, ttlMs: Math.max(0, e.expiresAt - now), blockMs: e.blockedUntil - now };
    if (!e || e.expiresAt <= now) e = { count: 0, expiresAt: now + ttlMs, blockedUntil: 0 };
    e.count++;
    if (e.count > limit) e.blockedUntil = now + blockMs;
    this.put(key, e);
    return { hits: e.count, ttlMs: e.expiresAt - now, blockMs: e.count > limit ? blockMs : 0 };
  }

  incrCounter(key: string, windowMs: number, extendAt: number, extendMs: number): number {
    const now = this.now();
    const e = this.live(key) ?? { count: 0, expiresAt: now + windowMs, blockedUntil: 0 };
    e.count++;
    if (e.count === extendAt) e.expiresAt = now + extendMs;
    this.put(key, e);
    return e.count;
  }

  getCounter(key: string): number {
    return this.live(key)?.count ?? 0;
  }

  del(key: string): void {
    this.map.delete(key);
  }
}

/** Redis when its connection is ready, else (or when a call fails) the in-process fallback. Never throws. */
export class RateLimitCounters {
  private readonly logger = new Logger('RateLimitCounters');
  private readonly logGate = new RateLimitedLog(60_000);

  constructor(private readonly redis: CounterStore, private readonly memory = new MemoryCounters()) {}

  private async use<T>(what: string, viaRedis: () => Promise<T>, viaMemory: () => T): Promise<T> {
    if (!this.redis.isPubReady()) return viaMemory();
    try {
      return await viaRedis();
    } catch (err) {
      if (this.logGate.shouldLog(what)) this.logger.warn(`Redis ${what} failed, using in-process counters (logged once a minute): ${(err as Error).message}`);
      return viaMemory();
    }
  }

  throttleHit(key: string, ttlMs: number, limit: number, blockMs: number): Promise<ThrottleHit> {
    return this.use('throttle', () => this.redis.throttleHit(key, ttlMs, limit, blockMs), () => this.memory.throttleHit(key, ttlMs, limit, blockMs));
  }

  incrCounter(key: string, windowMs: number, extendAt: number, extendMs: number): Promise<number> {
    return this.use('counter', () => this.redis.incrCounter(key, windowMs, extendAt, extendMs), () => this.memory.incrCounter(key, windowMs, extendAt, extendMs));
  }

  getCounter(key: string): Promise<number> {
    return this.use('counter', () => this.redis.getCounter(key), () => this.memory.getCounter(key));
  }

  /** Clears both stores, so a count kept in memory during an outage does not outlive a success. */
  async delCounter(key: string): Promise<void> {
    this.memory.del(key);
    await this.use('counter', () => this.redis.delCounter(key), () => undefined);
  }
}

/**
 * @nestjs/throttler storage on RateLimitCounters: one count per (throttler, tracker) across all instances while
 * Redis is up, per instance while it is down. The key carries a hash tag so the hit and block keys share a slot.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly counters: RateLimitCounters) {}

  async increment(key: string, ttl: number, limit: number, blockDuration: number, throttlerName: string): Promise<ThrottlerStorageRecord> {
    const hit = await this.counters.throttleHit(`throttle:{${throttlerName}:${key}}`, ttl, limit, blockDuration);
    return {
      totalHits: hit.hits,
      timeToExpire: Math.ceil(hit.ttlMs / 1000),
      isBlocked: hit.blockMs > 0,
      timeToBlockExpire: Math.ceil(hit.blockMs / 1000),
    };
  }
}
