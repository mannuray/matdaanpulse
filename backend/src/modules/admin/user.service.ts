import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma, user_role } from '@prisma/client';
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

  /**
   * Refuse to remove the last SUPER_ADMIN (demotion or deletion), which would
   * leave no admin. Runs inside the write's transaction and row-locks every
   * SUPER_ADMIN (SELECT … FOR UPDATE), so two admins demoting each other at the
   * same moment serialise and the second one is refused.
   */
  private async assertNotLastSuperAdmin(tx: Prisma.TransactionClient, user: { role: user_role }, action: string) {
    if (user.role !== 'SUPER_ADMIN') return;
    const superAdmins = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM users WHERE role = 'SUPER_ADMIN' ORDER BY id FOR UPDATE`;
    if (superAdmins.length <= 1) {
      throw new ForbiddenException(`Cannot ${action} the last SUPER_ADMIN`);
    }
  }

  async update(id: string, data: Partial<{ email: string; name: string; role: user_role; password: string }>) {
    // Hash outside the transaction so the row locks are held only briefly.
    const { password, ...rest } = data;
    const password_hash = password ? await bcrypt.hash(password, 10) : undefined;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({ where: { id } });
      if (!user) throw new UserNotFoundException(id);
      if (data.role && data.role !== user.role) await this.assertNotLastSuperAdmin(tx, user, 'demote');

      // Map the DTO onto real columns; `password` is hashed into `password_hash`.
      return tx.users.update({
        where: { id },
        // A new password also bumps token_version: every session token issued before is revoked (U1).
        data: { ...rest, ...(password_hash ? { password_hash, token_version: { increment: 1 } } : {}) },
        select: { id: true, email: true, name: true, role: true },
      });
    });
  }

  /**
   * Deletes a user. The audit_logs.user_id FK is ON DELETE SET NULL
   * (migration 012), so the user's audit entries are kept and detached.
   */
  async delete(id: string) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({ where: { id } });
      if (!user) throw new UserNotFoundException(id);
      await this.assertNotLastSuperAdmin(tx, user, 'delete');
      await tx.users.delete({ where: { id } });
    });
    return { deleted: true };
  }
}
