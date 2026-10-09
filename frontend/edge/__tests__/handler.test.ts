import { describe, it, expect, vi } from 'vitest';
import { handle, type Deps, type Env } from '../handler';
import { BASE, apiFrom, constituency, election, seatAnalysis, E_ID } from '../seo/__tests__/fixtures';

const SHELL = '<!doctype html><html lang="en"><head><title>MatdaanPulse</title></head><body><div id="root"></div></body></html>';
const SEAT = `/election/${E_ID}/constituency/BR-123`;
const routes = {
  [`/elections/${E_ID}`]: election,
  [`/elections/${E_ID}/constituencies/BR-123`]: constituency,
  [`/elections/${E_ID}/constituencies/BR-123/analysis`]: seatAnalysis,
  '/elections': [election],
};

function memoryCache() {
  const store = new Map<string, Response>();
  return {
    store,
    match: vi.fn(async (req: Request) => store.get(req.url)?.clone()),
    put: vi.fn(async (req: Request, res: Response) => { store.set(req.url, res.clone()); }),
  };
}

function setup(over: Partial<Deps> = {}, env: Partial<Env> = {}) {
  const waits: Promise<unknown>[] = [];
  const cache = memoryCache();
  const assets = vi.fn(async () => new Response(SHELL, { headers: { 'Content-Type': 'text/html' } }));
  const run = async (url: string, method = 'GET') => {
    const res = await handle(
      { request: new Request(url, { method }), env: { ASSETS: { fetch: assets }, SEO_API_BASE_URL: BASE, CF_PAGES_COMMIT_SHA: 'abc', ...env }, waitUntil: p => { waits.push(p); } },
      { fetchImpl: apiFrom(routes), cache, timeoutMs: 50, ...over },
    );
    await Promise.all(waits);
    return res;
  };
  return { run, cache, assets };
}

describe('handle', () => {
  it('serves the shell with page tags and content, security headers, no-cache', async () => {
    const { run, cache } = setup();
    const res = await run(`https://matdaanpulse.in${SEAT}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'self'");
    expect(res.headers.get('X-Robots-Tag')).toBeNull();
    expect(html).toContain('<title>Hajipur Assembly Election Result 2025');
    expect(html).toContain('<div id="root"><main');
    const stored = [...cache.store.values()][0];
    expect(stored.headers.get('Cache-Control')).toBe('public, max-age=86400');
  });

  it('answers a repeat from the edge cache without calling the API', async () => {
    const fetchImpl = vi.fn(apiFrom(routes));
    const { run } = setup({ fetchImpl });
    await run(`https://matdaanpulse.in${SEAT}`);
    const calls = fetchImpl.mock.calls.length;
    const res = await run(`https://matdaanpulse.in${SEAT}`);
    expect(fetchImpl.mock.calls.length).toBe(calls);
    expect(res.headers.get('Cache-Control')).toBe('no-cache');
    expect(await res.text()).toContain('Hajipur');
  });

  it('tracking params and URL variants share one cache entry', async () => {
    const fetchImpl = vi.fn(apiFrom(routes));
    const { run } = setup({ fetchImpl });
    await run(`https://matdaanpulse.in${SEAT}?fbclid=abc`);
    const calls = fetchImpl.mock.calls.length;
    await run(`https://matdaanpulse.in${SEAT}/?utm_source=whatsapp`);
    await run(`https://matdaanpulse.in/election/${E_ID.toUpperCase()}/constituency/BR-123`);
    expect(fetchImpl.mock.calls.length).toBe(calls);
  });

  it('non-canonical hosts are noindex', async () => {
    const res = await setup().run(`https://matdaanpulse.pages.dev${SEAT}`);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(await res.text()).toContain(`<link rel="canonical" href="https://matdaanpulse.in${SEAT}" />`);
  });

  it('unknown id: 404 with noindex', async () => {
    const res = await setup().run(`https://matdaanpulse.in/person/99999999-9999-4999-8999-999999999999`);
    expect(res.status).toBe(404);
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(await res.text()).toContain('<meta name="robots" content="noindex" />');
  });

  it('API timeout: generic page fast, cached for at most 30 s', async () => {
    const hang = ((_: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal!.reason));
    })) as typeof fetch;
    const { run, cache } = setup({ fetchImpl: hang, timeoutMs: 20 });
    const res = await run(`https://matdaanpulse.in${SEAT}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>MatdaanPulse — Live Indian election results');
    expect([...cache.store.values()][0].headers.get('Cache-Control')).toBe('public, max-age=30');
  });

  it('serves sitemaps as XML; a sitemap API failure is a 503, not cached', async () => {
    const ok = await setup().run('https://matdaanpulse.in/sitemap.xml');
    expect(ok.headers.get('Content-Type')).toBe('application/xml; charset=utf-8');
    expect(await ok.text()).toContain('<sitemapindex');
    const failing = setup({ fetchImpl: (async () => new Response('{}', { status: 500 })) as typeof fetch });
    const bad = await failing.run('https://matdaanpulse.in/sitemap.xml');
    expect(bad.status).toBe(503);
    expect(failing.cache.put).not.toHaveBeenCalled();
  });

  it('without SEO_API_BASE_URL every page falls back', async () => {
    const res = await setup({}, { SEO_API_BASE_URL: undefined }).run(`https://matdaanpulse.in${SEAT}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('<title>MatdaanPulse — Live Indian election results');
  });

  it('non-GET requests go straight to the static assets', async () => {
    const { run, assets } = setup();
    await run('https://matdaanpulse.in/', 'POST');
    expect(assets).toHaveBeenCalledTimes(1);
  });

  it('HEAD has headers and no body', async () => {
    const res = await setup().run(`https://matdaanpulse.in${SEAT}`, 'HEAD');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });
});
