import { ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';

function make(users: Array<{ id: string; role: string }>) {
  const prisma: any = {
    users: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
      count: jest.fn(),
      update: jest.fn(async ({ where, data }: any) => ({ ...users.find((u) => u.id === where.id), ...data })),
      delete: jest.fn(async () => ({})),
      create: jest.fn(async ({ data }: any) => ({ id: 'new', email: data.email, name: data.name, role: data.role })),
    },
  };
  // Raw row-locking query used by the guard: SELECT id FROM users WHERE role = 'SUPER_ADMIN' FOR UPDATE
  prisma.$queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
    expect(strings.join('?')).toMatch(/FOR UPDATE/);
    return users.filter((u) => u.role === 'SUPER_ADMIN').map((u) => ({ id: u.id }));
  });
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const audit = { log: jest.fn(async (..._args: unknown[]) => undefined) };
  return { svc: new UserService(prisma, audit as any), prisma, audit };
}

describe('UserService last SUPER_ADMIN guard', () => {
  it('refuses to demote the last SUPER_ADMIN', async () => {
    const { svc, prisma } = make([{ id: 'a', role: 'SUPER_ADMIN' }, { id: 'e', role: 'EDITOR' }]);
    await expect(svc.update('a', { role: 'EDITOR' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.users.update).not.toHaveBeenCalled();
  });

  it('refuses to delete the last SUPER_ADMIN', async () => {
    const { svc, prisma } = make([{ id: 'a', role: 'SUPER_ADMIN' }]);
    await expect(svc.delete('a')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.users.delete).not.toHaveBeenCalled();
  });

  it('allows demoting a SUPER_ADMIN when another one remains', async () => {
    const { svc, prisma } = make([{ id: 'a', role: 'SUPER_ADMIN' }, { id: 'b', role: 'SUPER_ADMIN' }]);
    await svc.update('a', { role: 'EDITOR' });
    expect(prisma.users.update).toHaveBeenCalled();
  });

  it('allows other edits of the last SUPER_ADMIN (same role)', async () => {
    const { svc, prisma } = make([{ id: 'a', role: 'SUPER_ADMIN' }]);
    await svc.update('a', { name: 'New', role: 'SUPER_ADMIN' });
    expect(prisma.users.update).toHaveBeenCalled();
  });

  it('allows deleting an editor', async () => {
    const { svc, prisma } = make([{ id: 'a', role: 'SUPER_ADMIN' }, { id: 'e', role: 'EDITOR' }]);
    await expect(svc.delete('e')).resolves.toEqual({ deleted: true });
    expect(prisma.users.delete).toHaveBeenCalled();
  });
});

describe('UserService guard runs inside the write transaction', () => {
  it('locks and writes with the transaction client', async () => {
    const { svc, prisma } = make([{ id: 'a', role: 'SUPER_ADMIN' }, { id: 'b', role: 'SUPER_ADMIN' }]);
    await svc.update('a', { role: 'EDITOR' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    await svc.delete('b');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });
});

describe('UserService password reset revokes sessions (U1)', () => {
  it('bumps token_version when the password changes, and only then', async () => {
    const { svc, prisma } = make([{ id: 'e', role: 'EDITOR' }]);
    await svc.update('e', { password: 'new-password-1' });
    const data = prisma.users.update.mock.calls[0][0].data;
    expect(data.token_version).toEqual({ increment: 1 });
    expect(data.password).toBeUndefined();
    expect(typeof data.password_hash).toBe('string');
    await svc.update('e', { name: 'N' });
    expect(prisma.users.update.mock.calls[1][0].data.token_version).toBeUndefined();
  });
});

describe('UserService audit rows (U2)', () => {
  const users = () => [{ id: 'a', role: 'SUPER_ADMIN', email: 'a@x.in', name: 'A' }, { id: 'e', role: 'EDITOR', email: 'e@x.in', name: 'E' }];
  const rows = (audit: any) => audit.log.mock.calls.map((c: any[]) => c[0]);

  it('USER_CREATE with email, name and role, never the password or its hash', async () => {
    const { svc, audit } = make(users());
    await svc.create({ email: 'n@x.in', password: 'secret-pass-1', name: 'N', role: 'EDITOR' }, 'a');
    expect(rows(audit)).toEqual([{ userId: 'a', action: 'USER_CREATE', entityType: 'user', entityId: 'new', newValue: { email: 'n@x.in', name: 'N', role: 'EDITOR' } }]);
    expect(JSON.stringify(rows(audit))).not.toMatch(/secret-pass|\$2b\$/);
  });

  it('a role change and a password reset in one PATCH write two rows; the password is never logged', async () => {
    const { svc, audit } = make(users());
    await svc.update('e', { role: 'SUPER_ADMIN', password: 'new-secret-1' }, 'a');
    expect(rows(audit)).toEqual([
      { userId: 'a', action: 'USER_ROLE_CHANGE', entityType: 'user', entityId: 'e', oldValue: { role: 'EDITOR' }, newValue: { role: 'SUPER_ADMIN' } },
      { userId: 'a', action: 'USER_PASSWORD_RESET', entityType: 'user', entityId: 'e' },
    ]);
    expect(JSON.stringify(rows(audit))).not.toMatch(/new-secret|\$2b\$/);
    // Inside the write transaction (savepoint-safe): the tx client is passed.
    expect(audit.log.mock.calls[0][1]).toBeDefined();
  });

  it('a name/email edit is USER_UPDATE with only the changed fields; an unchanged role writes nothing', async () => {
    const { svc, audit } = make(users());
    await svc.update('e', { name: 'E2', email: 'e@x.in', role: 'EDITOR' }, 'a');
    expect(rows(audit)).toEqual([{ userId: 'a', action: 'USER_UPDATE', entityType: 'user', entityId: 'e', oldValue: { name: 'E' }, newValue: { name: 'E2' } }]);
  });

  it('USER_DELETE keeps who the account was', async () => {
    const { svc, audit } = make(users());
    await svc.delete('e', 'a');
    expect(rows(audit)).toEqual([{ userId: 'a', action: 'USER_DELETE', entityType: 'user', entityId: 'e', oldValue: { email: 'e@x.in', name: 'E', role: 'EDITOR' } }]);
  });
});
