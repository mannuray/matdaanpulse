import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Prisma, user_role } from '@prisma/client';
import { UserNotFoundException } from '../../common/exceptions';
import { AuditLogService } from '../audit-log/audit-log.service';

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async getAll() {
    return this.prisma.users.findMany({
      select: { id: true, email: true, name: true, role: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 200,
    });
  }

  /** Audit rows never hold the password or its hash (U2). */
  async create(data: { email: string; password: string; name: string; role: user_role }, actorId?: string) {
    const password_hash = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.users.create({
      data: { email: data.email, password_hash, name: data.name, role: data.role },
      select: { id: true, email: true, name: true, role: true }
    });
    await this.audit.log({
      userId: actorId, action: 'USER_CREATE', entityType: 'user', entityId: user.id,
      newValue: { email: user.email, name: user.name, role: user.role },
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

  async update(id: string, data: Partial<{ email: string; name: string; role: user_role; password: string }>, actorId?: string) {
    // Hash outside the transaction so the row locks are held only briefly.
    const { password, ...rest } = data;
    const password_hash = password ? await bcrypt.hash(password, 10) : undefined;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({ where: { id } });
      if (!user) throw new UserNotFoundException(id);
      if (data.role && data.role !== user.role) await this.assertNotLastSuperAdmin(tx, user, 'demote');

      // Map the DTO onto real columns; `password` is hashed into `password_hash`.
      const updated = await tx.users.update({
        where: { id },
        // A new password also bumps token_version: every session token issued before is revoked (U1).
        data: { ...rest, ...(password_hash ? { password_hash, token_version: { increment: 1 } } : {}) },
        select: { id: true, email: true, name: true, role: true },
      });
      await this.auditUpdate(tx, user, rest, !!password_hash, actorId);
      return updated;
    });
  }

  /** One row per kind of change: USER_ROLE_CHANGE, USER_PASSWORD_RESET (no values), USER_UPDATE (name/email). */
  private async auditUpdate(
    tx: Prisma.TransactionClient,
    before: { id: string; email: string; name: string; role: user_role },
    patch: Partial<{ email: string; name: string; role: user_role }>,
    passwordChanged: boolean,
    actorId?: string,
  ) {
    const base = { userId: actorId, entityType: 'user', entityId: before.id };
    if (patch.role !== undefined && patch.role !== before.role) {
      await this.audit.log({ ...base, action: 'USER_ROLE_CHANGE', oldValue: { role: before.role }, newValue: { role: patch.role } }, tx);
    }
    if (passwordChanged) await this.audit.log({ ...base, action: 'USER_PASSWORD_RESET' }, tx);
    const oldValue: Record<string, string> = {}, newValue: Record<string, string> = {};
    for (const k of ['email', 'name'] as const) {
      const v = patch[k];
      if (v !== undefined && v !== before[k]) { oldValue[k] = before[k]; newValue[k] = v; }
    }
    if (Object.keys(newValue).length) await this.audit.log({ ...base, action: 'USER_UPDATE', oldValue, newValue }, tx);
  }

  /**
   * Deletes a user. The audit_logs.user_id FK is ON DELETE SET NULL
   * (migration 012), so the user's audit entries are kept and detached.
   */
  async delete(id: string, actorId?: string) {
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.users.findUnique({ where: { id } });
      if (!user) throw new UserNotFoundException(id);
      await this.assertNotLastSuperAdmin(tx, user, 'delete');
      await tx.users.delete({ where: { id } });
      await this.audit.log({
        userId: actorId, action: 'USER_DELETE', entityType: 'user', entityId: id,
        oldValue: { email: user.email, name: user.name, role: user.role },
      }, tx);
    });
    return { deleted: true };
  }
}
