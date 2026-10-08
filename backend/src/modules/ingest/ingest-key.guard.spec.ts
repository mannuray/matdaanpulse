import { IngestKeyGuard } from './ingest-key.guard';
import { IngestKeyExpiredException, IngestKeyScopeException, IngestUnauthorizedException } from '../../common/exceptions';

const KEY = `mpk_${'A'.repeat(43)}`;
const EID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ctx = (auth?: string, electionId = EID) => {
  const req: any = { headers: auth ? { authorization: auth } : {}, params: { electionId }, ip: '10.0.0.1' };
  return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any };
};
const row = (over: Record<string, unknown> = {}) => ({ id: 'k1', name: 'w', election_id: EID, expires_at: new Date(Date.now() + 60_000), ...over });

describe('IngestKeyGuard', () => {
  it('attaches the key row for a valid Bearer key', async () => {
    const keys: any = { verify: jest.fn(async () => row()) };
    const { req, ctx: c } = ctx(`Bearer ${KEY}`);
    await expect(new IngestKeyGuard(keys).canActivate(c)).resolves.toBe(true);
    expect(keys.verify).toHaveBeenCalledWith(KEY);
    expect(req.ingestKey).toMatchObject({ id: 'k1', name: 'w' });
  });
  it('401 without a header, with a non-Bearer header or an unknown key', async () => {
    const keys: any = { verify: jest.fn(async () => null) };
    for (const a of [undefined, 'Basic x', `Bearer ${KEY}`])
      await expect(new IngestKeyGuard(keys).canActivate(ctx(a).ctx)).rejects.toBeInstanceOf(IngestUnauthorizedException);
  });
  it('401 INGEST key expired once expires_at has passed', async () => {
    const keys: any = { verify: jest.fn(async () => row({ expires_at: new Date(Date.now() - 1) })) };
    await expect(new IngestKeyGuard(keys).canActivate(ctx(`Bearer ${KEY}`).ctx)).rejects.toBeInstanceOf(IngestKeyExpiredException);
  });
  it('403 when the key belongs to another election', async () => {
    const keys: any = { verify: jest.fn(async () => row({ election_id: 'c3d4e5f6-a7b8-9012-cdef-234567890abc' })) };
    const err = await new IngestKeyGuard(keys).canActivate(ctx(`Bearer ${KEY}`).ctx).catch(e => e);
    expect(err).toBeInstanceOf(IngestKeyScopeException);
    expect(err.getStatus()).toBe(403);
  });
  it('a legacy key (no election, no expiry) is accepted for any election', async () => {
    const keys: any = { verify: jest.fn(async () => row({ election_id: null, expires_at: null })) };
    await expect(new IngestKeyGuard(keys).canActivate(ctx(`Bearer ${KEY}`, 'any-election').ctx)).resolves.toBe(true);
  });
});
