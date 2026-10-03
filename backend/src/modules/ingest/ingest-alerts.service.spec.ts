import { IngestAlertsService } from './ingest-alerts.service';

describe('IngestAlertsService.tick', () => {
  const alert = { key: 'e:rest:lag', level: 'warn', election_id: 'e', shard: 'rest', message: 'Shard rest is 4 min behind' };
  const make = (alerts: any[]) => {
    const prisma: any = { elections: { findMany: jest.fn(async () => [{ id: 'e', name: 'Assam 2026' }]) } };
    const status: any = { status: jest.fn(async () => ({ alerts })) };
    const post = jest.fn(async () => undefined);
    return { svc: new IngestAlertsService(prisma, status, 'https://hook', post), post };
  };
  it('posts a new alert once, not again within 15 minutes, again after', async () => {
    const { svc, post } = make([alert]);
    const t0 = new Date('2027-02-27T04:30:00Z');
    await svc.tick(t0); await svc.tick(new Date(t0.getTime() + 60_000));
    expect(post).toHaveBeenCalledTimes(1);
    expect((post.mock.calls[0] as any[])[1]).toEqual({ text: '⚠️ Assam 2026 — Shard rest is 4 min behind' });
    await svc.tick(new Date(t0.getTime() + 16 * 60_000));
    expect(post).toHaveBeenCalledTimes(2);
  });
  it('a failed webhook post is retried on the next tick, then not repeated within 15 minutes', async () => {
    const { svc, post } = make([alert]);
    post.mockRejectedValueOnce(new Error('HTTP 500'));
    const t0 = new Date('2027-02-27T04:30:00Z');
    await svc.tick(t0);
    await svc.tick(new Date(t0.getTime() + 60_000));
    await svc.tick(new Date(t0.getTime() + 120_000));
    expect(post).toHaveBeenCalledTimes(2);
  });
  it('the default poster treats a non-2xx webhook response as a failure', async () => {
    const prisma: any = { elections: { findMany: jest.fn(async () => [{ id: 'e', name: 'Assam 2026' }]) } };
    const status: any = { status: jest.fn(async () => ({ alerts: [alert] })) };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response('no', { status: 500 }));
    try {
      const svc = new IngestAlertsService(prisma, status, 'https://hook', undefined);
      const t0 = new Date('2027-02-27T04:30:00Z');
      await svc.tick(t0); await svc.tick(new Date(t0.getTime() + 60_000));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally { fetchMock.mockRestore(); }
  });
  it('without a webhook URL it does nothing', async () => {
    const prisma: any = { elections: { findMany: jest.fn() } };
    const svc = new IngestAlertsService(prisma, {} as any, undefined, jest.fn());
    await svc.tick(new Date());
    expect(prisma.elections.findMany).not.toHaveBeenCalled();
  });
  it('pruneLog deletes rows older than 30 days', async () => {
    const prisma: any = { ingest_log: { deleteMany: jest.fn(async () => ({ count: 3 })) } };
    const svc = new IngestAlertsService(prisma, {} as any, undefined, jest.fn());
    expect(await svc.pruneLog(new Date('2027-03-31T00:00:00Z'))).toBe(3);
    expect(prisma.ingest_log.deleteMany).toHaveBeenCalledWith({ where: { received_at: { lt: new Date('2027-03-01T00:00:00Z') } } });
  });
});
