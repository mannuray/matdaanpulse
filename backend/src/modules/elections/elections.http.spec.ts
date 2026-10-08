import { Controller, Get, INestApplication, NotFoundException, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../../app.setup';
import { ElectionsController } from './elections.controller';
import { ElectionsService } from './elections.service';
import { ResultsService } from '../results/results.service';
import { ConstituenciesService } from '../constituencies/constituencies.service';
import { LiveStateService } from '../results/live-state.service';
import { SeatAnalysisService } from '../constituencies/seat-analysis.service';
import { CACHE_CONTROL } from '../../common/http/cache-control';
import { SnapshotBodyCache } from '../results/snapshot-body-cache';
import { request as httpRequest } from 'http';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { buildThrottlerOptions } from '../../common/throttle/throttle.config';

@Controller('admin/thing')
class AdminLikeController {
  @Get()
  get(@Req() req: { ip: string }) {
    return { ip: req.ip };
  }
}

const EID = 'c3d4e5f6-a7b8-9012-cdef-234567890abc';
// Shaped like a Prisma `elections` row (Date column for tentative_next_date).
const ELECTION_ROW = {
  id: EID,
  name: 'Lok Sabha General Election 2029',
  type: 'LS',
  status: 'Upcoming',
  year: 2029,
  state_id: null,
  tentative_next_date: new Date('2029-05-01T00:00:00.000Z'),
  delimitation: '2008',
  manifest_url: null,
  states: null,
  secret_internal: 'x',
};

async function makeApp(env: Record<string, string>, opts: { publicPerMin?: number } = {}) {
  const live = { version: 100, status: 'Live', updatedAt: '2026-09-30T00:00:00.000Z', declared: 2, total: 243 };
  const liveState = { get: jest.fn(async () => ({ ...live })), currentVersion: jest.fn(async () => live.version) };
  const rows = [{ const_id: 'A', party_id: 'P', candidate_name: 'x', votes: 1, status: 'WON', margin: 1, const_type: 'GEN' }];
  const resultsService = {
    getResults: jest.fn(async () => rows),
    getSnapshot: jest.fn(async (_id: string, version: number) => ({ version, results: rows, summary: [], voteShare: [] })),
    getElectionSummary: jest.fn(async () => []),
    getVoteShare: jest.fn(async () => []),
    getSeatRounds: jest.fn(async () => [{ seq: 1, r: 1, rt: 20, lp: 'BJP', m: 120, v: 900, declared: false, at: '2027-02-27T04:00:00.000Z' }]),
    getRegionShares: jest.fn(async () => []),
    getDistrictResults: jest.fn(async () => []),
    compareConstituencies: jest.fn(async () => ({})),
    getConstituencyDetail: jest.fn(async (_e: string, constId: string) => ({ id: constId, name: 'Seat A', candidates: [], secret: 'x' })),
  };
  const throttled = opts.publicPerMin !== undefined;
  const bodies = new SnapshotBodyCache();
  const moduleRef = await Test.createTestingModule({
    imports: throttled ? [ThrottlerModule.forRoot(buildThrottlerOptions({ THROTTLE_PUBLIC_PER_MIN: String(opts.publicPerMin) }))] : [],
    controllers: [ElectionsController, AdminLikeController],
    providers: [
      ...(throttled ? [{ provide: APP_GUARD, useClass: ThrottlerGuard }] : []),
      {
        provide: ElectionsService,
        useValue: {
          findAll: jest.fn(async () => [ELECTION_ROW]),
          findOne: jest.fn(async () => ELECTION_ROW),
          comparableManifest: jest.fn(async (_e: unknown, m: unknown) => m),
          getManifest: jest.fn(async () => ({})),
        },
      },
      { provide: ResultsService, useValue: resultsService },
      { provide: ConstituenciesService, useValue: { getPublicAnalysis: jest.fn(async () => []), getConstituencyAnalysisDetail: jest.fn(async () => ({})) } },
      { provide: LiveStateService, useValue: liveState },
      { provide: SnapshotBodyCache, useValue: bodies },
      { provide: SeatAnalysisService, useValue: { summary: jest.fn(async (id: string) => ({ election_id: id, parties: [] })), baseline: jest.fn(async (id: string) => (id === EID ? { election_id: id, seats: [], computed_at: '2027-02-26T10:00:00.000Z' } : null)) } },
    ],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false });
  configureApp(app as NestExpressApplication, env);
  await app.listen(0);
  const base = `${await app.getUrl()}/api/v1`.replace('[::1]', 'localhost');
  return { app, base, live, liveState, resultsService, bodies };
}

describe('CDN-ready live endpoints (HTTP)', () => {
  let ctx: Awaited<ReturnType<typeof makeApp>>;
  beforeAll(async () => (ctx = await makeApp({ TRUST_PROXY_HOPS: '1' })));
  afterAll(() => ctx.app.close());
  beforeEach(() => {
    ctx.live.version = 100;
    ctx.live.status = 'Live';
    ctx.bodies.clear();
    jest.clearAllMocks();
  });

  const get = (path: string, init: RequestInit = {}) => fetch(`${ctx.base}${path}`, { redirect: 'manual', ...init });

  it('GET /elections/:id/live → { version, updatedAt, declared, total } with the poll cache policy', async () => {
    const res = await get(`/elections/${EID}/live`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.LIVE);
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=5, stale-while-revalidate=10');
    expect(await res.json()).toEqual({ success: true, data: { version: 100, status: 'Live', updatedAt: '2026-09-30T00:00:00.000Z', declared: 2, total: 243 } });
  });

  it('public election DTOs expose tentative_next_date (the poller relies on it) and nothing internal', async () => {
    const list = (await (await get('/elections')).json()).data;
    expect(list[0].tentative_next_date).toBe('2029-05-01T00:00:00.000Z');
    expect(list[0]).not.toHaveProperty('secret_internal');
    const one = (await (await get(`/elections/${EID}`)).json()).data;
    expect(one.delimitation).toBe('2008');
    expect(one.tentative_next_date).toBe('2029-05-01T00:00:00.000Z');
  });

  it('GET /elections/:id/constituencies/:constId/rounds returns the seat timeline with the short results cache', async () => {
    const res = await get(`/elections/${EID}/constituencies/A/rounds`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.RESULTS_LATEST);
    expect((await res.json()).data).toEqual([{ seq: 1, r: 1, rt: 20, lp: 'BJP', m: 120, v: 900, declared: false, at: '2027-02-27T04:00:00.000Z' }]);
  });

  it('GET /elections/:id/baseline returns the baseline with the public cache policy', async () => {
    const res = await get(`/elections/${EID}/baseline`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.PUBLIC);
    expect((await res.json()).data).toEqual({ election_id: EID, seats: [], computed_at: '2027-02-26T10:00:00.000Z' });
  });

  it('GET /elections/:id/analysis/summary returns the stored ElectionAnalysis', async () => {
    const res = await get(`/elections/${EID}/analysis/summary`);
    expect(res.status).toBe(200);
    expect((await res.json()).data).toEqual({ election_id: EID, parties: [] });
  });

  it('/live is CDN-cached 30 s while not counting (Upcoming/Finalized)', async () => {
    for (const status of ['Upcoming', 'Finalized']) {
      ctx.live.status = status;
      const res = await get(`/elections/${EID}/live`);
      expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.LIVE_IDLE);
      expect((await res.json()).data.status).toBe(status);
    }
  });

  it('requests with an Authorization header (admin) are never stored by shared caches', async () => {
    const auth = { headers: { Authorization: 'Bearer x' } };
    for (const path of ['/elections', `/elections/${EID}/live`, `/elections/${EID}/results`, `/elections/${EID}/results?v=100`]) {
      expect((await get(path, auth)).headers.get('cache-control')).toBe('no-store');
    }
  });

  it('a snapshot whose version moved on (read consistently) is served no-store, never immutable under v', async () => {
    ctx.resultsService.getSnapshot.mockImplementationOnce(async () => ({ version: 101, results: [], summary: [], voteShare: [] }));
    const res = await get(`/elections/${EID}/results?v=100`);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).data.version).toBe(101);
  });

  it('success bodies carry no requestId/timestamp; X-Request-ID and Date are headers; identical bodies twice', async () => {
    const a = await get(`/elections/${EID}/live`);
    const b = await get(`/elections/${EID}/live`);
    const [ta, tb] = [await a.text(), await b.text()];
    expect(ta).toBe(tb);
    expect(ta).not.toMatch(/requestId|timestamp/);
    expect(a.headers.get('x-request-id')).toBeTruthy();
    expect(a.headers.get('x-request-id')).not.toBe(b.headers.get('x-request-id'));
    expect(a.headers.get('date')).toBeTruthy();
    expect(a.headers.get('etag')).toBe(b.headers.get('etag'));
  });

  it('results?v=<current> → snapshot, immutable', async () => {
    const res = await get(`/elections/${EID}/results?v=100`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    const body = await res.json();
    expect(body.data.version).toBe(100);
    expect(body.data.results).toHaveLength(1);
    expect(Object.keys(body.data).sort()).toEqual(['results', 'summary', 'version', 'voteShare']);
    expect(ctx.resultsService.getSnapshot).toHaveBeenCalledWith(EID, 100);
  });

  /** Raw HTTP GET (no automatic decompression), to see exactly what the CDN receives. */
  function raw(path: string, headers: Record<string, string> = {}): Promise<{ status: number; headers: Record<string, any>; body: Buffer }> {
    return new Promise((resolve, reject) => {
      const u = new URL(`${ctx.base}${path}`);
      httpRequest({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
      }).on('error', reject).end();
    });
  }

  it('results?v=<current>: the gzipped body is built once per version and replayed byte-identical (same ETag, 304s)', async () => {
    const { gunzipSync } = require('zlib');
    const a = await raw(`/elections/${EID}/results?v=100`, { 'Accept-Encoding': 'gzip, br' });
    const b = await raw(`/elections/${EID}/results?v=100`, { 'Accept-Encoding': 'gzip' });
    expect(ctx.resultsService.getSnapshot).toHaveBeenCalledTimes(1);
    for (const r of [a, b]) {
      expect(r.status).toBe(200);
      expect(r.headers['content-encoding']).toBe('gzip');
      expect(r.headers['vary']).toMatch(/Accept-Encoding/i);
      expect(r.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(r.headers['cache-control']).toBe(CACHE_CONTROL.IMMUTABLE);
      expect(r.headers['access-control-allow-origin']).toBe('*');
    }
    expect(a.body.equals(b.body)).toBe(true);
    expect(a.headers['etag']).toBe(b.headers['etag']);
    const body = JSON.parse(gunzipSync(a.body).toString('utf8'));
    expect(body).toEqual({ success: true, data: { version: 100, results: expect.any(Array), summary: [], voteShare: [] } });
    const plain = await raw(`/elections/${EID}/results?v=100`, { 'Accept-Encoding': 'identity' });
    expect(plain.headers['content-encoding']).toBeUndefined();
    expect(JSON.parse(plain.body.toString('utf8'))).toEqual(body);
    expect(plain.headers['etag']).not.toBe(a.headers['etag']);
    const notModified = await raw(`/elections/${EID}/results?v=100`, { 'Accept-Encoding': 'gzip', 'If-None-Match': a.headers['etag'] });
    expect(notModified.status).toBe(304);
    expect(ctx.resultsService.getSnapshot).toHaveBeenCalledTimes(1);
  });

  it('a snapshot that moved on is not kept: the next request for v loads again', async () => {
    ctx.resultsService.getSnapshot.mockImplementationOnce(async () => ({ version: 101, results: [], summary: [], voteShare: [] }));
    expect((await get(`/elections/${EID}/results?v=100`)).headers.get('cache-control')).toBe('no-store');
    expect((await get(`/elections/${EID}/results?v=100`)).headers.get('cache-control')).toBe(CACHE_CONTROL.IMMUTABLE);
    expect(ctx.resultsService.getSnapshot).toHaveBeenCalledTimes(2);
  });

  describe('finished elections: unversioned election reads get the long CDN TTL', () => {
    const reads = [
      `/elections/${EID}`, `/elections/${EID}/manifest`, `/elections/${EID}/results`, `/elections/${EID}/alliances`,
      `/elections/${EID}/vote-share`, `/elections/${EID}/region-shares`, `/elections/${EID}/baseline`,
      `/elections/${EID}/analysis/summary`, `/elections/${EID}/analysis`, `/elections/${EID}/constituencies/A/analysis`,
      `/elections/${EID}/districts/3/results`, `/elections/${EID}/constituencies/A/rounds`, `/elections/${EID}/constituencies/A`,
      `/elections/${EID}/compare?from=A&to=B`,
    ];
    it('Finalized → s-maxage=3600, stale-while-revalidate=86400', async () => {
      ctx.live.status = 'Finalized';
      expect(CACHE_CONTROL.FINISHED).toBe('public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
      for (const path of reads) {
        const res = await get(path);
        expect([path, res.status, res.headers.get('cache-control')]).toEqual([path, 200, CACHE_CONTROL.FINISHED]);
      }
    });
    it('Live: results, seat detail and rounds use the short results TTL; the rest keep the default', async () => {
      const short = new Set([`/elections/${EID}/results`, `/elections/${EID}/constituencies/A/rounds`, `/elections/${EID}/constituencies/A`]);
      for (const path of reads) {
        const res = await get(path);
        expect([path, res.headers.get('cache-control')]).toEqual([path, short.has(path) ? CACHE_CONTROL.RESULTS_LATEST : CACHE_CONTROL.PUBLIC]);
      }
    });
    it('Upcoming: the default policy (rounds keep the short one)', async () => {
      ctx.live.status = 'Upcoming';
      for (const path of reads) {
        const res = await get(path);
        const want = path.endsWith('/rounds') ? CACHE_CONTROL.RESULTS_LATEST : CACHE_CONTROL.PUBLIC;
        expect([path, res.headers.get('cache-control')]).toEqual([path, want]);
      }
    });
    it('/live keeps its own policy when Finalized', async () => {
      ctx.live.status = 'Finalized';
      expect((await get(`/elections/${EID}/live`)).headers.get('cache-control')).toBe(CACHE_CONTROL.LIVE_IDLE);
    });
  });

  describe('seat detail ?v= (versioned like results?v=)', () => {
    const seat = (q = '') => get(`/elections/${EID}/constituencies/A${q}`);
    it('v = current while Live → immutable, mapped through the public DTO', async () => {
      const res = await seat('?v=100');
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.IMMUTABLE);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data.id).toBe('A');
      expect(body.data).not.toHaveProperty('secret');
    });
    it('v = current but the version moved while reading → no-store (never labelled with a version it may not match)', async () => {
      ctx.liveState.currentVersion.mockResolvedValueOnce(101);
      const res = await seat('?v=100');
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
    });
    it('v older → short-cached 302 to the current version, nothing loaded', async () => {
      const res = await seat('?v=99');
      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(`/api/v1/elections/${EID}/constituencies/A?v=100`);
      expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.REDIRECT);
      expect(ctx.resultsService.getConstituencyDetail).not.toHaveBeenCalled();
    });
    it('v newer than current → 404 no-store, nothing loaded', async () => {
      const res = await seat('?v=101');
      expect(res.status).toBe(404);
      expect(res.headers.get('cache-control')).toBe('no-store');
      // Its own code: the page retries instead of saying the seat does not exist.
      expect((await res.json()).error.code).toBe('GEN_0006');
      expect(ctx.resultsService.getConstituencyDetail).not.toHaveBeenCalled();
    });
    it('not counting: v = current is not immutable (photos/affidavits can change without a version bump)', async () => {
      ctx.live.status = 'Finalized';
      expect((await seat('?v=100')).headers.get('cache-control')).toBe(CACHE_CONTROL.FINISHED);
      ctx.live.status = 'Upcoming';
      expect((await seat('?v=100')).headers.get('cache-control')).toBe(CACHE_CONTROL.PUBLIC);
    });
    it('an unknown seat is a 404 no-store; v=abc is a 400', async () => {
      ctx.resultsService.getConstituencyDetail.mockRejectedValueOnce(new NotFoundException());
      const missing = await seat('?v=100');
      expect(missing.status).toBe(404);
      expect(missing.headers.get('cache-control')).toBe('no-store');
      expect((await seat('?v=abc')).status).toBe(400);
    });
  });

  it('results?v=<older> → short-cached 302 to the current version, never old data', async () => {
    const res = await get(`/elections/${EID}/results?v=99`);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe(`/api/v1/elections/${EID}/results?v=100`);
    expect(res.headers.get('cache-control')).toBe(CACHE_CONTROL.REDIRECT);
    expect(ctx.resultsService.getSnapshot).not.toHaveBeenCalled();
  });

  it('a browser fetch follows the redirect to the current snapshot', async () => {
    const res = await fetch(`${ctx.base}/elections/${EID}/results?v=1`);
    expect(res.status).toBe(200);
    expect(new URL(res.url).searchParams.get('v')).toBe('100');
    expect((await res.json()).data.version).toBe(100);
  });

  it('results?v=<newer than current> (a poll raced ahead of this instance) → cheap 404 no-store, no snapshot load', async () => {
    const res = await get(`/elections/${EID}/results?v=101`);
    expect(res.status).toBe(404);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect((await res.json()).error.code).toBe('GEN_0006');
    expect(ctx.resultsService.getSnapshot).not.toHaveBeenCalled();
  });

  it('results without v → the unchanged rows array, short CDN cache', async () => {
    const res = await get(`/elections/${EID}/results`);
    expect(res.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=10, stale-while-revalidate=30');
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(Object.keys(body).sort()).toEqual(['data', 'success']);
  });

  it('results?v=abc → 400 no-store', async () => {
    const res = await get(`/elections/${EID}/results?v=abc`);
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('other public GETs get the default public policy; errors are no-store', async () => {
    const ok = await get('/elections');
    expect(ok.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    ctx.liveState.get.mockRejectedValueOnce(new NotFoundException());
    const missing = await get(`/elections/${EID}/live`);
    expect(missing.status).toBe(404);
    expect(missing.headers.get('cache-control')).toBe('no-store');
    expect((await missing.json()).error.requestId).toBeTruthy();
  });

  it('routes without a policy (admin/auth/health) are no-store', async () => {
    const res = await get('/admin/thing');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('public reads answer CORS with *, admin keeps the allowlist; Retry-After is exposed', async () => {
    const pub = await get(`/elections/${EID}/live`, { headers: { Origin: 'http://localhost:3080' } });
    expect(pub.headers.get('access-control-allow-origin')).toBe('*');
    expect(pub.headers.get('access-control-expose-headers')).toBe('Retry-After,X-Request-ID');
    const adm = await get('/admin/thing', { headers: { Origin: 'http://localhost:3081' } });
    expect(adm.headers.get('access-control-allow-origin')).toBe('http://localhost:3081');
  });
});

describe('viewer polling is not rate-limited at origin (the CDN rate-limits)', () => {
  let ctx: Awaited<ReturnType<typeof makeApp>>;
  beforeAll(async () => (ctx = await makeApp({ TRUST_PROXY_HOPS: '1' }, { publicPerMin: 3 })));
  afterAll(() => ctx.app.close());
  const get = (path: string) => fetch(`${ctx.base}${path}`, { redirect: 'manual', headers: { 'X-Forwarded-For': '198.51.100.9' } });

  it('/live and /results (with and without ?v=) never answer 429 from one IP', async () => {
    for (let i = 0; i < 6; i++) {
      for (const path of [`/elections/${EID}/live`, `/elections/${EID}/results?v=100`, `/elections/${EID}/results`]) {
        expect((await get(path)).status).toBe(200);
      }
    }
  });

  it('other election reads still count against the public throttler', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await get(`/elections/${EID}/analysis/summary`)).status);
    expect(statuses).toContain(429);
  });
});

describe('client IP behind Cloudflare', () => {
  it('TRUST_CF_CONNECTING_IP=true: req.ip is CF-Connecting-IP (when valid)', async () => {
    const { app, base } = await makeApp({ TRUST_PROXY_HOPS: '1', TRUST_CF_CONNECTING_IP: 'true', ORIGIN_SHARED_SECRETS: 'sec' });
    try {
      const ip = async (headers: Record<string, string>) =>
        (await (await fetch(`${base}/admin/thing`, { headers: { ...headers, 'X-Origin-Secret': 'sec' } })).json()).data.ip;
      expect(await ip({ 'CF-Connecting-IP': '203.0.113.5', 'X-Forwarded-For': '203.0.113.5, 172.64.0.1' })).toBe('203.0.113.5');
      expect(await ip({ 'CF-Connecting-IP': '2001:db8::1' })).toBe('2001:db8::1');
      expect(await ip({ 'CF-Connecting-IP': 'not-an-ip', 'X-Forwarded-For': '198.51.100.7' })).toBe('198.51.100.7');
    } finally {
      await app.close();
    }
  });

  it('without it, CF-Connecting-IP is ignored (X-Forwarded-For + TRUST_PROXY_HOPS)', async () => {
    const { app, base } = await makeApp({ TRUST_PROXY_HOPS: '1' });
    try {
      const res = await fetch(`${base}/admin/thing`, { headers: { 'CF-Connecting-IP': '203.0.113.5', 'X-Forwarded-For': '198.51.100.7' } });
      expect((await res.json()).data.ip).toBe('198.51.100.7');
    } finally {
      await app.close();
    }
  });
});

describe('applyCacheControl', () => {
  const { applyCacheControl } = require('../../common/http/cache-control');
  function res(headers: Record<string, string>) {
    const h = { ...headers } as Record<string, string>;
    return {
      h,
      setHeader: (k: string, v: string) => (h[k.toLowerCase()] = v),
      getHeaderNames: () => Object.keys(h),
      removeHeader: (k: string) => delete h[k.toLowerCase()],
    };
  }

  it('drops per-client X-RateLimit-* headers from publicly cacheable responses', () => {
    const r = res({ 'x-ratelimit-limit-public': '600', 'x-ratelimit-remaining-public': '599', 'x-request-id': 'a' });
    applyCacheControl({ headers: {} }, r, CACHE_CONTROL.PUBLIC);
    expect(r.h['cache-control']).toBe(CACHE_CONTROL.PUBLIC);
    expect(Object.keys(r.h).filter((k) => k.startsWith('x-ratelimit'))).toEqual([]);
    expect(r.h['x-request-id']).toBe('a');
  });

  it('keeps them on no-store responses and forces no-store with Authorization', () => {
    const r = res({ 'x-ratelimit-limit-public': '600' });
    applyCacheControl({ headers: { authorization: 'Bearer t' } }, r, CACHE_CONTROL.PUBLIC);
    expect(r.h['cache-control']).toBe('no-store');
    expect(r.h['x-ratelimit-limit-public']).toBe('600');
  });
});
