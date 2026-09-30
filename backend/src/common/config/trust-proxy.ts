type Env = Record<string, string | undefined>;

/**
 * Number of reverse-proxy hops in front of the app (Render: 1 by default).
 * Always a number, never `true`: trusting every X-Forwarded-For entry would let
 * clients spoof their IP and bypass the per-IP rate limit.
 */
export function resolveTrustProxyHops(env: Env): number {
  const raw = env.TRUST_PROXY_HOPS?.trim();
  if (!raw) return 1;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : 1;
}
