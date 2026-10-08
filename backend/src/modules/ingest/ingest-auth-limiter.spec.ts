import { IngestAuthLimiter, readAuthFailLimit } from './ingest-auth-limiter';

describe('IngestAuthLimiter', () => {
  it('blocks an IP after N failed key checks within a minute, then frees it when the window ends', () => {
    const l = new IngestAuthLimiter(3);
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) { expect(l.blocked('1.1.1.1', t0)).toBe(false); l.fail('1.1.1.1', t0 + i); }
    expect(l.blocked('1.1.1.1', t0 + 10)).toBe(true);
    expect(l.retryAfterS('1.1.1.1', t0 + 10)).toBe(60);
    expect(l.blocked('2.2.2.2', t0 + 10)).toBe(false); // per IP
    expect(l.blocked('1.1.1.1', t0 + 60_000)).toBe(false);
  });

  it('keeps at most maxEntries IPs (a spray of addresses cannot grow memory without bound)', () => {
    const l = new IngestAuthLimiter(3, 100);
    for (let i = 0; i < 1000; i++) l.fail(`10.0.${i >> 8}.${i & 255}`, 1_000);
    expect(l.size).toBeLessThanOrEqual(100);
  });

  it('reads INGEST_AUTH_FAIL_LIMIT (default 10)', () => {
    expect(readAuthFailLimit({})).toBe(10);
    expect(readAuthFailLimit({ INGEST_AUTH_FAIL_LIMIT: '25' })).toBe(25);
    expect(readAuthFailLimit({ INGEST_AUTH_FAIL_LIMIT: 'x' })).toBe(10);
  });
});
