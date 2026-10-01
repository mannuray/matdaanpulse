import { SeatLockService, SEAT_LOCK_TTL_SECONDS } from './seat-lock.service';

function make(over: Partial<Record<string, jest.Mock>> = {}, ready = true) {
  const redis = {
    isPubReady: jest.fn(() => ready),
    acquireOwned: jest.fn().mockResolvedValue(null),
    releaseOwned: jest.fn().mockResolvedValue(true),
    forceSet: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    ...over,
  };
  const live = { publish: jest.fn().mockResolvedValue(undefined) };
  const audit = { create: jest.fn().mockResolvedValue({}) };
  const prisma = { constituencies: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) } };
  const svc = new SeatLockService(redis as any, live as any, audit as any, prisma as any);
  return { svc, redis, live, audit, prisma };
}
const me = { id: 'u1', name: 'Mannu K' };

describe('SeatLockService', () => {
  it('acquires a free seat, publishes seat-lock, uses the TTL constant', async () => {
    const { svc, redis, live } = make();
    const lock = await svc.acquire('e1', 'c1', me, false);
    expect(lock).toMatchObject({ const_id: 'c1', user_id: 'u1', user_name: 'Mannu K' });
    expect(redis.acquireOwned).toHaveBeenCalledWith('lock:seat:e1:c1', 'u1', expect.any(String), SEAT_LOCK_TTL_SECONDS);
    expect(live.publish).toHaveBeenCalledWith('e1', { type: 'seat-lock', data: { const_id: 'c1', lock } });
  });

  it('throws SeatLocked (409) with the holder when someone else has it', async () => {
    const holder = { const_id: 'c1', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' };
    const { svc } = make({ acquireOwned: jest.fn().mockResolvedValue(JSON.stringify(holder)) });
    await expect(svc.acquire('e1', 'c1', me, false)).rejects.toMatchObject({ status: 409, details: { lock: holder } });
  });

  it('take-over overwrites, audits old→new, publishes', async () => {
    const holder = { const_id: 'c1', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' };
    const { svc, redis, audit, live } = make({ forceSet: jest.fn().mockResolvedValue(JSON.stringify(holder)) });
    const lock = await svc.acquire('e1', 'c1', me, true);
    expect(redis.forceSet).toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', action: 'SEAT_LOCK_TAKEOVER', entityType: 'constituency', entityId: 'c1', oldValue: holder, newValue: lock,
    }));
    expect(live.publish).toHaveBeenCalled();
  });

  it('rejects a constituency outside the election', async () => {
    const { svc, prisma } = make();
    prisma.constituencies.findFirst.mockResolvedValue(null);
    await expect(svc.acquire('e1', 'cX', me, false)).rejects.toMatchObject({ status: 404 });
  });

  it('release publishes lock:null only when this user held it', async () => {
    const { svc, live, redis } = make();
    await svc.release('e1', 'c1', 'u1');
    expect(live.publish).toHaveBeenCalledWith('e1', { type: 'seat-lock', data: { const_id: 'c1', lock: null } });
    redis.releaseOwned.mockResolvedValue(false);
    live.publish.mockClear();
    await svc.release('e1', 'c1', 'u1');
    expect(live.publish).not.toHaveBeenCalled();
  });

  it('list parses stored locks and skips garbage', async () => {
    const l = { const_id: 'c1', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' };
    const { svc, redis } = make({ getMany: jest.fn().mockResolvedValue([JSON.stringify(l), 'not json']) });
    await expect(svc.list('e1')).resolves.toEqual([l]);
    expect(redis.getMany).toHaveBeenCalledWith('lock:seat:e1:*');
  });

  it('every call fails with 503 when Redis is not ready', async () => {
    const { svc } = make({}, false);
    await expect(svc.list('e1')).rejects.toMatchObject({ status: 503 });
    await expect(svc.acquire('e1', 'c1', me, false)).rejects.toMatchObject({ status: 503 });
    await expect(svc.release('e1', 'c1', 'u1')).rejects.toMatchObject({ status: 503 });
  });
});
