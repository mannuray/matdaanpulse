import { makeGet, NotFound, seoApi, type SeoApi } from './seo/api';
import { injectIntoShell } from './seo/head';
import { buildPage } from './seo/pages';
import { fallbackPage, notFoundPage, unavailablePage } from './seo/pages/simple';
import { matchRoute, routeKey, type Route } from './seo/routes';
import { SITE_HOST } from './seo/site';
import { buildSitemap, type Sitemap } from './seo/sitemap';
import type { SeoPage } from './seo/types';
import { SECURITY_HEADERS } from './securityHeaders';

export interface Env {
  ASSETS: { fetch(input: Request | string): Promise<Response> };
  /** The API origin + /api/v1 (same value as VITE_API_BASE_URL). Unset: every page gets the generic tags. */
  SEO_API_BASE_URL?: string;
  /** Set by Cloudflare Pages; part of the cache key so a deploy starts a fresh cache. */
  CF_PAGES_COMMIT_SHA?: string;
}
export interface Deps { fetchImpl: typeof fetch; cache: Pick<Cache, 'match' | 'put'> | null; timeoutMs?: number }
interface Ctx { request: Request; env: Env; waitUntil(p: Promise<unknown>): void }

const HTML = 'text/html; charset=utf-8';
const XML = 'application/xml; charset=utf-8';
const isSitemap = (r: Route) => r.kind === 'sitemapIndex' || r.kind === 'sitemapParties' || r.kind === 'sitemapElection';

/** Browsers always revalidate; crawlers on other hosts (previews) never index. */
function finalize(res: Response, canonicalHost: boolean, head: boolean): Response {
  const out = new Response(head ? null : res.body, res);
  out.headers.set('Cache-Control', 'no-cache');
  if (!canonicalHost) out.headers.set('X-Robots-Tag', 'noindex');
  return out;
}

async function page(route: Route, api: SeoApi | null): Promise<SeoPage> {
  if (!api) return fallbackPage();
  try {
    return await buildPage(route, api);
  } catch (err) {
    return err instanceof NotFound ? notFoundPage() : unavailablePage();
  }
}

export async function handle(ctx: Ctx, deps: Deps): Promise<Response> {
  const { request, env } = ctx;
  if (request.method !== 'GET' && request.method !== 'HEAD') return env.ASSETS.fetch(request);
  const head = request.method === 'HEAD';
  const url = new URL(request.url);
  const canonicalHost = url.hostname === SITE_HOST;
  const route = matchRoute(url.pathname, url.search);
  // Keyed on the route, not the raw URL: shared links carry fbclid/utm_* and must still hit one entry.
  const keyPath = routeKey(route);
  const sitemap = isSitemap(route);

  // Pages serves index.html at "/" (a request for /index.html would redirect). A failed shell passes through untouched.
  let shell = '';
  if (!sitemap) {
    const shellRes = await env.ASSETS.fetch(new Request(new URL('/', url)));
    if (!shellRes.ok) return shellRes;
    shell = await shellRes.text();
  }
  // The build's entry-script hash is in the key, so a deploy never serves HTML that names deleted asset files
  // (whether or not CF_PAGES_COMMIT_SHA reaches the Function at runtime).
  const build = `${env.CF_PAGES_COMMIT_SHA ?? 'dev'}-${/\/assets\/([\w.-]+)\.js/.exec(shell)?.[1] ?? 'none'}`;
  const key = new Request(`${url.origin}${keyPath}${keyPath.includes('?') ? '&' : '?'}__seo=${encodeURIComponent(build)}`);

  const hit = deps.cache ? await deps.cache.match(key) : undefined;
  if (hit) return finalize(hit, canonicalHost, head);

  const api = env.SEO_API_BASE_URL
    ? seoApi(makeGet(env.SEO_API_BASE_URL, deps.fetchImpl, AbortSignal.timeout(deps.timeoutMs ?? 2500)))
    : null;

  let body: string;
  let status: number;
  let type: string;
  let ttl: number;
  let noindex = false;
  if (sitemap) {
    if (!api) return finalize(new Response('Not found', { status: 404 }), canonicalHost, head);
    let map: Sitemap | null;
    try {
      map = await buildSitemap(route, api);
    } catch (err) {
      if (!(err instanceof NotFound)) return finalize(new Response('Unavailable', { status: 503, headers: { 'Retry-After': '60' } }), canonicalHost, head);
      map = null;
    }
    if (!map) return finalize(new Response('Not found', { status: 404 }), canonicalHost, head);
    ({ xml: body, ttl } = map);
    status = 200;
    type = XML;
  } else {
    const p = await page(route, api);
    body = injectIntoShell(shell, p);
    ({ status, ttl, noindex } = p);
    type = HTML;
  }

  const headers: Record<string, string> = { ...SECURITY_HEADERS, 'Content-Type': type };
  if (noindex) headers['X-Robots-Tag'] = 'noindex';
  if (status === 503) headers['Retry-After'] = '120';
  if (deps.cache && ttl > 0) {
    const stored = new Response(body, { status, headers: { ...headers, 'Cache-Control': `public, max-age=${ttl}` } });
    ctx.waitUntil(deps.cache.put(key, stored));
  }
  return finalize(new Response(body, { status, headers }), canonicalHost, head);
}

/** Fail open: this sits in front of every page load, so any error serves the plain static SPA instead. */
export async function serve(ctx: Ctx, deps: Deps): Promise<Response> {
  try {
    return await handle(ctx, deps);
  } catch {
    return ctx.env.ASSETS.fetch(ctx.request);
  }
}
