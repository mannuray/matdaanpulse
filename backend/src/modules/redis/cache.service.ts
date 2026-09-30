import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { StatusService } from '../status/status.service';
import { RateLimitedLog } from '../../common/util/rate-limited-log';

/** Cache TTLs (seconds). */
export const CACHE_TTL = {
  ELECTION_SUMMARY: 300,
  VOTE_SHARE: 300,
  FULL_RESULTS: 300,
  PUBLIC_ANALYSIS: 600,
  /** Versioned live snapshots never change; the TTL only bounds Redis memory. */
  RESULTS_SNAPSHOT: 600,
} as const;

/** Delay before the single background retry of a failed invalidation. */
export const INVALIDATION_RETRY_MS = 2_000;

/**
 * Cache-aside over Redis that never lets Redis take a request down: any
 * get/set/parse failure falls back to the loader (the database). Failures are
 * logged at most once a minute.
 *
 * Single-flight: concurrent getOrSet calls for the same key share one Redis
 * read and one loader call (one DB query per key, not one per request).
 * An invalidation (del/delByPattern) detaches in-flight loads, so callers that
 * arrive after it start a fresh load, and a load that started before it does
 * not write its (possibly stale) value back to Redis.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly logGate = new RateLimitedLog(60_000);
  private readonly inFlight = new Map<string, Promise<unknown>>();
  /** Bumped by every invalidation; a load only writes back if it is unchanged. */
  private generation = 0;

  constructor(
    private readonly redis: RedisService,
    private readonly status: StatusService,
  ) {}

  getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;
    const promise = this.load(key, ttlSeconds, loader).finally(() => {
      if (this.inFlight.get(key) === promise) this.inFlight.delete(key);
    });
    this.inFlight.set(key, promise);
    return promise;
  }

  private async load<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const generation = this.generation;
    let cached: string | null = null;
    try {
      cached = await this.redis.get(key);
    } catch (err) {
      this.warn('read', err);
    }
    if (cached !== null && cached !== undefined) {
      try {
        const value = JSON.parse(cached) as T;
        this.status.recordCacheHit();
        return value;
      } catch (err) {
        this.warn('parse', err);
      }
    }

    this.status.recordCacheMiss();
    const value = await loader();
    if (generation !== this.generation) return value; // invalidated while loading: don't cache it
    try {
      await this.redis.set(key, JSON.stringify(value), ttlSeconds);
    } catch (err) {
      this.warn('write', err);
    }
    return value;
  }

  /**
   * Delete one key. Never throws: on failure it logs a warning and retries once
   * in the background (the write it follows is already committed). Resolves
   * whether the first attempt succeeded.
   */
  del(key: string): Promise<boolean> {
    return this.invalidate(key, () => this.redis.del(key));
  }

  /** Delete keys matching a pattern; same failure handling as del(). */
  delByPattern(pattern: string): Promise<boolean> {
    return this.invalidate(pattern, () => this.redis.delByPattern(pattern));
  }

  private async invalidate(target: string, op: () => Promise<void>): Promise<boolean> {
    this.generation++;
    this.inFlight.clear();
    try {
      await op();
      return true;
    } catch (err) {
      this.logger.warn(`Cache invalidation of ${target} failed, retrying once in ${INVALIDATION_RETRY_MS}ms: ${(err as Error).message}`);
      const timer = setTimeout(() => {
        op().then(
          () => this.logger.log(`Cache invalidation of ${target} succeeded on retry`),
          (e: Error) =>
            this.logger.warn(`Cache invalidation retry of ${target} failed; entries expire with their TTL: ${e.message}`),
        );
      }, INVALIDATION_RETRY_MS);
      timer.unref?.();
      return false;
    }
  }

  private warn(op: string, err: unknown) {
    this.status.recordCacheFallback();
    if (this.logGate.shouldLog('cache')) {
      this.logger.warn(`Redis cache ${op} failed, using the database (logged once a minute): ${(err as Error).message}`);
    }
  }
}
