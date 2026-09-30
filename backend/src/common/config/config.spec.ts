import { buildCorsOptions, buildCorsDelegate, isPublicRead, DEFAULT_CORS_ORIGINS } from './cors';
import { resolveTrustProxyHops } from './trust-proxy';

describe('buildCorsOptions', () => {
  it('trims and drops empty entries', () => {
    const o = buildCorsOptions({ CORS_ORIGINS: ' https://a.vercel.app, https://b.vercel.app ,,' });
    expect(o.origin).toEqual(['https://a.vercel.app', 'https://b.vercel.app']);
  });

  it('falls back to the local dev origins', () => {
    expect(buildCorsOptions({}).origin).toEqual(DEFAULT_CORS_ORIGINS);
    expect(buildCorsOptions({ CORS_ORIGINS: ' , ' }).origin).toEqual(DEFAULT_CORS_ORIGINS);
  });

  it('does not allow credentials (Bearer auth only)', () => {
    expect(buildCorsOptions({}).credentials).toBe(false);
  });

  it('adds CORS_ORIGIN_REGEX as a RegExp', () => {
    const o = buildCorsOptions({ CORS_ORIGINS: 'https://a.app', CORS_ORIGIN_REGEX: '^https://et-[a-z0-9-]+\\.vercel\\.app$' });
    const re = (o.origin as (string | RegExp)[])[1] as RegExp;
    expect(re.test('https://et-git-main-x.vercel.app')).toBe(true);
    expect(re.test('https://evil.app')).toBe(false);
  });

  it('rejects an invalid regex', () => {
    expect(() => buildCorsOptions({ CORS_ORIGIN_REGEX: '^($' })).toThrow(/CORS_ORIGIN_REGEX/);
  });

  it('requires an anchored regex, so lookalike origins cannot match', () => {
    expect(() => buildCorsOptions({ CORS_ORIGIN_REGEX: 'election-tracker-.*\\.vercel\\.app' })).toThrow(/anchored/);
    const o = buildCorsOptions({ CORS_ORIGIN_REGEX: '^https://election-tracker-[a-z0-9-]+\\.vercel\\.app$' });
    const re = (o.origin as (string | RegExp)[]).find((x) => x instanceof RegExp) as RegExp;
    expect(re.test('https://election-tracker-git-main.vercel.app')).toBe(true);
    expect(re.test('https://election-tracker-x.vercel.app.evil.com')).toBe(false);
  });
});

describe('resolveTrustProxyHops', () => {
  it('defaults to 1', () => expect(resolveTrustProxyHops({})).toBe(1));
  it('accepts an integer', () => expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '2' })).toBe(2));
  it('never returns true', () => {
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: 'true' })).toBe(1);
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '-1' })).toBe(1);
    expect(resolveTrustProxyHops({ TRUST_PROXY_HOPS: '1.5' })).toBe(1);
  });
});

describe('CORS for CDN-cached public reads', () => {
  it('exposes Retry-After and X-Request-ID and caches preflights', () => {
    const o = buildCorsOptions({});
    expect(o.exposedHeaders).toEqual(['Retry-After', 'X-Request-ID']);
    expect(o.maxAge).toBe(7200);
  });

  it('public GET/HEAD are open (*); admin/auth and writes keep the allowlist', () => {
    expect(isPublicRead({ method: 'GET', originalUrl: '/api/v1/elections/x/live' })).toBe(true);
    expect(isPublicRead({ method: 'HEAD', originalUrl: '/api/v1/elections' })).toBe(true);
    expect(isPublicRead({ method: 'GET', originalUrl: '/api/v1/admin/status' })).toBe(false);
    expect(isPublicRead({ method: 'GET', originalUrl: '/api/v1/auth/me' })).toBe(false);
    expect(isPublicRead({ method: 'POST', originalUrl: '/api/v1/elections' })).toBe(false);
    expect(isPublicRead({ method: 'OPTIONS', originalUrl: '/api/v1/elections' })).toBe(false);
    expect(isPublicRead({ method: 'GET', originalUrl: '/api/v1/administrators' })).toBe(true);
  });

  it('the delegate picks the options per request', () => {
    const delegate = buildCorsDelegate({ CORS_ORIGINS: 'https://app.x' });
    const pick = (req: object) => new Promise<any>((r) => delegate(req, (_e, o) => r(o)));
    return Promise.all([
      pick({ method: 'GET', originalUrl: '/api/v1/elections' }).then((o) => expect(o.origin).toBe('*')),
      pick({ method: 'PATCH', originalUrl: '/api/v1/admin/results/override' }).then((o) => expect(o.origin).toEqual(['https://app.x'])),
    ]);
  });
});
