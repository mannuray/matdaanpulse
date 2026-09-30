import { Body, Controller, Get, INestApplication, Post, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SkipThrottle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { configureApp } from './app.setup';
import { AuthRateLimited, buildThrottlerOptions, SKIP_ALL_THROTTLERS } from './common/throttle/throttle.config';
import { HealthController } from './modules/health/health.controller';
import { PrismaService } from './modules/prisma/prisma.service';
import { RedisService } from './modules/redis/redis.service';

@Controller('auth')
@AuthRateLimited()
class FakeAuthController {
  @Post('login')
  login(@Body() body: Record<string, unknown>) {
    return { keys: Object.keys(body ?? {}) };
  }
}

@Controller('pub')
class PublicController {
  @Get()
  get(@Req() req: { ip: string }) {
    return { ip: req.ip };
  }
}

@Controller('live')
@SkipThrottle(SKIP_ALL_THROTTLERS)
class StreamController {
  @Get()
  get() {
    return 'ok';
  }
}

@Controller('admin/results')
class BulkController {
  @Post('override-bulk')
  bulk(@Body() body: { blob: string }) {
    return { length: body.blob.length };
  }
}

describe('HTTP wiring (configureApp + throttlers)', () => {
  let app: INestApplication;
  let base: string;
  const prisma = { $queryRaw: jest.fn() };
  const redis = { ping: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(buildThrottlerOptions({ THROTTLE_PUBLIC_PER_MIN: '4', THROTTLE_AUTH_PER_MIN: '2' }))],
      controllers: [FakeAuthController, PublicController, StreamController, BulkController, HealthController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
    configureApp(app as NestExpressApplication, { TRUST_PROXY_HOPS: '1' });
    await app.listen(0);
    base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
  });

  afterAll(() => app.close());

  const get = (path: string, ip: string) => fetch(`${base}${path}`, { headers: { 'X-Forwarded-For': ip } });
  const post = (path: string, ip: string, body: unknown) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
      body: JSON.stringify(body),
    });

  describe('trust proxy', () => {
    it('req.ip is the client address added by the one trusted proxy', async () => {
      const res = await get('/pub', '203.0.113.9, 198.51.100.7');
      expect((await res.json()).data.ip).toBe('198.51.100.7');
    });
  });

  describe('throttling', () => {
    it('public limit is per client IP (not one bucket for the whole site)', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 5; i++) statuses.push((await get('/pub', '10.0.0.1')).status);
      expect(statuses).toEqual([200, 200, 200, 200, 429]);
      expect((await get('/pub', '10.0.0.2')).status).toBe(200);
    });

    it('auth routes use the strict auth limit', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 3; i++) statuses.push((await post('/auth/login', '10.0.1.1', {})).status);
      expect(statuses).toEqual([201, 201, 429]);
    });

    it('the auth limit does not apply to public routes', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) statuses.push((await get('/pub', '10.0.2.1')).status);
      expect(statuses.every((s) => s === 200)).toBe(true);
    });

    it('live and health routes are never throttled', async () => {
      prisma.$queryRaw.mockResolvedValue([1]);
      redis.ping.mockResolvedValue(undefined);
      for (let i = 0; i < 8; i++) {
        expect((await get('/live', '10.0.3.1')).status).toBe(200);
        expect((await get('/health/live', '10.0.3.1')).status).toBe(200);
        expect((await get('/health/ready', '10.0.3.1')).status).toBe(200);
      }
    });
  });

  describe('body limits', () => {
    it('rejects a 200kb body on /auth/login with 413', async () => {
      const res = await post('/auth/login', '10.0.4.1', { blob: 'x'.repeat(200 * 1024) });
      expect(res.status).toBe(413);
      expect((await res.json()).error.message).toBe('Request body too large');
    });

    it('still parses a normal small body', async () => {
      const res = await post('/auth/login', '10.0.4.2', { email: 'a@b.c', password: 'x' });
      expect((await res.json()).data.keys).toEqual(['email', 'password']);
    });

    it('accepts a 1 MB body on the bulk override route only', async () => {
      const res = await post('/admin/results/override-bulk', '10.0.4.3', { blob: 'x'.repeat(1024 * 1024) });
      expect(res.status).toBe(201);
      expect((await res.json()).data.length).toBe(1024 * 1024);
    });
  });

  describe('health', () => {
    it('/health/live does no I/O', async () => {
      prisma.$queryRaw.mockClear();
      redis.ping.mockClear();
      const res = await get('/health/live', '10.0.5.1');
      expect(res.status).toBe(200);
      expect((await res.json()).data.status).toBe('ok');
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(redis.ping).not.toHaveBeenCalled();
    });

    it('/health/ready and /health return 503 without error text when Redis is down', async () => {
      prisma.$queryRaw.mockResolvedValue([1]);
      redis.ping.mockRejectedValue(new Error('connect ECONNREFUSED secret-host:6379'));
      for (const path of ['/health/ready', '/health']) {
        const res = await get(path, '10.0.5.2');
        expect(res.status).toBe(503);
        const text = await res.text();
        expect(text).not.toMatch(/secret-host|ECONNREFUSED/);
        expect(JSON.parse(text).data.checks.redis.status).toBe('unhealthy');
        expect(JSON.parse(text).data.checks.database.status).toBe('healthy');
      }
    });

    it('/health/ready returns 503 when the DB check exceeds the timeout', async () => {
      prisma.$queryRaw.mockReturnValue(new Promise(() => undefined)); // hangs; the 2 s timeout fires
      redis.ping.mockResolvedValue(undefined);
      const res = await get('/health/ready', '10.0.5.3');
      expect(res.status).toBe(503);
    });
  });
});
