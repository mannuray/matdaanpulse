import { NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';

describe('AuthController.register (ALLOW_REGISTRATION)', () => {
  function make(flag: string | undefined) {
    const auth = { register: jest.fn().mockResolvedValue({ access_token: 't' }), login: jest.fn() };
    const config = { get: (k: string) => (k === 'ALLOW_REGISTRATION' ? flag : undefined) };
    return { ctrl: new AuthController(auth as any, config as any), auth };
  }
  const body = { email: 'a@b.c', password: 'password123', name: 'A' } as any;

  it.each([undefined, '', 'false', '1', 'yes'])('is disabled (404) when ALLOW_REGISTRATION=%p', async (flag) => {
    const { ctrl, auth } = make(flag);
    expect(() => ctrl.register(body)).toThrow(NotFoundException);
    expect(auth.register).not.toHaveBeenCalled();
  });

  it('registers a VIEWER when ALLOW_REGISTRATION=true', async () => {
    const { ctrl, auth } = make('true');
    await ctrl.register({ ...body, role: 'SUPER_ADMIN' });
    expect(auth.register).toHaveBeenCalledWith('a@b.c', 'password123', 'A', 'VIEWER');
  });
});

describe('AuthController.logout (U1)', () => {
  it('revokes the caller\'s tokens and needs a valid session', async () => {
    const { JwtAuthGuard } = await import('./guards/jwt-auth.guard');
    const auth = { logout: jest.fn().mockResolvedValue(undefined) };
    const ctrl = new AuthController(auth as any, { get: () => undefined } as any);
    await ctrl.logout({ user: { id: 'u1' } });
    expect(auth.logout).toHaveBeenCalledWith('u1');
    expect(Reflect.getMetadata('__guards__', AuthController.prototype.logout)).toContain(JwtAuthGuard);
    expect(Reflect.getMetadata('__httpCode__', AuthController.prototype.logout)).toBe(204);
  });
});
