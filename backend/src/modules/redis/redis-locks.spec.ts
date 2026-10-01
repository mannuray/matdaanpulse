import { RedisService } from './redis.service';

function makeService(pub: Record<string, unknown>) {
  const config = { get: (_k: string, d: unknown) => d };
  const svc = new RedisService(config as any, {} as any);
  (svc as any).pub = { status: 'ready', ...pub };
  return svc;
}

describe('RedisService lock primitives', () => {
  it('isPubReady reflects the pub connection status', () => {
    expect(makeService({ status: 'ready' }).isPubReady()).toBe(true);
    expect(makeService({ status: 'reconnecting' }).isPubReady()).toBe(false);
  });

  it('acquireOwned returns null when the script reports success', async () => {
    const evalFn = jest.fn().mockResolvedValue(null);
    const svc = makeService({ eval: evalFn });
    await expect(svc.acquireOwned('k', 'u1', '{"user_id":"u1"}', 120)).resolves.toBeNull();
    expect(evalFn).toHaveBeenCalledWith(expect.stringContaining('cjson.decode'), 1, 'k', 'u1', '{"user_id":"u1"}', '120');
  });

  it('acquireOwned returns the holder value when someone else owns it', async () => {
    const svc = makeService({ eval: jest.fn().mockResolvedValue('{"user_id":"u2"}') });
    await expect(svc.acquireOwned('k', 'u1', '{"user_id":"u1"}', 120)).resolves.toBe('{"user_id":"u2"}');
  });

  it('releaseOwned is true only when the script deleted the key', async () => {
    const svc = makeService({ eval: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) });
    await expect(svc.releaseOwned('k', 'u1')).resolves.toBe(true);
    await expect(svc.releaseOwned('k', 'u1')).resolves.toBe(false);
  });

  it('forceSet returns the previous value', async () => {
    const svc = makeService({ get: jest.fn().mockResolvedValue('old'), set: jest.fn().mockResolvedValue('OK') });
    await expect(svc.forceSet('k', 'new', 120)).resolves.toBe('old');
    expect((svc as any).pub.set).toHaveBeenCalledWith('k', 'new', 'EX', 120);
  });

  it('getMany scans the pattern and returns non-null values', async () => {
    const scan = jest.fn().mockResolvedValueOnce(['5', ['a']]).mockResolvedValueOnce(['0', ['b']]);
    const mget = jest.fn().mockResolvedValue(['va', null]);
    const svc = makeService({ scan, mget });
    await expect(svc.getMany('lock:*')).resolves.toEqual(['va']);
    expect(mget).toHaveBeenCalledWith('a', 'b');
  });
});
