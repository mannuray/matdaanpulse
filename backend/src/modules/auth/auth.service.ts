import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { user_role } from '@prisma/client';
import { InvalidCredentialsException, UserAlreadyExistsException } from '../../common/exceptions';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.users.findUnique({ where: { email } });
    if (!user) {
      this.logger.warn(`Failed login attempt: user not found [${email}]`);
      throw new InvalidCredentialsException();
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      this.logger.warn(`Failed login attempt: incorrect password [${email}]`);
      throw new InvalidCredentialsException();
    }
    
    this.logger.log(`User logged in: ${email} [${user.role}]`);
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
    
    this.logger.log(`New user registered: ${email} [${role}]`);
    const token = this.jwtService.sign({ sub: user.id, role: user.role });
    return { access_token: token, user: { id: user.id, email: user.email, role: user.role, name: user.name } };
  }
}
