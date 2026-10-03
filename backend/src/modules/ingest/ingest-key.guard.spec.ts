import { IngestKeyGuard } from './ingest-key.guard';
import { IngestUnauthorizedException } from '../../common/exceptions';

const ctx = (auth?: string) => {
  const req: any = { headers: auth ? { authorization: auth } : {} };
  return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any };
};

describe('IngestKeyGuard', () => {
  it('attaches the key row for a valid Bearer key', async () => {
    const keys: any = { verify: jest.fn(async () => ({ id: 'k1', name: 'w' })) };
    const { req, ctx: c } = ctx('Bearer mpk_x');
    await expect(new IngestKeyGuard(keys).canActivate(c)).resolves.toBe(true);
    expect(keys.verify).toHaveBeenCalledWith('mpk_x');
    expect(req.ingestKey).toEqual({ id: 'k1', name: 'w' });
  });
  it('401 without a header, with a non-Bearer header or an unknown key', async () => {
    const keys: any = { verify: jest.fn(async () => null) };
    for (const a of [undefined, 'Basic x', 'Bearer mpk_bad'])
      await expect(new IngestKeyGuard(keys).canActivate(ctx(a).ctx)).rejects.toBeInstanceOf(IngestUnauthorizedException);
  });
});
