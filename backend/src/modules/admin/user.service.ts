import { ForbiddenException, Injectable } from '@nestjs/common';
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

  /** Refuse to remove the last SUPER_ADMIN (demotion or deletion), which would leave no admin. */
  private async assertNotLastSuperAdmin(user: { role: user_role }, action: string) {
    if (user.role !== 'SUPER_ADMIN') return;
    const superAdmins = await this.prisma.users.count({ where: { role: 'SUPER_ADMIN' } });
    if (superAdmins <= 1) {
      throw new ForbiddenException(`Cannot ${action} the last SUPER_ADMIN`);
    }
  }

  async update(id: string, data: Partial<{ email: string; name: string; role: user_role; password: string }>) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException(id);
    if (data.role && data.role !== user.role) await this.assertNotLastSuperAdmin(user, 'demote');

    // Map the DTO onto real columns; `password` is hashed into `password_hash`.
    const { password, ...rest } = data;
    const updated = await this.prisma.users.update({
      where: { id },
      data: {
        ...rest,
        ...(password ? { password_hash: await bcrypt.hash(password, 10) } : {}),
      },
      select: { id: true, email: true, name: true, role: true }
    });
    return updated;
  }

  /**
   * Deletes a user. The audit_logs.user_id FK is ON DELETE SET NULL
   * (migration 012), so the user's audit entries are kept and detached.
   */
  async delete(id: string) {
    const user = await this.prisma.users.findUnique({ where: { id } });
    if (!user) throw new UserNotFoundException(id);
    await this.assertNotLastSuperAdmin(user, 'delete');
    await this.prisma.users.delete({ where: { id } });
    return { deleted: true };
  }
}
