import { Logger } from '@nestjs/common';
import { GracefulShutdownService } from './graceful-shutdown.service';
import * as tracing from '../../tracing';

describe('GracefulShutdownService', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  function make() {
    const order: string[] = [];
    const redis = {
      completeStreams: jest.fn(() => order.push('sse')),
      close: jest.fn(async () => { order.push('redis'); }),
    };
    const prisma = { $disconnect: jest.fn(async () => { order.push('prisma'); }) };
    jest.spyOn(tracing, 'shutdownTracing').mockImplementation(async () => { order.push('otel'); });
    const svc = new GracefulShutdownService(redis as any, prisma as any);
    return { svc, order, redis, prisma };
  }

  it('ends SSE streams before the HTTP server closes, then Redis, then Prisma, then OTel', async () => {
    const { svc, order } = make();
    svc.beforeApplicationShutdown('SIGTERM');
    expect(order).toEqual(['sse']);
    await svc.onApplicationShutdown('SIGTERM');
    expect(order).toEqual(['sse', 'redis', 'prisma', 'otel']);
  });

  it('keeps going when one step fails', async () => {
    const { svc, order, redis } = make();
    redis.close.mockRejectedValueOnce(new Error('boom'));
    await svc.onApplicationShutdown();
    expect(order).toEqual(['prisma', 'otel']);
  });
});
