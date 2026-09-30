import { ArgumentsHost, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { HttpExceptionFilter } from './http-exception.filter';
import { UserNotFoundException } from '../exceptions';
import { ErrorCodes } from '../exceptions/error-codes';
import { BusinessException } from '../exceptions/base.exception';
import { validationExceptionFactory } from '../validation/validation-failed.exception';
import { ServiceUnavailableException, ValidationPipe } from '@nestjs/common';
import { IsInt, Max, IsString, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

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

  it('errors are sent with Cache-Control: no-store and keep requestId in the body', () => {
    const res = run(new NotFoundException('nope'));
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.body.error.requestId).toBe('rid-1');
  });

  it('a 429 mirrors the throttler-specific Retry-After-<name> header as Retry-After', () => {
    const res: any = { headers: { 'retry-after-public': '42' } as Record<string, string> };
    res.setHeader = (k: string, v: string) => (res.headers[k] = v);
    res.getHeaderNames = () => Object.keys(res.headers);
    res.getHeader = (k: string) => res.headers[k];
    res.status = (s: number) => ((res.statusCode = s), res);
    res.json = (b: unknown) => ((res.body = b), res);
    const req = { headers: {}, method: 'GET', url: '/api/v1/x' };
    const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) } as unknown as ArgumentsHost;
    const { ThrottlerException } = require('@nestjs/throttler');
    new HttpExceptionFilter().catch(new ThrottlerException(), host);
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBe('42');
  });

  it.each([
    ['P2002', 409, 'GEN_0004'],
    ['P2034', 409, 'GEN_0004'],
    ['P2028', 409, 'GEN_0004'],
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

  class Item { @IsString() name!: string; }
  class Body {
    @IsInt() @Max(200) limit!: number;
    @IsArray() @ValidateNested({ each: true }) @Type(() => Item) items!: Item[];
  }
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: validationExceptionFactory });

  it('validation failures → fields with nested paths, one message string, no details/validationErrors', async () => {
    let caught: unknown;
    try {
      await pipe.transform({ limit: 500, items: [{ name: 'a' }, { name: 5 }] }, { type: 'body', metatype: Body });
    } catch (e) {
      caught = e;
    }
    const res = run(caught);
    expect(res.statusCode).toBe(400);
    const err = res.body.error;
    expect(err.code).toBe('VALIDATION_9001');
    expect(err.message).toBe('Validation failed');
    expect(err.fields).toEqual([
      { field: 'limit', message: 'limit must not be greater than 200' },
      { field: 'items[1].name', message: 'name must be a string' },
    ]);
    expect(err.details).toBeUndefined();
    expect(err.validationErrors).toBeUndefined();
  });

  it('emits every constraint message for a field as separate entries', async () => {
    let caught: unknown;
    try {
      await pipe.transform({ limit: 'x', items: [] }, { type: 'query', metatype: Body });
    } catch (e) {
      caught = e;
    }
    const fields = run(caught).body.error.fields.filter((f: any) => f.field === 'limit');
    expect(fields.length).toBeGreaterThan(1);
  });

  it('business exception: code, message, details only when non-empty', () => {
    class Boom extends BusinessException {
      constructor(d?: Record<string, unknown>) { super(ErrorCodes.CONFLICT, 'Already finalized', 409, d); }
    }
    const withDetails = run(new Boom({ electionId: 'e1' })).body.error;
    expect(withDetails.message).toBe('Already finalized');
    expect(withDetails.details).toEqual({ electionId: 'e1' });
    expect(withDetails.fields).toBeUndefined();
    expect(run(new Boom()).body.error.details).toBeUndefined();
    expect(run(new Boom({})).body.error.details).toBeUndefined();
  });

  it('plain HttpException does not leak its response object as details', () => {
    const err = run(new NotFoundException('nope')).body.error;
    expect(err.message).toBe('nope');
    expect(err.details).toBeUndefined();
  });

  it('5xx HttpException returns the generic message and logs the real one', () => {
    const res = run(new ServiceUnavailableException('redis at 10.0.0.9 down'));
    expect(res.statusCode).toBe(503);
    expect(res.body.error.message).toBe('Internal server error');
    expect(JSON.stringify(res.body)).not.toMatch(/10\.0\.0\.9/);
    expect(errorSpy.mock.calls[0][0]).toMatch(/redis at 10\.0\.0\.9 down/);
  });

  it('error.path omits the query string', () => {
    expect(run(new NotFoundException()).body.error.path).toBe('/api/v1/x');
  });
});
