import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

type Env = Record<string, string | undefined>;

export const DEFAULT_CORS_ORIGINS = [
  'http://localhost:3080',
  'http://localhost:3081',
  'http://127.0.0.1:3080',
  'http://127.0.0.1:3081',
];

/**
 * CORS_ORIGINS: comma-separated exact origins (whitespace tolerated).
 * CORS_ORIGIN_REGEX: optional extra pattern, e.g. Vercel previews
 *   ^https://election-tracker-[a-z0-9-]+\.vercel\.app$
 *   It must be anchored (^…$): an unanchored pattern would also match
 *   lookalikes such as https://election-tracker-x.vercel.app.evil.com.
 * No credentials: both SPAs authenticate with a Bearer header, not cookies.
 */
export function buildCorsOptions(env: Env): CorsOptions {
  const list = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origins: (string | RegExp)[] = list.length ? list : [...DEFAULT_CORS_ORIGINS];

  const pattern = env.CORS_ORIGIN_REGEX?.trim();
  if (pattern) {
    if (!pattern.startsWith('^') || !pattern.endsWith('$')) {
      throw new Error(`CORS_ORIGIN_REGEX must be anchored with ^ and $: ${pattern}`);
    }
    try {
      origins.push(new RegExp(pattern));
    } catch {
      throw new Error(`CORS_ORIGIN_REGEX is not a valid regular expression: ${pattern}`);
    }
  }

  return {
    origin: origins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: false,
    // Readable by browser JS: the poller honours Retry-After; error reports show the request id.
    exposedHeaders: ['Retry-After', 'X-Request-ID'],
    // Cache preflights (Chrome caps this at 2 h) so admin calls don't double their requests.
    maxAge: 7200,
  };
}

/** Admin and auth routes keep the exact-origin allowlist for every method. */
const PRIVATE_PATH_RE = /^\/api\/v1\/(admin|auth)(\/|\?|$)/;

/** A GET/HEAD outside admin/auth: public data the CDN may cache and serve to any site. */
export function isPublicRead(req: { method?: string; originalUrl?: string; url?: string }): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  return !PRIVATE_PATH_RE.test(req.originalUrl ?? req.url ?? '');
}

type CorsDelegate = (req: any, cb: (err: Error | null, options: CorsOptions) => void) => void;

/**
 * Per-request CORS options. Public reads answer `Access-Control-Allow-Origin: *`:
 * the CDN caches one copy per URL and does not vary on Origin, so a reflected
 * origin cached for app.<domain> would break admin.<domain> (and vice versa).
 * Safe because no request uses cookies (credentials: false) and the data is public.
 * Everything else (admin, auth, writes, preflights) keeps the allowlist.
 */
export function buildCorsDelegate(env: Env): CorsDelegate {
  const strict = buildCorsOptions(env);
  const open: CorsOptions = { ...strict, origin: '*' };
  return (req, cb) => cb(null, isPublicRead(req) ? open : strict);
}
