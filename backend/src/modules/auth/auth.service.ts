import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { user_role } from '@prisma/client';
import { InvalidCredentialsException, UserAlreadyExistsException } from '../../common/exceptions';
import { LoginAttemptsService } from './login-attempts.service';

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
    private readonly attempts: LoginAttemptsService,
  ) {}

  async login(email: string, password: string) {
    const locked = await this.attempts.isLocked(email);
    const user = await this.prisma.users.findUnique({ where: { email } });
    // Always run a bcrypt comparison (against a dummy hash if the user is
    // missing) to keep response timing independent of user existence.
    const valid = await bcrypt.compare(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);
    // A locked email (too many failures) gets the same error after the same work, even with the right password.
    if (locked) {
      this.logger.warn(`Login refused: too many failed attempts${user ? ` [user=${user.id}]` : ''}`);
      throw new InvalidCredentialsException();
    }
    if (!user) {
      await this.attempts.recordFailure(email);
      this.logger.warn('Failed login attempt: unknown user');
      throw new InvalidCredentialsException();
    }
    if (!valid) {
      await this.attempts.recordFailure(email);
      this.logger.warn(`Failed login attempt: incorrect password [user=${user.id}]`);
      throw new InvalidCredentialsException();
    }
    await this.attempts.reset(email);
    
    this.logger.log(`User logged in [user=${user.id}] [${user.role}]`);
    const token = this.sessionToken(user);
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
    const token = this.sessionToken(user);
    return { access_token: token, user: { id: user.id, email: user.email, role: user.role, name: user.name } };
  }

  /** Revokes every session token of the user (bumps token_version; JwtStrategy refuses older ones). */
  async logout(userId: string): Promise<void> {
    await this.prisma.users.updateMany({ where: { id: userId }, data: { token_version: { increment: 1 } } });
    this.logger.log(`User logged out, sessions revoked [user=${userId}]`);
  }

  /** A session JWT: `tv` is the user's token_version, checked on every request by JwtStrategy. */
  private sessionToken(user: { id: string; role: user_role; token_version: number }): string {
    return this.jwtService.sign({ sub: user.id, role: user.role, tv: user.token_version });
  }
}
