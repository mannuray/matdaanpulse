import { createHash } from 'crypto';
import { IngestKeysService } from './ingest-keys.service';
import { ElectionNotFoundException, IngestBadRequestException, IngestKeyNameTakenException, IngestKeyNotFoundException } from '../../common/exceptions';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('IngestKeysService', () => {
  const make = () => {
    const rows: any[] = [];
    const prisma: any = { ingest_keys: {
      create: jest.fn(async ({ data }) => { const r = { id: `k${rows.length}`, created_at: new Date(), last_used_at: null, revoked_at: null, ...data }; rows.push(r); return r; }),
      findUnique: jest.fn(async ({ where }) => rows.find(r => r.key_hash === where.key_hash) ?? null),
      update: jest.fn(async ({ where, data }) => Object.assign(rows.find(r => r.id === where.id), data)),
      findMany: jest.fn(async () => rows),
      count: jest.fn(async () => 0),
      updateMany: jest.fn(async ({ where, data }) => { const r = rows.filter(x => x.id === where.id); r.forEach(x => Object.assign(x, data)); return { count: r.length }; }),
    } };
    prisma.elections = { findUnique: jest.fn(async ({ where }) => (where.id === 'missing' ? null : { id: where.id })) };
    return { svc: new IngestKeysService(prisma), prisma, rows };
  };

  it('create returns an mpk_ key once and stores only its sha256', async () => {
    const { svc, rows } = make();
    const { key, row } = await svc.create('laptop', 'u1', { electionId: 'e1' });
    expect(key).toMatch(/^mpk_[A-Za-z0-9_-]{43}$/);
    expect(rows[0].key_hash).toBe(sha(key));
    expect(row).not.toHaveProperty('key_hash');
  });

  it('verify finds a live key, refuses a revoked or unknown one', async () => {
    const { svc } = make();
    const { key, row } = await svc.create('w', null, { electionId: 'e1' });
    expect((await svc.verify(key))?.id).toBe(row.id);
    expect(await svc.verify('mpk_nope')).toBeNull();
    await svc.revoke(row.id);
    expect(await svc.verify(key)).toBeNull();
  });

  it('create scopes the key to its election and expires it after 7 days by default', async () => {
    const { svc, rows } = make();
    const t0 = Date.now();
    const { row } = await svc.create('w', null, { electionId: 'e1' });
    expect(rows[0].election_id).toBe('e1');
    expect(row).toMatchObject({ election_id: 'e1' });
    expect(row.expires_at!.getTime() - t0).toBeGreaterThanOrEqual(7 * 86_400_000 - 1000);
    expect(row.expires_at!.getTime() - t0).toBeLessThanOrEqual(7 * 86_400_000 + 1000);
    const at = new Date(Date.now() + 3 * 86_400_000);
    expect((await svc.create('w2', null, { electionId: 'e1', expiresAt: at })).row.expires_at).toEqual(at);
  });

  it('create refuses an unknown election, a past expiry, an expiry over 90 days and a taken name', async () => {
    const { svc, prisma } = make();
    await expect(svc.create('w', null, { electionId: 'missing' })).rejects.toBeInstanceOf(ElectionNotFoundException);
    await expect(svc.create('w', null, { electionId: 'e1', expiresAt: new Date(Date.now() - 1000) })).rejects.toBeInstanceOf(IngestBadRequestException);
    await expect(svc.create('w', null, { electionId: 'e1', expiresAt: new Date(Date.now() + 91 * 86_400_000) })).rejects.toBeInstanceOf(IngestBadRequestException);
    prisma.ingest_keys.create.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }));
    await expect(svc.create('w', null, { electionId: 'e1' })).rejects.toBeInstanceOf(IngestKeyNameTakenException);
  });

  it('revoking an unknown key is a 404, not a Prisma error', async () => {
    const { svc } = make();
    await expect(svc.revoke('nope')).rejects.toBeInstanceOf(IngestKeyNotFoundException);
  });

  it('touches last_used_at at most once a minute', async () => {
    const { svc, prisma } = make();
    const { key } = await svc.create('w', null, { electionId: 'e1' });
    await svc.verify(key); await svc.verify(key);
    expect(prisma.ingest_keys.update.mock.calls.filter((c: any[]) => c[0].data.last_used_at).length).toBe(1);
  });
});
