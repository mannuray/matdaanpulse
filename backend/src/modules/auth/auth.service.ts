import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { user_role } from '@prisma/client';
import { InvalidCredentialsException, UserAlreadyExistsException } from '../../common/exceptions';

/**
 * Pre-computed bcrypt hash (cost 10) of a random throwaway string. Compared
 * against when the user does not exist so that login latency does not reveal
 * whether an email is registered.
 */
export const DUMMY_PASSWORD_HASH = '$2b$10$meKI5us.UV9ER7O6E8iuxuIHR4GMLNwVm7G1W.IIUVc5/37njCIJy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.users.findUnique({ where: { email } });
    // Always run a bcrypt comparison (against a dummy hash if the user is
    // missing) to keep response timing independent of user existence.
    const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!user) {
      this.logger.warn('Failed login attempt: unknown user');
      throw new InvalidCredentialsException();
    }
    if (!valid) {
      this.logger.warn(`Failed login attempt: incorrect password [user=${user.id}]`);
      throw new InvalidCredentialsException();
    }
    
    this.logger.log(`User logged in [user=${user.id}] [${user.role}]`);
    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { access_token: token, user: { id: user.id, email: user.email, role: user.role, name: user.name } };
  }

  async register(email: string, password: string, name: string, role: user_role = 'VIEWER') {
    const existing = await this.prisma.users.findUnique({ where: { email } });
    if (existing) {
      throw new UserAlreadyExistsException(email);
    }
    const password_hash = await bcrypt.hash(password, 10);
    const user = await this.prisma.users.create({
      data: { email, password_hash, name, role }
    });
    
    this.logger.log(`New user registered [user=${user.id}] [${role}]`);
    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { access_token: token, user: { id: user.id, email: user.email, role: user.role, name: user.name } };
  }
}
