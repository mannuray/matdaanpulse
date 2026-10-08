import { JwtService } from '@nestjs/jwt';
import { LiveSseTokenService, LIVE_SSE_TOKEN_TTL_S } from './live-sse-token.service';
import { JwtStrategy } from '../auth/jwt.strategy';

const E1 = 'c3d4e5f6-a7b8-9012-cdef-234567890abc';
const E2 = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

describe('LiveSseTokenService', () => {
  const jwt = new JwtService({ secret: 's' });
  const svc = new LiveSseTokenService(jwt);

  it('issues a 5-minute token scoped to one election', () => {
    const { token, expiresInSeconds } = svc.issue('u1', E1);
    expect(expiresInSeconds).toBe(LIVE_SSE_TOKEN_TTL_S);
    const claims = jwt.decode(token) as Record<string, unknown>;
    expect(claims).toMatchObject({ sub: 'u1', scope: 'live-sse', election_id: E1 });
    expect((claims.exp as number) - (claims.iat as number)).toBe(300);
    expect(() => svc.verify(token, E1)).not.toThrow();
  });

  it('rejects another election, a normal session token, garbage and a missing token', () => {
    const { token } = svc.issue('u1', E1);
    expect(() => svc.verify(token, E2)).toThrow();
    expect(() => svc.verify(jwt.sign({ sub: 'u1', role: 'SUPER_ADMIN' }), E1)).toThrow();
    expect(() => svc.verify('nope', E1)).toThrow();
    expect(() => svc.verify(undefined, E1)).toThrow();
  });

  it('an SSE token is never accepted as a Bearer session credential', async () => {
    const prisma = { users: { findUnique: jest.fn().mockResolvedValue({ id: 'u1', email: 'a', role: 'SUPER_ADMIN', name: 'A' }) } };
    const strategy = new JwtStrategy({ getOrThrow: () => 's', get: () => 'test' } as any, prisma as any);
    await expect(strategy.validate({ sub: 'u1', role: 'SUPER_ADMIN', scope: 'live-sse' })).rejects.toMatchObject({ status: 401 });
    await expect(strategy.validate({ sub: 'u1', role: 'SUPER_ADMIN' })).resolves.toMatchObject({ id: 'u1' });
  });
});

describe('SseConnections cap', () => {
  it('tryAcquire is check-and-increment and release frees a slot', () => {
    const { SseConnections } = require('./live.controller');
    const c = new SseConnections();
    (c as any).max = 2;
    expect([c.tryAcquire(), c.tryAcquire(), c.tryAcquire()]).toEqual([true, true, false]);
    c.release();
    expect(c.tryAcquire()).toBe(true);
    expect(c.open).toBe(2);
  });
});
