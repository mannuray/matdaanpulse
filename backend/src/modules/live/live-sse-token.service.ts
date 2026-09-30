import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/** Scope claim of SSE tokens; JwtStrategy rejects any scoped token as a Bearer credential. */
export const LIVE_SSE_SCOPE = 'live-sse';
export const LIVE_SSE_TOKEN_TTL_S = 300;

interface SseClaims {
  sub: string;
  scope: typeof LIVE_SSE_SCOPE;
  election_id: string;
}

/**
 * Short-lived, single-purpose tokens for the admin live SSE stream. EventSource
 * cannot send an Authorization header, so the token travels as `?token=` (the
 * logging middleware redacts it). It only opens the stream of one election.
 */
@Injectable()
export class LiveSseTokenService {
  constructor(private readonly jwt: JwtService) {}

  issue(userId: string, electionId: string): { token: string; expiresInSeconds: number } {
    const claims: SseClaims = { sub: userId, scope: LIVE_SSE_SCOPE, election_id: electionId };
    return { token: this.jwt.sign(claims, { expiresIn: LIVE_SSE_TOKEN_TTL_S }), expiresInSeconds: LIVE_SSE_TOKEN_TTL_S };
  }

  /** Throws 401 unless the token is valid, unexpired, SSE-scoped and for this election. */
  verify(token: string | undefined, electionId: string): void {
    let claims: Partial<SseClaims>;
    try {
      claims = this.jwt.verify<SseClaims>(token ?? '');
    } catch {
      throw new UnauthorizedException('Invalid or expired live stream token');
    }
    if (claims.scope !== LIVE_SSE_SCOPE || claims.election_id !== electionId) {
      throw new UnauthorizedException('Invalid or expired live stream token');
    }
  }
}
