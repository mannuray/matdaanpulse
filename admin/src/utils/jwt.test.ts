import { describe, it, expect } from 'vitest';
import { isTokenExpired, decodeJwtPayload } from './jwt';

function makeToken(payload: object): string {
  const b64url = (o: object) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.signature`;
}

describe('isTokenExpired', () => {
  const now = 1_700_000_000_000;

  it('treats missing tokens as expired', () => {
    expect(isTokenExpired(null, now)).toBe(true);
    expect(isTokenExpired('', now)).toBe(true);
  });

  it('treats malformed tokens as expired', () => {
    expect(isTokenExpired('not-a-jwt', now)).toBe(true);
    expect(isTokenExpired('a.%%%.c', now)).toBe(true);
  });

  it('returns false for a token expiring in the future', () => {
    expect(isTokenExpired(makeToken({ sub: 'u1', exp: now / 1000 + 60 }), now)).toBe(false);
  });

  it('returns true for a token whose exp has passed', () => {
    expect(isTokenExpired(makeToken({ sub: 'u1', exp: now / 1000 - 1 }), now)).toBe(true);
    expect(isTokenExpired(makeToken({ sub: 'u1', exp: now / 1000 }), now)).toBe(true);
  });

  it('rejects a non-numeric exp claim', () => {
    expect(isTokenExpired(makeToken({ exp: 'soon' }), now)).toBe(true);
  });

  it('decodes payloads containing base64url-specific characters (- and _)', () => {
    const token = makeToken({ name: '??>>', exp: 1 });
    expect(decodeJwtPayload(token)).toEqual({ name: '??>>', exp: 1 });
  });
});
