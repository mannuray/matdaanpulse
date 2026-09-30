/**
 * Load test for CDN-ready live (docs/DEPLOYMENT.md §2.2, §5.6).
 *
 * Simulates N dashboard viewers running the browser's polling algorithm against
 * a base URL (the CDN hostname in a real test, localhost for a smoke run):
 *   poll GET /elections/:id/live every 10 s + random 0–3 s; on a version change
 *   wait random 0–2 s, then GET /elections/:id/results?v=<version> (redirects are
 *   followed); on errors back off exponentially with jitter (max 60 s), never
 *   sooner than Retry-After.
 * Before and after, it reads the origin's own request counters from
 * GET /admin/status (SUPER_ADMIN) so the origin load can be compared with the
 * number of simulated requests. Run the live replay (npm run sim:replay) at the
 * same time to exercise version changes.
 *
 * Usage:
 *   npx ts-node src/loadtest/viewers.ts --viewers 200 --duration 120 \
 *     [--base https://api.<domain>/api/v1] [--status-base https://api.<domain>/api/v1] \
 *     [--election <uuid>] [--ramp 13]
 * Auth for /admin/status: LOADTEST_ADMIN_TOKEN, else one login with
 * SIM_ADMIN_EMAIL/SIM_ADMIN_PASSWORD or ADMIN_EMAIL/ADMIN_PASSWORD (env). Without
 * credentials the origin counters are skipped.
 *
 * Note: from one machine every viewer shares one IP, so against the origin
 * directly keep viewers × ~5 polls/min under THROTTLE_PUBLIC_PER_MIN (600).
 */

const POLL_MS = 10_000;
const POLL_JITTER_MS = 3_000;
const SNAPSHOT_JITTER_MS = 2_000;
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 60_000;

interface Args {
  base: string;
  statusBase: string;
  election: string;
  viewers: number;
  durationS: number;
  rampS: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const base = (get('base') ?? process.env.API_BASE_URL ?? 'http://localhost:3082/api/v1').replace(/\/$/, '');
  return {
    base,
    statusBase: (get('status-base') ?? base).replace(/\/$/, ''),
    election: get('election') ?? 'c3d4e5f6-a7b8-9012-cdef-234567890abc',
    viewers: Number(get('viewers') ?? 20),
    durationS: Number(get('duration') ?? 60),
    rampS: Number(get('ramp') ?? 13),
  };
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

class Stats {
  live = 0;
  snapshots = 0;
  redirects = 0;
  byStatus = new Map<number, number>();
  errors = 0;
  liveMs: number[] = [];
  versions = new Set<number>();

  count(status: number) {
    this.byStatus.set(status, (this.byStatus.get(status) ?? 0) + 1);
  }
}

function pct(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.ceil(p * s.length) - 1)]);
}

function retryAfterMs(res: Response): number | undefined {
  const v = res.headers.get('retry-after');
  if (!v) return undefined;
  if (/^\d+$/.test(v.trim())) return Number(v) * 1000;
  const at = Date.parse(v);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
}

function backoff(failures: number, retryAfter?: number): number {
  const cap = Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(1, failures));
  const delay = cap / 2 + Math.random() * (cap / 2);
  return retryAfter ? Math.max(delay, retryAfter) : delay;
}

async function viewer(args: Args, stats: Stats, deadline: number) {
  let version: number | null = null;
  let failures = 0;
  await sleep(Math.random() * args.rampS * 1000);
  while (Date.now() < deadline) {
    let wait = POLL_MS + Math.random() * POLL_JITTER_MS;
    try {
      const t0 = Date.now();
      const res: Response = await fetch(`${args.base}/elections/${args.election}/live`);
      stats.live++;
      stats.count(res.status);
      stats.liveMs.push(Date.now() - t0);
      if (!res.ok) throw Object.assign(new Error(`live ${res.status}`), { retryAfter: retryAfterMs(res) });
      const live = ((await res.json()) as { data: { version: number } }).data;
      if (live.version !== version) {
        if (version !== null) await sleep(Math.random() * SNAPSHOT_JITTER_MS);
        const snap: Response = await fetch(`${args.base}/elections/${args.election}/results?v=${live.version}`);
        stats.snapshots++;
        if (snap.redirected) stats.redirects++;
        stats.count(snap.status);
        if (!snap.ok) throw Object.assign(new Error(`snapshot ${snap.status}`), { retryAfter: retryAfterMs(snap) });
        version = ((await snap.json()) as { data: { version: number } }).data.version;
        stats.versions.add(version);
      }
      failures = 0;
    } catch (err) {
      stats.errors++;
      failures++;
      wait = backoff(failures, (err as { retryAfter?: number }).retryAfter);
    }
    await sleep(Math.min(wait, Math.max(0, deadline - Date.now())));
  }
}

async function adminToken(statusBase: string): Promise<string | null> {
  if (process.env.LOADTEST_ADMIN_TOKEN) return process.env.LOADTEST_ADMIN_TOKEN;
  const email = process.env.SIM_ADMIN_EMAIL || process.env.ADMIN_EMAIL;
  const password = process.env.SIM_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  const res = await fetch(`${statusBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return null;
  return ((await res.json()) as { data: { access_token: string } }).data.access_token;
}

interface OriginStatus {
  http: { total: number; byClass: Record<string, number>; throttled429: number };
  cache: { hits: number; misses: number };
}

async function originStatus(statusBase: string, token: string | null): Promise<OriginStatus | null> {
  if (!token) return null;
  const res = await fetch(`${statusBase}/admin/status`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return ((await res.json()) as { data: OriginStatus }).data;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(`Load test: ${args.viewers} viewers for ${args.durationS}s against ${args.base} (election ${args.election})`);
  const token = await adminToken(args.statusBase);
  const before = await originStatus(args.statusBase, token);
  if (!before) console.log('Origin counters: unavailable (no admin credentials or /admin/status not reachable)');

  const stats = new Stats();
  const started = Date.now();
  const deadline = started + args.durationS * 1000;
  await Promise.all(Array.from({ length: args.viewers }, () => viewer(args, stats, deadline)));
  const elapsedMin = (Date.now() - started) / 60_000;

  const after = await originStatus(args.statusBase, token);
  const clientRequests = stats.live + stats.snapshots;
  const statuses = [...stats.byStatus.entries()].sort(([a], [b]) => a - b).map(([s, n]) => `${s}:${n}`).join(' ');
  console.log('');
  console.log('Client side (simulated viewers)');
  console.log(`  requests      ${clientRequests} (${Math.round(clientRequests / elapsedMin)}/min): /live ${stats.live}, snapshots ${stats.snapshots} (${stats.redirects} via redirect)`);
  console.log(`  statuses      ${statuses || '-'}; failed attempts ${stats.errors}`);
  console.log(`  /live latency p50 ${pct(stats.liveMs, 0.5)} ms, p95 ${pct(stats.liveMs, 0.95)} ms`);
  console.log(`  versions seen ${stats.versions.size}`);
  if (before && after) {
    // The status call itself and the login are included in the delta (a handful of requests).
    const originRequests = after.http.total - before.http.total;
    const hits = after.cache.hits - before.cache.hits;
    const misses = after.cache.misses - before.cache.misses;
    console.log('Origin side (/admin/status delta)');
    console.log(`  requests      ${originRequests} (${Math.round(originRequests / elapsedMin)}/min), 5xx ${(after.http.byClass['5xx'] ?? 0) - (before.http.byClass['5xx'] ?? 0)}, 429 ${after.http.throttled429 - before.http.throttled429}`);
    console.log(`  Redis cache   hits ${hits}, misses ${misses}`);
    console.log(`  origin/client ${(originRequests / Math.max(1, clientRequests)).toFixed(2)} (≈1.00 = no CDN in front; behind the CDN it should fall as viewers grow)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
