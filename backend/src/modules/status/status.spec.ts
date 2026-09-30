import { RollingCounter } from './rolling-counter';
import { LatencyReservoir } from './latency-reservoir';
import { routeTemplate } from './route-template';
import { StatusService } from './status.service';
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

  it('bounds the number of tracked routes', () => {
    const s = new StatusService();
    for (let i = 0; i < 1000; i++) s.recordRequest(`GET /x${i}`, 200, 1);
    expect(s.snapshot().http.total).toBe(1000);
    expect(s.snapshot().http.slowestRoutes.length).toBeLessThanOrEqual(10);
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
