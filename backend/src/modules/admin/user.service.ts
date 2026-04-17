import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { user_role } from '@prisma/client';
import { UserNotFoundException } from '../../common/exceptions';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.users.findMany({
      select: { id: true, email: true, name: true, role: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
  }

  async create(data: { email: string; password: string; name: string; role: user_role }) {
    const password_hash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.users.create({
      data: { email: data.email, password_hash, name: data.name, role: data.role },
      select: { id: true, email: true, name: true, role: true }
    });
    return user;
  }

  async update(id: string, data: Partial<{ email: string; name: string; role: user_role }>) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException(id);
    
    const updated = await this.prisma.users.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true }
    });
    return updated;
  }

  async delete(id: string) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException(id);
    await this.prisma.users.delete({ where: { id } });
    return { deleted: true };
  }
}
