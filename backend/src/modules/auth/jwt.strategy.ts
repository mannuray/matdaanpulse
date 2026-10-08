import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { JWT_ALGORITHM, readJwtSecret } from './jwt-config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: readJwtSecret(config),
      algorithms: [JWT_ALGORITHM],
    });
  }

  async validate(payload: { sub: string; role: string; tv?: number; scope?: string }) {
    // Scoped tokens (e.g. the 5-min live SSE token) are never session credentials.
    if (payload.scope) throw new UnauthorizedException();
    // No version claim = issued before revocation existed (migration 026): refused, the user logs in again.
    if (typeof payload.tv !== 'number') throw new UnauthorizedException();
    const user = await this.prisma.users.findUnique({ where: { id: payload.sub } });
    // A logout or password change bumps token_version, revoking every token issued before it.
    if (!user || user.token_version !== payload.tv) throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role, name: user.name };
  }
}
