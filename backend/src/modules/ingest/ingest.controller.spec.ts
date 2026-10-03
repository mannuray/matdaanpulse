import { IngestController } from './ingest.controller';
import { IngestNoLeaseException, IngestShardNotFoundException } from '../../common/exceptions';

describe('IngestController.lease', () => {
  const req = { ingestKey: { id: 'k' } };
  it('an unknown shard is a 404 before any claim is attempted', async () => {
    const shards: any = { get: jest.fn(async () => { throw new IngestShardNotFoundException('nope'); }) };
    const leases: any = { claim: jest.fn() };
    const c = new IngestController({} as any, leases, shards);
    await expect(c.lease('e', { shard: 'nope', holder: 'h' }, req)).rejects.toBeInstanceOf(IngestShardNotFoundException);
    expect(leases.claim).not.toHaveBeenCalled();
  });
  it('a held lease is a 409 and a free one returns expires_at', async () => {
    const shards: any = { get: jest.fn(async () => ({})) };
    const exp = new Date();
    const leases: any = { claim: jest.fn().mockResolvedValueOnce({ ok: false, holder: 'x', expires_at: exp }).mockResolvedValueOnce({ ok: true, expires_at: exp }) };
    const c = new IngestController({} as any, leases, shards);
    await expect(c.lease('e', { shard: 'rest', holder: 'h' }, req)).rejects.toBeInstanceOf(IngestNoLeaseException);
    expect(await c.lease('e', { shard: 'rest', holder: 'h' }, req)).toEqual({ expires_at: exp });
  });
});
