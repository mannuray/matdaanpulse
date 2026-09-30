import { Body, Controller, Get, INestApplication, Post, Query, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { EMPTY } from 'rxjs';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { configureApp } from './app.setup';
import { buildThrottlerOptions } from './common/throttle/throttle.config';
import { ElectionsQueryDto } from './common/dto/query.dto';
import { HealthController } from './modules/health/health.controller';
import { AuthController } from './modules/auth/auth.controller';
import { AuthService } from './modules/auth/auth.service';
import { LiveController } from './modules/live/live.controller';
import { LivePublisher } from './modules/live/live.service';
import { MetricsService } from './modules/metrics/metrics.service';
import { PrismaService } from './modules/prisma/prisma.service';
import { RedisService } from './modules/redis/redis.service';

// Stand-ins only where the real controller can't run without a DB/guards:
// a plain public route, and the bulk-override path (real one needs JWT guards).
@Controller('pub')
class PublicController {
  @Get()
  get(@Req() req: { ip: string }, @Query() _q: ElectionsQueryDto) {
    return { ip: req.ip };
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
  const redis = { ping: jest.fn(), isSubscriberReady: jest.fn().mockReturnValue(true) };
  const authService = { login: jest.fn(async (email: string) => ({ access_token: 't', user: { email } })) };
  const livePublisher = { streamEvents: jest.fn(() => EMPTY), publish: jest.fn() };
  const metrics = { sseConnections: { add: jest.fn() } };
  const EID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(buildThrottlerOptions({ THROTTLE_PUBLIC_PER_MIN: '4', THROTTLE_AUTH_PER_MIN: '2' }))],
      controllers: [AuthController, LiveController, HealthController, PublicController, BulkController],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: LivePublisher, useValue: livePublisher },
        { provide: MetricsService, useValue: metrics },
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
  const post = (path: string, ip: string, body: unknown, extra: Record<string, string> = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip, ...extra },
      body: JSON.stringify(body),
    });
  const login = { email: 'a@b.cd', password: 'password123' };

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

    it('the real /auth/login uses the strict auth limit', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 3; i++) statuses.push((await post('/auth/login', '10.0.1.1', login)).status);
      expect(statuses).toEqual([201, 201, 429]);
    });

    it('a spoofed leftmost X-Forwarded-For entry does not create new buckets', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 3; i++) statuses.push((await post('/auth/login', `1.2.3.${i}, 10.0.1.9`, login)).status);
      expect(statuses).toEqual([201, 201, 429]);
    });

    it('the auth limit does not apply to public routes', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) statuses.push((await get('/pub', '10.0.2.1')).status);
      expect(statuses.every((s) => s === 200)).toBe(true);
    });

    it('the real live SSE and health routes are never throttled', async () => {
      prisma.$queryRaw.mockResolvedValue([1]);
      redis.ping.mockResolvedValue(undefined);
      for (let i = 0; i < 8; i++) {
        const sse = await get(`/live/updates?election_id=${EID}`, '10.0.3.1');
        expect(sse.status).toBe(200);
        await sse.text();
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
      const res = await post('/auth/login', '10.0.4.2', login);
      expect(res.status).toBe(201);
      expect(authService.login).toHaveBeenLastCalledWith('a@b.cd', 'password123');
    });

    it('accepts a 1 MB body on the bulk override route (with a Bearer header)', async () => {
      const res = await post('/admin/results/override-bulk', '10.0.4.3', { blob: 'x'.repeat(1024 * 1024) }, { Authorization: 'Bearer abc' });
      expect(res.status).toBe(201);
      expect((await res.json()).data.length).toBe(1024 * 1024);
    });

    it('rejects an anonymous bulk override with 401 before parsing the body', async () => {
      const res = await post('/admin/results/override-bulk', '10.0.4.4', { blob: 'x'.repeat(1024 * 1024) });
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe('AUTH_1003');
    });
  });

  describe('cache-buster', () => {
    it('?_=<ts> is tolerated on DTO-validated routes; other unknown keys still 400', async () => {
      expect((await get('/pub?_=1727680000000&type=VS', '10.0.6.1')).status).toBe(200);
      expect((await get('/pub?foo=1', '10.0.6.2')).status).toBe(400);
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

    it('/health/ready returns 503 when the Redis subscriber is not ready', async () => {
      prisma.$queryRaw.mockResolvedValue([1]);
      redis.ping.mockResolvedValue(undefined);
      redis.isSubscriberReady.mockReturnValueOnce(false);
      const res = await get('/health/ready', '10.0.5.4');
      expect(res.status).toBe(503);
      expect((await res.json()).data.checks.redis.status).toBe('unhealthy');
    });

    it('/health/ready returns 503 when the DB check exceeds the timeout', async () => {
      prisma.$queryRaw.mockReturnValue(new Promise(() => undefined)); // hangs; the 2 s timeout fires
      redis.ping.mockResolvedValue(undefined);
      const res = await get('/health/ready', '10.0.5.3');
      expect(res.status).toBe(503);
    });
  });
});

describe('throttle metadata on the real controllers', () => {
  const { isAuthRoute } = require('./common/throttle/throttle.config');
  const ctx = (cls: unknown) => ({ getClass: () => cls, getHandler: () => () => undefined }) as any;

  it('AuthController counts against the auth throttler', () => {
    expect(isAuthRoute(ctx(AuthController))).toBe(true);
    expect(isAuthRoute(ctx(LiveController))).toBe(false);
  });

  it.each([LiveController, HealthController])('%p skips both throttlers', (cls) => {
    expect(Reflect.getMetadata('THROTTLER:SKIPpublic', cls)).toBe(true);
    expect(Reflect.getMetadata('THROTTLER:SKIPauth', cls)).toBe(true);
  });
});
