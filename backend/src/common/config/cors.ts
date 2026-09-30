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
  };
}
