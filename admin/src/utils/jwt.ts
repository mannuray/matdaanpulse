/**
 * PURE UTILITY: JWT expiry check (no signature verification — the server does that).
 * Returns true when the token is malformed or its `exp` claim is in the past.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!token) return true;
  const payload = decodeJwtPayload(token);
  if (!payload) return true;
  const exp = payload.exp;
  if (exp === undefined) return false; // no expiry claim: server decides
  if (typeof exp !== 'number' || !Number.isFinite(exp)) return true;
  return exp * 1000 <= nowMs;
}
