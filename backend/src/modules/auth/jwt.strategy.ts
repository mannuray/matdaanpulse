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

  async validate(payload: { sub: string; role: string; scope?: string }) {
    // Scoped tokens (e.g. the 5-min live SSE token) are never session credentials.
    if (payload.scope) throw new UnauthorizedException();
    const user = await this.prisma.users.findUnique({ where: { id: payload.sub } });
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role, name: user.name };
  }
}
