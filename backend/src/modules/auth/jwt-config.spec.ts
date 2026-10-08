import * as jwt from 'jsonwebtoken';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JWT_ALGORITHM, MIN_JWT_SECRET_LENGTH, jwtModuleOptions, readJwtSecret } from './jwt-config';
import { JwtStrategy } from './jwt.strategy';

const config = (env: Record<string, string | undefined>) => ({
  get: (k: string) => env[k],
  getOrThrow: (k: string) => { if (env[k] === undefined) throw new Error(`${k} missing`); return env[k]; },
}) as unknown as ConfigService;

const LONG = 'x'.repeat(MIN_JWT_SECRET_LENGTH);

describe('readJwtSecret (U6)', () => {
  it('throws when JWT_SECRET is missing', () => {
    expect(() => readJwtSecret(config({ NODE_ENV: 'production' }))).toThrow();
  });
  it('refuses a secret shorter than 32 chars outside the test env', () => {
    expect(() => readJwtSecret(config({ JWT_SECRET: 'short', NODE_ENV: 'production' }))).toThrow(/32/);
    expect(() => readJwtSecret(config({ JWT_SECRET: 'short' }))).toThrow(/32/);
  });
  it('accepts a short secret in the test env, and a 32-char secret anywhere', () => {
    expect(readJwtSecret(config({ JWT_SECRET: 'short', NODE_ENV: 'test' }))).toBe('short');
    expect(readJwtSecret(config({ JWT_SECRET: LONG, NODE_ENV: 'production' }))).toBe(LONG);
  });
});

describe('JWT algorithm pinning (U6)', () => {
  const svc = new JwtService(jwtModuleOptions(config({ JWT_SECRET: LONG })));

  it('signs with HS256', () => {
    const token = svc.sign({ sub: 'u1' });
    expect(JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).alg).toBe('HS256');
    expect(JWT_ALGORITHM).toBe('HS256');
  });

  it('module verify rejects a token signed with another HMAC algorithm', () => {
    const hs512 = jwt.sign({ sub: 'u1' }, LONG, { algorithm: 'HS512' });
    expect(() => svc.verify(hs512)).toThrow();
    expect(svc.verify(svc.sign({ sub: 'u1' })).sub).toBe('u1');
  });

  it('the passport strategy accepts only HS256', () => {
    const strategy: any = new JwtStrategy(config({ JWT_SECRET: LONG }), {} as any);
    expect(strategy._verifOpts.algorithms).toEqual(['HS256']);
  });
});
