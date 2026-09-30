import { isIP } from 'net';
import type { Request, Response, NextFunction } from 'express';

type Env = Record<string, string | undefined>;

/**
 * TRUST_CF_CONNECTING_IP=true: take the client IP from Cloudflare's
 * CF-Connecting-IP header instead of X-Forwarded-For + TRUST_PROXY_HOPS.
 * Only safe when the origin accepts traffic from Cloudflare alone (otherwise
 * anyone can send the header and pick their own rate-limit bucket).
 */
export function trustCfConnectingIp(env: Env): boolean {
  return env.TRUST_CF_CONNECTING_IP?.trim().toLowerCase() === 'true';
}

/**
 * Overrides req.ip (what the throttler and logs key on) with CF-Connecting-IP
 * when it holds a valid IP address; otherwise req.ip stays the X-Forwarded-For
 * result of `trust proxy`.
 */
export function cfConnectingIp(req: Request, _res: Response, next: NextFunction) {
  const raw = req.headers['cf-connecting-ip'];
  const ip = typeof raw === 'string' ? raw.trim() : '';
  if (ip && isIP(ip)) Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true });
  next();
}
