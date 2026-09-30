/**
 * Live results for viewers (docs/DEPLOYMENT.md §2.2): poll a small, CDN-cached
 * `/elections/:id/live` document and, when its version changes, fetch the
 * versioned (immutable, CDN-cached) snapshot `results?v=<version>`.
 *
 * - poll every 10 s + random 0–3 s; paused while the tab is hidden, and polled
 *   immediately when it becomes visible again;
 * - on a version change wait random 0–2 s (spreads the herd), then fetch the
 *   snapshot once; the first snapshot is fetched without waiting;
 * - on errors: exponential backoff with jitter (max 60 s), never shorter than
 *   the server's Retry-After.
 *
 * Pure: no React, no DOM access — timers, randomness and visibility are injected.
 */

export interface LiveState {
  version: number;
  updatedAt: string;
  declared: number;
  total: number;
}

export const POLL = {
  intervalMs: 10_000,
  intervalJitterMs: 3_000,
  snapshotJitterMs: 2_000,
  backoffBaseMs: 5_000,
  backoffMaxMs: 60_000,
  retryAfterMaxMs: 600_000,
} as const;

export interface Visibility {
  isHidden(): boolean;
  /** Called on every visibility change; returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void;
}

type TimerHandle = ReturnType<typeof setTimeout>;

export interface LivePollerDeps<S extends { version: number }> {
  fetchLive(): Promise<LiveState>;
  fetchSnapshot(version: number): Promise<S>;
  onSnapshot(snapshot: S, live: LiveState): void;
  /** true after a successful poll, false after a failed one. */
  onStatus?(ok: boolean): void;
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => TimerHandle;
  clearTimer?: (handle: TimerHandle) => void;
  visibility?: Visibility;
}

/** Delay before retry number `failures` (1-based): equal jitter in [cap/2, cap], cap = 5 s × 2^n ≤ 60 s. */
export function backoffDelay(failures: number, random: () => number = Math.random, retryAfterMs?: number): number {
  const cap = Math.min(POLL.backoffMaxMs, POLL.backoffBaseMs * 2 ** Math.max(1, failures));
  const delay = Math.round(cap / 2 + random() * (cap / 2));
  if (retryAfterMs === undefined || !Number.isFinite(retryAfterMs) || retryAfterMs <= 0) return delay;
  return Math.max(delay, Math.min(retryAfterMs, POLL.retryAfterMaxMs));
}

const NEVER_HIDDEN: Visibility = { isHidden: () => false, subscribe: () => () => undefined };

export class LivePoller<S extends { version: number }> {
  private readonly random: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => TimerHandle;
  private readonly clearTimer: (handle: TimerHandle) => void;
  private readonly visibility: Visibility;

  private version: number | null = null;
  private failures = 0;
  private timer: TimerHandle | undefined;
  private running = false;
  private busy = false;
  private paused = false;
  /** Bumped by stop(); responses from an older run are ignored. */
  private run = 0;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly deps: LivePollerDeps<S>) {
    this.random = deps.random ?? Math.random;
    this.setTimer = deps.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = deps.clearTimer ?? ((h) => clearTimeout(h));
    this.visibility = deps.visibility ?? NEVER_HIDDEN;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.unsubscribe = this.visibility.subscribe(() => this.onVisibilityChange());
    void this.tick();
  }

  stop(): void {
    this.running = false;
    this.run++;
    this.cancelTimer();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.busy = false;
    this.paused = false;
  }

  private onVisibilityChange(): void {
    if (!this.running || this.visibility.isHidden()) return;
    // Back in view: poll now, unless a request is in flight or we are backing off after errors.
    if (this.busy || (this.failures > 0 && !this.paused)) return;
    this.cancelTimer();
    void this.tick();
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    if (this.visibility.isHidden()) {
      this.paused = true;
      return;
    }
    this.paused = false;
    this.busy = true;
    const run = this.run;
    try {
      const live = await this.deps.fetchLive();
      if (run !== this.run) return;
      if (live.version !== this.version) {
        if (this.version !== null) {
          await this.sleep(this.random() * POLL.snapshotJitterMs);
          if (run !== this.run) return;
        }
        const snapshot = await this.deps.fetchSnapshot(live.version);
        if (run !== this.run) return;
        this.version = snapshot.version;
        this.deps.onSnapshot(snapshot, live);
      }
      this.failures = 0;
      this.deps.onStatus?.(true);
      this.schedule(POLL.intervalMs + this.random() * POLL.intervalJitterMs);
    } catch (err) {
      if (run !== this.run) return;
      this.failures++;
      this.deps.onStatus?.(false);
      const retryAfterMs = (err as { retryAfterMs?: number } | null)?.retryAfterMs;
      this.schedule(backoffDelay(this.failures, this.random, retryAfterMs));
    } finally {
      if (run === this.run) this.busy = false;
    }
  }

  private schedule(ms: number): void {
    this.cancelTimer();
    this.timer = this.setTimer(() => {
      this.timer = undefined;
      void this.tick();
    }, ms);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.cancelTimer();
      this.timer = this.setTimer(() => {
        this.timer = undefined;
        resolve();
      }, ms);
    });
  }

  private cancelTimer(): void {
    if (this.timer !== undefined) this.clearTimer(this.timer);
    this.timer = undefined;
  }
}
