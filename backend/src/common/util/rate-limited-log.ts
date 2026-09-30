/**
 * Lets a log line through at most once per interval per key, so a dependency
 * outage (e.g. Redis down) produces one line a minute instead of one per request.
 */
export class RateLimitedLog {
  private readonly last = new Map<string, number>();

  constructor(
    private readonly intervalMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** True when the caller should log now; counts suppressed calls. */
  shouldLog(key: string): boolean {
    const t = this.now();
    const prev = this.last.get(key);
    if (prev !== undefined && t - prev < this.intervalMs) return false;
    this.last.set(key, t);
    return true;
  }
}
