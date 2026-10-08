import { HealthController } from './health.controller';

describe('HealthController readiness memo', () => {
  const res = () => ({ status: jest.fn() }) as any;

  it('concurrent and repeated calls within the window share one DB query and one Redis ping', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([1]) } as any;
    const redis = { ping: jest.fn().mockResolvedValue(undefined), isSubscriberReady: () => true } as any;
    const c = new HealthController(prisma, redis, 60_000);
    await Promise.all(Array.from({ length: 20 }, () => c.ready(res())));
    await c.check(res());
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });

  it('with no window every call checks again', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([1]) } as any;
    const redis = { ping: jest.fn().mockResolvedValue(undefined), isSubscriberReady: () => true } as any;
    const c = new HealthController(prisma, redis, 0);
    await c.ready(res());
    await c.ready(res());
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });
});
