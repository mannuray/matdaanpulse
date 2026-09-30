import { createHash, timingSafeEqual } from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { trustCfConnectingIp } from './client-ip';

type Env = Record<string, string | undefined>;

/** Set by a Cloudflare Transform Rule ("Modify request header → Set static"), never by browsers. */
export const ORIGIN_SECRET_HEADER = 'x-origin-secret';

/** The only route reachable without the secret: Render's own health checker calls the service directly. */
const EXEMPT_PATH = '/api/v1/health/live';

/** ORIGIN_SHARED_SECRETS: comma-separated (current first, previous during rotation). Empty → shield off. */
export function parseOriginSecrets(env: Env): string[] {
  return (env.ORIGIN_SHARED_SECRETS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * CF-Connecting-IP (like X-Forwarded-For) can be forged by anyone who reaches
 * the origin directly, so trusting it requires the origin shield.
 */
export function assertOriginConfig(env: Env): void {
  if (trustCfConnectingIp(env) && parseOriginSecrets(env).length === 0) {
    throw new Error('TRUST_CF_CONNECTING_IP=true requires ORIGIN_SHARED_SECRETS (origin shield), see docs/DEPLOYMENT.md §5.4');
  }
}

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time match against every configured secret (hashing equalises lengths). */
export function matchesOriginSecret(value: unknown, secrets: string[]): boolean {
  if (typeof value !== 'string' || value.length === 0) return false;
  const given = digest(value);
  let ok = false;
  for (const secret of secrets) ok = timingSafeEqual(given, digest(secret)) || ok;
  return ok;
}

/**
 * Origin shield: every request must carry X-Origin-Secret (added by Cloudflare),
 * else 403 before any other work (body parsing, CORS, throttling, handlers).
 * GET/HEAD /api/v1/health/live is exempt. The header is removed after the check
 * so logs, traces and error reports never see it.
 */
export function originShield(secrets: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
    const exempt = (req.method === 'GET' || req.method === 'HEAD') && path === EXEMPT_PATH;
    const ok = matchesOriginSecret(req.headers[ORIGIN_SECRET_HEADER], secrets);
    delete req.headers[ORIGIN_SECRET_HEADER];
    if (ok || exempt) return next();
    res.status(403).setHeader('Cache-Control', 'no-store');
    res.json({ success: false, error: { code: 'AUTH_1004', message: 'Forbidden' } });
  };
}
