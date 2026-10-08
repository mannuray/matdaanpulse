import type { ConfigService } from '@nestjs/config';
import type { JwtModuleOptions } from '@nestjs/jwt';

/** The only algorithm tokens are signed and accepted with. */
export const JWT_ALGORITHM = 'HS256' as const;
/** HS256 wants at least 256 bits of key; shorter secrets are brute-forceable offline from any token. */
export const MIN_JWT_SECRET_LENGTH = 32;

/**
 * JWT_SECRET, required. Startup fails when it is missing, or shorter than 32 chars outside the test env
 * (NODE_ENV=test, which Jest sets).
 */
export function readJwtSecret(config: ConfigService): string {
  const secret = config.getOrThrow<string>('JWT_SECRET');
  if (secret.length < MIN_JWT_SECRET_LENGTH && config.get<string>('NODE_ENV') !== 'test') {
    throw new Error(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }
  return secret;
}

/** JwtModule options: HS256 pinned for signing and for JwtService.verify (the live SSE token). */
export function jwtModuleOptions(config: ConfigService): JwtModuleOptions {
  return {
    secret: readJwtSecret(config),
    signOptions: { algorithm: JWT_ALGORITHM, expiresIn: '24h' },
    verifyOptions: { algorithms: [JWT_ALGORITHM] },
  };
}
