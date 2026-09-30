import { ForbiddenException } from '@nestjs/common';
import { UserService } from './user.service';

function make(users: Array<{ id: string; role: string }>) {
  const prisma: any = {
    users: {
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
      count: jest.fn(async ({ where }: any) => users.filter((u) => u.role === where.role).length),
      update: jest.fn(async ({ where, data }: any) => ({ ...users.find((u) => u.id === where.id), ...data })),
      delete: jest.fn(async () => ({})),
    },
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  return { svc: new UserService(prisma), prisma };
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
