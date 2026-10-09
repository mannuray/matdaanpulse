import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SECURITY_HEADERS } from '../../edge/securityHeaders';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

/** vercel.json's headers for every path. */
function vercelHeaders(): Record<string, string> {
  const cfg = JSON.parse(read('vercel.json')) as { headers?: { source: string; headers: { key: string; value: string }[] }[] };
  const all = (cfg.headers ?? []).find(h => h.source === '/(.*)');
  return Object.fromEntries((all?.headers ?? []).map(h => [h.key, h.value]));
}

/** public/_headers (Cloudflare Pages): the `/*` block, comments skipped. */
function pagesHeaders(): Record<string, string> {
  const out: Record<string, string> = {};
  let inAll = false;
  for (const line of read('public/_headers').split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    if (!/^\s/.test(line)) { inAll = line.trim() === '/*'; continue; }
    if (!inAll) continue;
    const i = line.indexOf(':');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

const directives = (csp: string) => Object.fromEntries(csp.split(';').map(d => d.trim()).filter(Boolean).map(d => {
  const [name, ...values] = d.split(/\s+/);
  return [name, values];
}));

describe('security headers (vercel.json = public/_headers)', () => {
  it('both hosts send the same headers', () => {
    expect(Object.keys(vercelHeaders()).length).toBeGreaterThan(0);
    expect(pagesHeaders()).toEqual(vercelHeaders());
  });

  it('the Pages Function sends the same headers (Pages does not apply _headers to Functions)', () => {
    expect(SECURITY_HEADERS).toEqual(pagesHeaders());
  });

  it('sends the hardening headers; the public site is indexable', () => {
    const h = vercelHeaders();
    expect(h['X-Frame-Options']).toBe('DENY');
    expect(h['X-Content-Type-Options']).toBe('nosniff');
    expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(h['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(h['X-Robots-Tag']).toBeUndefined();
  });

  it('the CSP allows scripts only from self and names the API and the media bucket', () => {
    const d = directives(vercelHeaders()['Content-Security-Policy']);
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['script-src']).toEqual(["'self'"]);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['font-src']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
    expect(d['connect-src']).toContain('https://matdaanpulse-api.onrender.com');
    expect(d['img-src']).toEqual(expect.arrayContaining(["'self'", 'data:', 'https://matdaanpulse-media.s3.ap-south-1.amazonaws.com']));
  });

  it('index.html has nothing the CSP would block: no inline script or handler, no external font or stylesheet', () => {
    const html = read('index.html');
    for (const tag of html.match(/<script\b[^>]*>/g) ?? []) expect(tag).toMatch(/\ssrc=/);
    expect(html).not.toMatch(/<script\b[^>]*>[^<\s]/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
    expect(html).not.toMatch(/https?:\/\//);
  });
});
