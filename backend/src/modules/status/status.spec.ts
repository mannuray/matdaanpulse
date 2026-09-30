import { RollingCounter } from './rolling-counter';
import { LatencyReservoir } from './latency-reservoir';
import { routeTemplate } from './route-template';
import { StatusService, MAX_ROUTES } from './status.service';
import { poolConfig, buildProcessInfo } from './process-info';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { StatusController } from './status.controller';
import { Reflector } from '@nestjs/core';
import { CacheService } from '../redis/cache.service';

const MIN = 60_000;

describe('RollingCounter', () => {
  it('sums the requested window and drops older minutes', () => {
    const c = new RollingCounter();
    c.add(0 * MIN); c.add(0 * MIN); c.add(3 * MIN); c.add(10 * MIN, 5);
    expect(c.sum(10 * MIN, 5)).toBe(5);
    expect(c.sum(10 * MIN, 11)).toBe(8);
  });

  it('rolls over: a slot reused 60 minutes later starts from zero', () => {
    const c = new RollingCounter();
    c.add(5 * MIN, 7);
    c.add(65 * MIN, 1); // same slot (5 % 60)
    expect(c.sum(65 * MIN, 60)).toBe(1);
  });

  it('ignores minutes that fell out of the ring without any new write', () => {
    const c = new RollingCounter();
    c.add(0, 4);
    expect(c.sum(61 * MIN, 60)).toBe(0);
  });
});

describe('LatencyReservoir', () => {
  it('computes nearest-rank p95 and keeps only the last 200 samples', () => {
    const r = new LatencyReservoir(200);
    for (let i = 1; i <= 100; i++) r.add(1000, i);
    expect(r.p95(1000, MIN)).toEqual({ p95: 95, samples: 100 });
    for (let i = 0; i < 200; i++) r.add(1000, 1); // evicts the old ones
    expect(r.p95(1000, MIN)).toEqual({ p95: 1, samples: 200 });
  });

  it('excludes samples older than the window', () => {
    const r = new LatencyReservoir();
    r.add(0, 500);
    expect(r.p95(2 * 60 * MIN, 60 * MIN)).toBeNull();
  });
});

describe('routeTemplate', () => {
  it('uses the matched route, not the raw URL (no ids, no query)', () => {
    const req = { method: 'GET', baseUrl: '', route: { path: '/api/v1/elections/:id' }, originalUrl: '/api/v1/elections/abc-123?token=secret' };
    expect(routeTemplate(req)).toBe('GET /api/v1/elections/:id');
  });

  it('collapses unmatched requests into one key', () => {
    expect(routeTemplate({ method: 'GET' })).toBe('GET (unmatched)');
  });
});

describe('StatusService', () => {
  it('counts status classes, 429 and rolling rates', () => {
    const s = new StatusService();
    const now = 100 * MIN;
    s.recordRequest('GET /a', 200, 5, now);
    s.recordRequest('GET /a', 404, 5, now);
    s.recordRequest('GET /a', 429, 5, now);
    s.recordRequest('GET /a', 500, 5, now - 30 * MIN);
    const snap = s.snapshot(now);
    expect(snap.http.total).toBe(4);
    expect(snap.http.byClass).toMatchObject({ '2xx': 1, '4xx': 2, '5xx': 1 });
    expect(snap.http.throttled429).toBe(1);
    expect(snap.http.last5m).toMatchObject({ requests: 3, errors5xx: 0 });
    expect(snap.http.last60m).toMatchObject({ requests: 4, errors5xx: 1 });
  });

  it('lists the 10 slowest routes by p95 and hides unmatched', () => {
    const s = new StatusService();
    const now = 10 * MIN;
    for (let i = 0; i < 12; i++) s.recordRequest(`GET /r${i}`, 200, i * 10, now);
    s.recordRequest('GET (unmatched)', 404, 9999, now);
    const { slowestRoutes } = s.snapshot(now).http;
    expect(slowestRoutes).toHaveLength(10);
    expect(slowestRoutes[0]).toMatchObject({ route: 'GET /r11', p95Ms: 110 });
  });

  it('bounds the number of tracked routes at MAX_ROUTES (300)', () => {
    const s = new StatusService();
    for (let i = 0; i < 1000; i++) s.recordRequest(`GET /x${i}`, 200, 1);
    expect(s.snapshot().http.total).toBe(1000);
    expect(s.snapshot().http.slowestRoutes.length).toBeLessThanOrEqual(10);
    expect(MAX_ROUTES).toBe(300);
    expect((s as unknown as { routes: Map<string, unknown> }).routes.size).toBe(MAX_ROUTES);
    // Routes already tracked keep recording once the cap is reached.
    s.recordRequest('GET /x0', 200, 999);
    expect(s.snapshot().http.slowestRoutes[0]).toMatchObject({ route: 'GET /x0', p95Ms: 999 });
  });

  it('tracks live counters and overrides per minute', () => {
    const s = new StatusService();
    s.addSseConnections(2); s.addSseConnections(-3);
    s.recordOverrides(5, 10 * MIN);
    const live = s.snapshot(10 * MIN).live;
    expect(live.sseConnections).toBe(0);
    expect(live.overridesApplied).toBe(5);
    expect(live.overridesPerMin).toBe(1);
    expect(live.lastOverrideAt).toBe(new Date(10 * MIN).toISOString());
  });
});

describe('cache counters', () => {
  function make(redis: any) {
    const status = new StatusService();
    jest.spyOn(require('@nestjs/common').Logger.prototype, 'warn').mockImplementation(() => undefined);
    return { status, cache: new CacheService(redis, status) };
  }

  it('counts hit, miss and Redis-error fallback', async () => {
    const { status, cache } = make({ get: jest.fn().mockResolvedValueOnce('1').mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('x')), set: jest.fn() });
    await cache.getOrSet('k', 1, async () => 2);
    await cache.getOrSet('k', 1, async () => 2);
    await cache.getOrSet('k', 1, async () => 2);
    expect(status.snapshot().cache).toMatchObject({ hits: 1, misses: 2, fallbacks: 1, hitRate: 0.33 });
  });
});

describe('process-info', () => {
  it('reports only connection_limit and pool_timeout from the URL', () => {
    const cfg = poolConfig('postgresql://user:pw@db.example.com:5432/x?connection_limit=7&pool_timeout=20&sslmode=require');
    expect(cfg).toEqual({ connectionLimit: 7, poolTimeoutSeconds: 20 });
    expect(JSON.stringify(cfg)).not.toMatch(/pw|example/);
    expect(poolConfig(undefined)).toEqual({ connectionLimit: null, poolTimeoutSeconds: null });
    expect(poolConfig('not a url')).toEqual({ connectionLimit: null, poolTimeoutSeconds: null });
  });

  it('includes a short git sha only when set', () => {
    expect(buildProcessInfo(0, 1000, {}).gitSha).toBeNull();
    expect(buildProcessInfo(0, 1000, { RENDER_GIT_COMMIT: 'abcdef0123456789' }).gitSha).toBe('abcdef012345');
  });
});

describe('StatusController access', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (role: string) => ({
    getHandler: () => StatusController.prototype.get,
    getClass: () => StatusController,
    switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
  }) as any;

  it('is restricted to SUPER_ADMIN', () => {
    expect(Reflect.getMetadata(ROLES_KEY, StatusController)).toEqual(['SUPER_ADMIN']);
    expect(guard.canActivate(ctx('SUPER_ADMIN'))).toBe(true);
    expect(guard.canActivate(ctx('EDITOR'))).toBe(false);
    expect(guard.canActivate(ctx('VIEWER'))).toBe(false);
  });

  it('is behind the JWT guard (anonymous gets 401)', () => {
    const guards = Reflect.getMetadata('__guards__', StatusController) as any[];
    expect(guards.map((g) => g.name)).toEqual(['JwtAuthGuard', 'RolesGuard']);
  });
});

describe('MetricsService → StatusService tee adapter', () => {
  const { MetricsService } = require('../metrics/metrics.service');

  it('forwards counter values to StatusService (OTel off: no-op meter)', () => {
    const s = new StatusService();
    const m = new MetricsService(s);
    m.resultOverrides.add(3, { election_id: 'e' });
    m.sseConnections.add(2);
    m.sseConnections.add(-1);
    m.eventsPublished.add(1);
    m.redisPublishErrors.add(1);
    m.redisPublishDuration.record(5);
    const snap = s.snapshot();
    expect(snap.live.overridesApplied).toBe(3);
    expect(snap.live.sseConnections).toBe(1);
    expect(snap.live.eventsPublished).toBe(1);
    expect(snap.redis.publishErrors).toBe(1);
  });

  it('an OTel instrument that throws never reaches the caller, and StatusService still counts', () => {
    const { metrics } = require('@opentelemetry/api');
    const throwing = { add: () => { throw new Error('otel'); }, record: () => { throw new Error('otel'); } };
    const meter = { createCounter: () => throwing, createUpDownCounter: () => throwing, createHistogram: () => throwing, createObservableGauge: () => ({ addCallback: () => undefined }) };
    const spy = jest.spyOn(metrics, 'getMeter').mockReturnValue(meter);
    try {
      const s = new StatusService();
      const m = new MetricsService(s);
      expect(() => m.resultOverrides.add(2)).not.toThrow();
      expect(() => m.redisPublishDuration.record(1)).not.toThrow();
      expect(s.snapshot().live.overridesApplied).toBe(2);
    } finally {
      spy.mockRestore();
    }
  });

  it('a StatusService failure never reaches the caller', () => {
    const s = new StatusService();
    jest.spyOn(s, 'recordOverrides').mockImplementation(() => { throw new Error('boom'); });
    const m = new MetricsService(s);
    expect(() => m.resultOverrides.add(1)).not.toThrow();
  });
});

describe('StatusMiddleware', () => {
  const { StatusMiddleware } = require('./status.middleware');
  const { EventEmitter } = require('events');

  function run(status: StatusService, req: object) {
    const res = Object.assign(new EventEmitter(), { statusCode: 201 });
    const next = jest.fn();
    new StatusMiddleware(status).use(req, res, next);
    return { res, next };
  }

  it('calls next() and records the route template and status on finish', () => {
    const s = new StatusService();
    const record = jest.spyOn(s, 'recordRequest');
    const { res, next } = run(s, { method: 'GET', baseUrl: '/api/v1/elections', route: { path: '/:id' }, originalUrl: '/api/v1/elections/abc?x=1' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
    res.emit('finish');
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toBe('GET /api/v1/elections/:id');
    expect(record.mock.calls[0][1]).toBe(201);
    expect(record.mock.calls[0][2]).toBeGreaterThanOrEqual(0);
  });

  it('swallows a recording failure (counters never affect a response)', () => {
    const s = new StatusService();
    jest.spyOn(s, 'recordRequest').mockImplementation(() => { throw new Error('boom'); });
    const { res } = run(s, { method: 'GET' });
    expect(() => res.emit('finish')).not.toThrow();
  });
});
