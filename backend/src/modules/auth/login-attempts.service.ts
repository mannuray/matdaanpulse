import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { RedisService } from '../redis/redis.service';
import { CounterStore, RateLimitCounters } from '../../common/throttle/rate-limit-counters';

export const DEFAULT_LOGIN_MAX_FAILURES = 10;
export const DEFAULT_LOGIN_LOCK_MINUTES = 15;

const positiveInt = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/** LOGIN_MAX_FAILURES (default 10) failures within LOGIN_LOCK_MINUTES (default 15) lock the email for that long. */
export function loginLockConfig(config: ConfigService): { maxFailures: number; lockMs: number } {
  return {
    maxFailures: positiveInt(config.get<string>('LOGIN_MAX_FAILURES'), DEFAULT_LOGIN_MAX_FAILURES),
    lockMs: positiveInt(config.get<string>('LOGIN_LOCK_MINUTES'), DEFAULT_LOGIN_LOCK_MINUTES) * 60_000,
  };
}

/**
 * Per-email failed-login counter (on top of the per-IP `auth` throttler, which a botnet spreads out). Counts unknown
 * emails too, so a lock reveals nothing. Redis-backed (shared by every instance), in-process while Redis is down;
 * the key is a SHA-256 of the normalised email, so no address is stored in Redis.
 */
@Injectable()
export class LoginAttemptsService {
  private readonly counters: RateLimitCounters;
  private readonly maxFailures: number;
  private readonly lockMs: number;

  constructor(@Inject(RedisService) redis: CounterStore, config: ConfigService) {
    this.counters = new RateLimitCounters(redis);
    ({ maxFailures: this.maxFailures, lockMs: this.lockMs } = loginLockConfig(config));
  }

  private key(email: string): string {
    return `login:fail:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
  }

  async isLocked(email: string): Promise<boolean> {
    return (await this.counters.getCounter(this.key(email))) >= this.maxFailures;
  }

  /** The failure that reaches the limit restarts the window, so the lock lasts the full LOGIN_LOCK_MINUTES. */
  async recordFailure(email: string): Promise<void> {
    await this.counters.incrCounter(this.key(email), this.lockMs, this.maxFailures, this.lockMs);
  }

  async reset(email: string): Promise<void> {
    await this.counters.delCounter(this.key(email));
  }
}
