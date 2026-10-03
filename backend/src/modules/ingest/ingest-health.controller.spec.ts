import { IngestHealthController } from './ingest-health.controller';

describe('IngestHealthController', () => {
  const make = () => {
    const prisma: any = { elections: { findMany: jest.fn(async () => [{ id: 'e' }]) } };
    const status: any = { status: jest.fn(async () => ({ shards: [{ name: 'rest', source: 'eci-web', lease_holder: 'laptop-1', lease_expires_at: null, last_applied_at: null, lag_s: 5,
      rejected: [{ const_id: 'S1', reason: 'roster_mismatch' }], refused: { no_lease: 2, inactive_source: 1 }, tally_mismatch: null }] })) };
    return { ctl: new IngestHealthController(prisma, status), status };
  };
  it('is public-safe: no lease holder, seat ids or reasons — only counts', async () => {
    const { ctl } = make();
    expect(await ctl.memoised(0)).toEqual([{ election_id: 'e', shard: 'rest', source: 'eci-web', lease_expires_at: null, last_applied_at: null, lag_s: 5, rejected_seats: 1, refused_5m: 3, tally_mismatch: false }]);
  });
  it('memoises the response for 10 s', async () => {
    const { ctl, status } = make();
    await ctl.memoised(0); await ctl.memoised(9_999);
    expect(status.status).toHaveBeenCalledTimes(1);
    await ctl.memoised(10_000);
    expect(status.status).toHaveBeenCalledTimes(2);
  });
  it('does not cache a failure', async () => {
    const { ctl, status } = make();
    status.status.mockRejectedValueOnce(new Error('db'));
    await expect(ctl.memoised(0)).rejects.toThrow('db');
    await ctl.memoised(1);
    expect(status.status).toHaveBeenCalledTimes(2);
  });
});
