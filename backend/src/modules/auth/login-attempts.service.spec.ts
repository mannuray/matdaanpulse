import { LoginAttemptsService, loginLockConfig } from './login-attempts.service';

const downRedis = { isPubReady: () => false } as any;
const config = (env: Record<string, string> = {}) => ({ get: (k: string) => env[k] }) as any;

describe('loginLockConfig (U5)', () => {
  it('defaults to 10 failures / 15 minutes and follows LOGIN_MAX_FAILURES / LOGIN_LOCK_MINUTES', () => {
    expect(loginLockConfig(config())).toEqual({ maxFailures: 10, lockMs: 15 * 60_000 });
    expect(loginLockConfig(config({ LOGIN_MAX_FAILURES: '3', LOGIN_LOCK_MINUTES: '1' }))).toEqual({ maxFailures: 3, lockMs: 60_000 });
    expect(loginLockConfig(config({ LOGIN_MAX_FAILURES: 'x', LOGIN_LOCK_MINUTES: '-1' }))).toEqual({ maxFailures: 10, lockMs: 15 * 60_000 });
  });
});

describe('LoginAttemptsService (U5)', () => {
  it('locks an email after LOGIN_MAX_FAILURES failures, case- and space-insensitively', async () => {
    const svc = new LoginAttemptsService(downRedis, config({ LOGIN_MAX_FAILURES: '3' }));
    for (let i = 0; i < 2; i++) await svc.recordFailure('Admin@X.in');
    await expect(svc.isLocked('admin@x.in')).resolves.toBe(false);
    await svc.recordFailure(' admin@x.in ');
    await expect(svc.isLocked('ADMIN@x.in')).resolves.toBe(true);
    await expect(svc.isLocked('other@x.in')).resolves.toBe(false);
  });

  it('a successful login clears the count', async () => {
    const svc = new LoginAttemptsService(downRedis, config({ LOGIN_MAX_FAILURES: '2' }));
    await svc.recordFailure('a@x.in');
    await svc.reset('a@x.in');
    await svc.recordFailure('a@x.in');
    await expect(svc.isLocked('a@x.in')).resolves.toBe(false);
  });

  it('keys Redis by a hash of the email (no address in Redis) and extends the window at the limit', async () => {
    const redis = { isPubReady: () => true, incrCounter: jest.fn(async () => 1), getCounter: jest.fn(async () => 0), delCounter: jest.fn() };
    const svc = new LoginAttemptsService(redis as any, config());
    await svc.recordFailure('a@x.in');
    const [key, windowMs, extendAt, extendMs] = redis.incrCounter.mock.calls[0] as unknown as [string, number, number, number];
    expect(key).toMatch(/^login:fail:[0-9a-f]{64}$/);
    expect(key).not.toContain('a@x.in');
    expect([windowMs, extendAt, extendMs]).toEqual([15 * 60_000, 10, 15 * 60_000]);
  });
});
