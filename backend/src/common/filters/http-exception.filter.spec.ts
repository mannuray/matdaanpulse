import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';
import { UserNotFoundException } from '../exceptions';

function known(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`internal detail about table "users" (${code})`, {
    code,
    clientVersion: 'test',
  });
}

function run(exception: unknown) {
  const res: any = { headers: {} as Record<string, string> };
  res.setHeader = (k: string, v: string) => (res.headers[k] = v);
  res.status = (s: number) => ((res.statusCode = s), res);
  res.json = (b: unknown) => ((res.body = b), res);
  const req = { headers: { 'x-request-id': 'rid-1' }, method: 'POST', url: '/api/v1/x?token=secret', originalUrl: '/api/v1/x?token=secret' };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return res;
}

describe('HttpExceptionFilter', () => {
  let errorSpy: jest.SpyInstance;
  beforeEach(() => (errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)));
  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['P2002', 409, 'GEN_0004'],
    ['P2025', 404, 'GEN_0002'],
    ['P2003', 400, 'VALIDATION_9001'],
    ['P2023', 400, 'VALIDATION_9001'],
  ])('maps Prisma %s to %i without leaking internals', (code, status, errCode) => {
    const res = run(known(code));
    expect(res.statusCode).toBe(status);
    expect(res.body.error.code).toBe(errCode);
    expect(JSON.stringify(res.body)).not.toMatch(/users|internal detail/);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('maps PrismaClientValidationError to 400 but logs it at error level with the stack', () => {
    const err = new Prisma.PrismaClientValidationError('Argument `id`: invalid value in prisma.users.findMany()', { clientVersion: 'test' });
    const res = run(err);
    expect(res.statusCode).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/prisma\.users/);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0]).toMatch(/→ 400/);
    expect(errorSpy.mock.calls[0][1]).toBe(err.stack);
  });

  it('unknown errors → generic 500, logged with stack, request id, method and redacted path', () => {
    const err = new Error('db exploded at host 10.0.0.5');
    const res = run(err);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.5/);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [msg, stack] = errorSpy.mock.calls[0];
    expect(msg).toMatch(/POST \/api\/v1\/x\?token=\[REDACTED\] → 500: db exploded/);
    expect(msg).toMatch(/requestId=rid-1/);
    expect(stack).toBe(err.stack);
  });

  it('unmapped Prisma codes stay 500', () => {
    expect(run(known('P1001')).statusCode).toBe(500);
  });

  it('keeps business exceptions and 4xx unchanged, without error logs', () => {
    const res = run(new UserNotFoundException('u1'));
    expect(res.statusCode).toBe(404);
    expect(res.body.error.code).toBe('USER_4001');
    expect(run(new NotFoundException()).statusCode).toBe(404);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('echoes a valid incoming request id', () => {
    const res = run(new Error('x'));
    expect(res.headers['X-Request-ID']).toBe('rid-1');
  });
});
