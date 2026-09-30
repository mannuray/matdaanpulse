import { ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';

type Env = Record<string, string | undefined>;

export const THROTTLE_TTL_MS = 60_000;
/** Generous: Indian mobile carriers put many users behind one CGNAT address. */
export const DEFAULT_PUBLIC_PER_MIN = 600;
export const DEFAULT_AUTH_PER_MIN = 5;

/**
 * Use instead of a bare @SkipThrottle(): with named throttlers the bare form
 * only skips a throttler called "default", which does not exist here.
 */
export const SKIP_ALL_THROTTLERS = { public: true, auth: true } as const;

const AUTH_ROUTE_KEY = 'throttle:auth-route';
/** Marks a controller whose routes count against the strict `auth` throttler. */
export const AuthRateLimited = () => SetMetadata(AUTH_ROUTE_KEY, true);

export function isAuthRoute(context: ExecutionContext): boolean {
  return Reflect.getMetadata(AUTH_ROUTE_KEY, context.getClass()) === true
    || Reflect.getMetadata(AUTH_ROUTE_KEY, context.getHandler()) === true;
}

function perMinute(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/**
 * Two named throttlers, both keyed on req.ip (correct only with `trust proxy`
 * set, see main.ts):
 * - public: generous per-IP limit for every route (mobile CGNAT shares IPs);
 * - auth:   strict limit, applied only to @AuthRateLimited() controllers.
 */
export function buildThrottlerOptions(env: Env): ThrottlerModuleOptions {
  return [
    {
      name: 'public',
      ttl: THROTTLE_TTL_MS,
      limit: perMinute(env.THROTTLE_PUBLIC_PER_MIN, DEFAULT_PUBLIC_PER_MIN),
    },
    {
      name: 'auth',
      ttl: THROTTLE_TTL_MS,
      limit: perMinute(env.THROTTLE_AUTH_PER_MIN, DEFAULT_AUTH_PER_MIN),
      skipIf: (context) => !isAuthRoute(context),
    },
  ];
}
