import * as bcrypt from 'bcrypt';
import { AuthService, DUMMY_PASSWORD_HASH } from './auth.service';
import { InvalidCredentialsException } from '../../common/exceptions';

describe('AuthService.login', () => {
  const jwt = { sign: jest.fn().mockReturnValue('signed-token') };
  const findUnique = jest.fn();
  const prisma = { users: { findUnique } };
  const service = new AuthService(prisma as any, jwt as any);

  afterEach(() => jest.restoreAllMocks());

  it('dummy hash is a valid bcrypt hash', () => {
    expect(bcrypt.getRounds(DUMMY_PASSWORD_HASH)).toBe(10);
  });

  it('still runs bcrypt.compare against the dummy hash when the user does not exist', async () => {
    findUnique.mockResolvedValueOnce(null);
    const compare = jest.spyOn(bcrypt, 'compare');
    await expect(service.login('nobody@example.com', 'password123')).rejects.toBeInstanceOf(InvalidCredentialsException);
    expect(compare).toHaveBeenCalledWith('password123', DUMMY_PASSWORD_HASH);
  });

  it('rejects a wrong password for an existing user', async () => {
    const password_hash = await bcrypt.hash('correct-horse', 4);
    findUnique.mockResolvedValueOnce({ id: 'u1', email: 'a@b.c', role: 'EDITOR', name: 'A', password_hash });
    await expect(service.login('a@b.c', 'wrong-password')).rejects.toBeInstanceOf(InvalidCredentialsException);
  });

  it('returns a token for valid credentials', async () => {
    const password_hash = await bcrypt.hash('correct-horse', 4);
    findUnique.mockResolvedValueOnce({ id: 'u1', email: 'a@b.c', role: 'EDITOR', name: 'A', password_hash });
    const out = await service.login('a@b.c', 'correct-horse');
    expect(out.access_token).toBe('signed-token');
    expect(jwt.sign).toHaveBeenCalledWith({ sub: 'u1', role: 'EDITOR' });
  });
});

describe('AuthService logging (no PII)', () => {
  it('logs the user id, never the email', async () => {
    const { Logger } = await import('@nestjs/common');
    const bcrypt = await import('bcrypt');
    const lines: string[] = [];
    jest.spyOn(Logger.prototype, 'log').mockImplementation((m: any) => { lines.push(String(m)); });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((m: any) => { lines.push(String(m)); });
    const password_hash = await bcrypt.hash('correct-horse', 4);
    const findUnique = jest.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'u1', email: 'secret@b.c', role: 'EDITOR', name: 'A', password_hash })
      .mockResolvedValueOnce({ id: 'u1', email: 'secret@b.c', role: 'EDITOR', name: 'A', password_hash });
    const svc = new AuthService({ users: { findUnique } } as any, { sign: () => 't' } as any);
    await svc.login('ghost@b.c', 'whatever-pass').catch(() => undefined);
    await svc.login('secret@b.c', 'wrong-pass').catch(() => undefined);
    await svc.login('secret@b.c', 'correct-horse');
    expect(lines.join('\n')).not.toMatch(/@b\.c/);
    expect(lines.join('\n')).toMatch(/u1/);
    jest.restoreAllMocks();
  });
});
