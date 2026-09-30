import { Controller, Get, Headers, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../../app.setup';
import { assertOriginConfig, matchesOriginSecret, originShield, parseOriginSecrets } from './origin-shield';

@Controller()
class ProbeController {
  @Get('health/live')
  live() {
    return { status: 'ok' };
  }

  @Get('health/ready')
  ready() {
    return { status: 'ok' };
  }

  @Get('echo')
  echo(@Headers() headers: Record<string, string>) {
    return { sawSecret: 'x-origin-secret' in headers };
  }
}

describe('origin shield (ORIGIN_SHARED_SECRETS)', () => {
  let app: INestApplication;
  let base: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
    configureApp(app as NestExpressApplication, { ORIGIN_SHARED_SECRETS: 'new-secret, old-secret' });
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
  });
  afterAll(() => app.close());

  const get = (path: string, secret?: string, method = 'GET') =>
    fetch(`${base}${path}`, { method, headers: secret ? { 'X-Origin-Secret': secret } : {} });

  it('missing or wrong secret → 403 no-store', async () => {
    for (const secret of [undefined, 'wrong', 'new-secret-but-longer']) {
      const res = await get('/echo', secret);
      expect(res.status).toBe(403);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('either rotated secret passes, and handlers never see the header', async () => {
    for (const secret of ['new-secret', 'old-secret']) {
      const res = await get('/echo', secret);
      expect(res.status).toBe(200);
      expect((await res.json()).data.sawSecret).toBe(false);
    }
  });

  it('GET/HEAD /health/live is exempt; /health/ready is not; OPTIONS is checked too', async () => {
    expect((await get('/health/live')).status).toBe(200);
    expect((await get('/health/live', undefined, 'HEAD')).status).toBe(200);
    expect((await get('/health/live?x=1')).status).toBe(200);
    expect((await get('/health/ready')).status).toBe(403);
    expect((await get('/health/live/extra')).status).toBe(403);
    expect((await get('/echo', undefined, 'OPTIONS')).status).toBe(403);
  });
});

describe('origin shield config', () => {
  it('parses a comma list', () => {
    expect(parseOriginSecrets({ ORIGIN_SHARED_SECRETS: ' a , b ,,' })).toEqual(['a', 'b']);
    expect(parseOriginSecrets({})).toEqual([]);
  });

  it('refuses TRUST_CF_CONNECTING_IP=true without a secret', () => {
    expect(() => assertOriginConfig({ TRUST_CF_CONNECTING_IP: 'true' })).toThrow(/ORIGIN_SHARED_SECRETS/);
    expect(() => assertOriginConfig({ TRUST_CF_CONNECTING_IP: 'true', ORIGIN_SHARED_SECRETS: 'x' })).not.toThrow();
    expect(() => assertOriginConfig({})).not.toThrow();
  });

  it('matches in constant time against every secret', () => {
    expect(matchesOriginSecret('b', ['a', 'b'])).toBe(true);
    expect(matchesOriginSecret('c', ['a', 'b'])).toBe(false);
    expect(matchesOriginSecret('', ['a'])).toBe(false);
    expect(matchesOriginSecret(['a'], ['a'])).toBe(false);
  });
});

describe('origin shield rawHeaders scrub', () => {
  it('removes the secret from req.rawHeaders as well as req.headers', () => {
    const req: any = {
      method: 'GET', url: '/x', headers: { 'x-origin-secret': 's', accept: '*/*' },
      rawHeaders: ['Accept', '*/*', 'X-Origin-Secret', 's', 'Host', 'h'],
    };
    const next = jest.fn();
    originShield(['s'])(req, {} as any, next);
    expect(next).toHaveBeenCalled();
    expect(req.rawHeaders).toEqual(['Accept', '*/*', 'Host', 'h']);
    expect(req.headers['x-origin-secret']).toBeUndefined();
  });
});

describe('originShield rejection hook', () => {
  const run = (headers: Record<string, string>, onReject: () => void, url = '/api/v1/elections', method = 'GET') => {
    const res: any = { status: jest.fn().mockReturnThis(), setHeader: jest.fn(), json: jest.fn() };
    const next = jest.fn();
    originShield(['s3cret'], onReject)({ headers, method, originalUrl: url, rawHeaders: [] } as any, res, next);
    return { res, next };
  };

  it('counts a 403 but not an allowed or exempt request, and a throwing hook cannot break the response', () => {
    const onReject = jest.fn();
    expect(run({}, onReject).res.status).toHaveBeenCalledWith(403);
    expect(onReject).toHaveBeenCalledTimes(1);
    expect(run({ 'x-origin-secret': 's3cret' }, onReject).next).toHaveBeenCalled();
    expect(run({}, onReject, '/api/v1/health/live').next).toHaveBeenCalled();
    expect(onReject).toHaveBeenCalledTimes(1);
    const throwing = jest.fn(() => { throw new Error('x'); });
    expect(run({}, throwing).res.status).toHaveBeenCalledWith(403);
  });
});
