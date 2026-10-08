const WINDOW_MS = 60_000;
const DEFAULT_LIMIT = 10;
const DEFAULT_MAX_ENTRIES = 10_000;

export const readAuthFailLimit = (env: Record<string, string | undefined>): number => {
  const n = Number(env.INGEST_AUTH_FAIL_LIMIT);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_LIMIT;
};

/**
 * Failed ingest key checks per client IP, in a fixed one-minute window (in memory, per instance: Redis is optional and
 * the ingest routes skip the throttlers). Fed by the pre-parser gate (malformed Authorization) and by IngestKeyGuard
 * (unknown, revoked or expired key); once an IP reaches the limit, the gate answers 429 before parsing any body.
 * A key verified recently on this instance is let through anyway (IngestKeysService.recentlyValid), so an attacker
 * sharing the worker's egress IP cannot lock the worker out.
 */
export class IngestAuthLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();
  constructor(private readonly limit = DEFAULT_LIMIT, private readonly maxEntries = DEFAULT_MAX_ENTRIES) {}

  get size(): number { return this.hits.size; }

  private current(ip: string, now: number) {
    const h = this.hits.get(ip);
    return h && now - h.start < WINDOW_MS ? h : null;
  }

  blocked(ip: string, now = Date.now()): boolean {
    return (this.current(ip, now)?.count ?? 0) >= this.limit;
  }

  /** Seconds until the IP's window ends (for Retry-After). */
  retryAfterS(ip: string, now = Date.now()): number {
    const h = this.current(ip, now);
    return h ? Math.max(1, Math.ceil((h.start + WINDOW_MS - now) / 1000)) : 1;
  }

  fail(ip: string, now = Date.now()): void {
    const h = this.current(ip, now);
    if (h) { h.count++; return; }
    this.hits.delete(ip);
    if (this.hits.size >= this.maxEntries) this.evict(now);
    this.hits.set(ip, { start: now, count: 1 });
  }

  /** Drop ended windows; if still over 90 % full, the oldest entries (Map order = insertion order), so a spray of
   *  addresses pays this scan once per 10 % of the map, not on every insert. */
  private evict(now: number) {
    for (const [ip, h] of this.hits) if (now - h.start >= WINDOW_MS) this.hits.delete(ip);
    const target = Math.floor(this.maxEntries * 0.9);
    for (const ip of this.hits.keys()) {
      if (this.hits.size <= target) break;
      this.hits.delete(ip);
    }
  }
}
