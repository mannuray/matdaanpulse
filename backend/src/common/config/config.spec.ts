import { buildCorsOptions, DEFAULT_CORS_ORIGINS } from './cors';
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
    expect(() => buildCorsOptions({ CORS_ORIGIN_REGEX: '(' })).toThrow(/CORS_ORIGIN_REGEX/);
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
