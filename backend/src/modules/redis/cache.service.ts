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

  /** Delete one key; returns false (and logs) instead of throwing. */
  async del(key: string): Promise<boolean> {
    try {
      await this.redis.del(key);
      return true;
    } catch (err) {
      this.warn('delete', err);
      return false;
    }
  }

  /** Delete keys matching a pattern; returns false (and logs) instead of throwing. */
  async delByPattern(pattern: string): Promise<boolean> {
    try {
      await this.redis.delByPattern(pattern);
      return true;
    } catch (err) {
      this.warn('delete', err);
      return false;
    }
  }

  private warn(op: string, err: unknown) {
    if (this.logGate.shouldLog('cache')) {
      this.logger.warn(`Redis cache ${op} failed, using the database (logged once a minute): ${(err as Error).message}`);
    }
  }
}
