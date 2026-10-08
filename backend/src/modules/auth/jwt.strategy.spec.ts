import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy token_version (U1)', () => {
  const user = { id: 'u1', email: 'a@b.c', role: 'EDITOR', name: 'A', token_version: 2 };
  const prisma = { users: { findUnique: jest.fn().mockResolvedValue(user) } };
  const strategy = new JwtStrategy({ getOrThrow: () => 's', get: () => 'test' } as any, prisma as any);

  it('accepts a token carrying the user\'s current version', async () => {
    await expect(strategy.validate({ sub: 'u1', role: 'EDITOR', tv: 2 })).resolves.toEqual({ id: 'u1', email: 'a@b.c', role: 'EDITOR', name: 'A' });
  });

  it('rejects a token from before a logout or password change (older version)', async () => {
    await expect(strategy.validate({ sub: 'u1', role: 'EDITOR', tv: 1 })).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token without a version (issued before revocation existed)', async () => {
    await expect(strategy.validate({ sub: 'u1', role: 'EDITOR' })).rejects.toMatchObject({ status: 401 });
  });

  it('rejects a token of a deleted user', async () => {
    prisma.users.findUnique.mockResolvedValueOnce(null);
    await expect(strategy.validate({ sub: 'u1', role: 'EDITOR', tv: 2 })).rejects.toMatchObject({ status: 401 });
  });
});
