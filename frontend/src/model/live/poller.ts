/**
 * Live results for viewers (docs/DEPLOYMENT.md §2.2): poll a small, CDN-cached
 * `/elections/:id/live` document and, when its version changes, fetch the
 * versioned (immutable, CDN-cached) snapshot `results?v=<version>`.
 *
 * - the cadence follows the election status reported by `/live`:
 *   Upcoming → every 60 s + random 0–15 s, `/live` only (a page opened before
 *   counting picks it up by itself); Live → every 10 s + random 0–3 s with
 *   snapshots; Finalized → fetch the final snapshot (if newer) and stop;
 * - paused while the tab is hidden, and polled immediately when it becomes
 *   visible again (at most once per 2 s);
 * - only moves forward: a snapshot is fetched only for a version newer than the
 *   one shown, and an older snapshot (a stale CDN colo) is dropped — the map never
 *   goes back and the ticker never replays reversed events;
 * - on a version change wait random 0–2 s (spreads the herd), then fetch the
 *   snapshot once; the first snapshot is fetched without waiting;
 * - on errors: exponential backoff with jitter (max 60 s), never shorter than
 *   the server's Retry-After.
 *
 * Pure: no React, no DOM access — timers, randomness and visibility are injected.
 */

export type LiveElectionStatus = 'Upcoming' | 'Live' | 'Finalized';

export interface LiveState {
  version: number;
  status: LiveElectionStatus;
  updatedAt: string;
  declared: number;
  total: number;
}

export const POLL = {
  intervalMs: 10_000,
  intervalJitterMs: 3_000,
  upcomingIntervalMs: 60_000,
  upcomingJitterMs: 15_000,
  /** Visibility changes poll at most this often (rapid tab switching). */
  minVisiblePollGapMs: 2_000,
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
  /** Every successful `/live` response (the current election status). */
  onLive?(live: LiveState): void;
  /** true after a successful poll; false after a failed one, with the consecutive failure count and error. */
  onStatus?(ok: boolean, failures: number, error?: unknown): void;
  random?: () => number;
  now?: () => number;
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
  private readonly now: () => number;
  private lastPollAt = -Infinity;

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
    this.now = deps.now ?? (() => Date.now());
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.unsubscribe = this.visibility.subscribe(() => this.onVisibilityChange());
    void this.tick();
  }

  /** Poll now (e.g. a Retry button): resets the backoff; no-op while a request is in flight or after stop(). */
  pollNow(): void {
    if (!this.running || this.busy) return;
    this.failures = 0;
    this.cancelTimer();
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
    if (!this.paused && this.now() - this.lastPollAt < POLL.minVisiblePollGapMs) return;
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
    this.lastPollAt = this.now();
    const run = this.run;
    try {
      const live = await this.deps.fetchLive();
      if (run !== this.run) return;
      this.deps.onLive?.(live);
      if (live.status === 'Upcoming') {
        this.succeeded();
        this.schedule(POLL.upcomingIntervalMs + this.random() * POLL.upcomingJitterMs);
        return;
      }
      if (this.version === null || live.version > this.version) {
        if (this.version !== null) {
          await this.sleep(this.random() * POLL.snapshotJitterMs);
          if (run !== this.run) return;
        }
        const snapshot = await this.deps.fetchSnapshot(live.version).catch((err) => {
          // The server has not reached this version yet (a poll raced ahead of it): not a failure, try next poll.
          if (isVersionNotReady(err)) return null;
          throw err;
        });
        if (run !== this.run) return;
        // Forward only: a stale colo may still redirect/serve an older version.
        if (snapshot && (this.version === null || snapshot.version > this.version)) {
          this.version = snapshot.version;
          this.deps.onSnapshot(snapshot, live);
        }
      }
      this.succeeded();
      if (live.status === 'Finalized') {
        // Final results are in: nothing more to poll for.
        this.stop();
        return;
      }
      this.schedule(POLL.intervalMs + this.random() * POLL.intervalJitterMs);
    } catch (err) {
      if (run !== this.run) return;
      this.failures++;
      this.deps.onStatus?.(false, this.failures, err);
      const retryAfterMs = (err as { retryAfterMs?: number } | null)?.retryAfterMs;
      this.schedule(backoffDelay(this.failures, this.random, retryAfterMs));
    } finally {
      if (run === this.run) this.busy = false;
    }
  }

  private succeeded(): void {
    this.failures = 0;
    this.deps.onStatus?.(true, 0);
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

/** Days around `tentative_next_date` in which an Upcoming election's page polls for the flip to Live. */
export const UPCOMING_POLL_WINDOW = { beforeDays: 3, afterDays: 60 } as const;

/**
 * Whether a dashboard should run the poller: Live elections always; Finalized never.
 * Upcoming ones poll unless a known tentative date is far away (off-season pages must
 * not keep the API awake) — a missing or unparsable date means "poll", so a page opened
 * before counting always picks up the flip to Live.
 */
export function shouldPoll(
  election: { status: LiveElectionStatus; tentative_next_date: string | null },
  now: number = Date.now(),
): boolean {
  if (election.status === 'Live') return true;
  if (election.status !== 'Upcoming') return false;
  if (!election.tentative_next_date) return true;
  const at = Date.parse(election.tentative_next_date);
  if (Number.isNaN(at)) return true;
  const day = 86_400_000;
  return now >= at - UPCOMING_POLL_WINDOW.beforeDays * day && now <= at + UPCOMING_POLL_WINDOW.afterDays * day;
}

/** 404 GEN_0006 from `results?v=` / seat `?v=`: that version is not on this server yet (retry), unlike a real 404. */
export function isVersionNotReady(err: unknown): boolean {
  const e = err as { status?: number; code?: string } | null;
  return e?.status === 404 && e.code === 'GEN_0006';
}
