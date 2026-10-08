import { Inject, Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import type { KeyValueStore } from './redis.ports';
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
 * An invalidation (del/delByPattern) detaches the in-flight loads of the keys it
 * matches — callers that arrive after it start a fresh load, and a load that
 * started before it does not write its (possibly stale) value back. Other keys
 * (e.g. another election's) are untouched. Content-addressed keys (ending in
 * `:v<version>`) never change meaning, so they are never detached or skipped.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly logGate = new RateLimitedLog(60_000);
  private readonly inFlight = new Map<string, Promise<unknown>>();
  /** Monotonic counter; loads remember it at start, invalidations stamp it on what they match. */
  private seq = 0;
  private readonly invalidatedKeys = new Map<string, number>();
  private readonly invalidatedPrefixes = new Map<string, number>();

  constructor(
    @Inject(RedisService) private readonly redis: KeyValueStore,
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
    const startedAt = this.seq;
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
    if (this.invalidatedSince(key, startedAt)) return value; // invalidated while loading: don't cache it
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
    this.markInvalidated(target);
    try {
      await op();
      return true;
    } catch (err) {
      // Redis down fails every invalidation (two per ingest batch): one line a minute each for failures and retries.
      if (this.logGate.shouldLog('invalidate')) {
        this.logger.warn(`Cache invalidation of ${target} failed, retrying once in ${INVALIDATION_RETRY_MS}ms (logged once a minute): ${(err as Error).message}`);
      }
      const timer = setTimeout(() => {
        op().then(
          () => undefined,
          (e: Error) => {
            if (this.logGate.shouldLog('invalidate-retry')) {
              this.logger.warn(`Cache invalidation retry of ${target} failed; entries expire with their TTL (logged once a minute): ${e.message}`);
            }
          },
        );
      }, INVALIDATION_RETRY_MS);
      timer.unref?.();
      return false;
    }
  }

  /** `election:1:*` → prefix `election:1:`; a plain key matches only itself. */
  private markInvalidated(target: string) {
    const stamp = ++this.seq;
    const star = target.indexOf('*');
    const matches =
      star >= 0
        ? (setBounded(this.invalidatedPrefixes, target.slice(0, star), stamp), (k: string) => k.startsWith(target.slice(0, star)))
        : (setBounded(this.invalidatedKeys, target, stamp), (k: string) => k === target);
    for (const key of [...this.inFlight.keys()]) {
      if (matches(key) && !isContentAddressed(key)) this.inFlight.delete(key);
    }
  }

  private invalidatedSince(key: string, startedAt: number): boolean {
    if (isContentAddressed(key)) return false;
    if ((this.invalidatedKeys.get(key) ?? 0) > startedAt) return true;
    for (const [prefix, stamp] of this.invalidatedPrefixes) {
      if (stamp > startedAt && key.startsWith(prefix)) return true;
    }
    return false;
  }

  private warn(op: string, err: unknown) {
    this.status.recordCacheFallback();
    if (this.logGate.shouldLog('cache')) {
      this.logger.warn(`Redis cache ${op} failed, using the database (logged once a minute): ${(err as Error).message}`);
    }
  }
}

const MAX_INVALIDATION_MARKS = 1000;

/** Records a stamp, most recent last, dropping the oldest marks beyond the cap (the maps must not grow forever). */
function setBounded(map: Map<string, number>, key: string, stamp: number) {
  map.delete(key);
  map.set(key, stamp);
  while (map.size > MAX_INVALIDATION_MARKS) map.delete(map.keys().next().value as string);
}

/** Keys ending in `:v<version>` hold data for one immutable version. */
export function isContentAddressed(key: string): boolean {
  return /:v\d+$/.test(key);
}
