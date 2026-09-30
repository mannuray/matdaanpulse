import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RateLimitedLog } from '../../common/util/rate-limited-log';

/** Cache TTLs (seconds). */
export const CACHE_TTL = {
  ELECTION_SUMMARY: 300,
  VOTE_SHARE: 300,
  FULL_RESULTS: 300,
  PUBLIC_ANALYSIS: 600,
} as const;

/** Delay before the single background retry of a failed invalidation. */
export const INVALIDATION_RETRY_MS = 2_000;

/**
 * Cache-aside over Redis that never lets Redis take a request down: any
 * get/set/parse failure falls back to the loader (the database). Failures are
 * logged at most once a minute.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly logGate = new RateLimitedLog(60_000);

  constructor(private readonly redis: RedisService) {}

  async getOrSet<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    let cached: string | null = null;
    try {
      cached = await this.redis.get(key);
    } catch (err) {
      this.warn('read', err);
    }
    if (cached !== null && cached !== undefined) {
      try {
        return JSON.parse(cached) as T;
      } catch (err) {
        this.warn('parse', err);
      }
    }

    const value = await loader();
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
    if (this.logGate.shouldLog('cache')) {
      this.logger.warn(`Redis cache ${op} failed, using the database (logged once a minute): ${(err as Error).message}`);
    }
  }
}
