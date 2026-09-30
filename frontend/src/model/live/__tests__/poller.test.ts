import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LivePoller, POLL, backoffDelay, shouldPoll, type LiveState, type LiveElectionStatus } from '../poller';

interface Snap { version: number }

function live(version: number, status: LiveElectionStatus = 'Live'): LiveState {
  return { version, status, updatedAt: '2026-09-30T00:00:00Z', declared: 0, total: 10 };
}

function setup(opts: { random?: () => number; hidden?: boolean } = {}) {
  let hidden = opts.hidden ?? false;
  let onVis: (() => void) | null = null;
  let current = 1;
  let status: LiveElectionStatus = 'Live';
  const fetchLive = vi.fn(async () => live(current, status));
  const fetchSnapshot = vi.fn(async (v: number): Promise<Snap> => ({ version: v }));
  const onSnapshot = vi.fn();
  const onStatus = vi.fn();
  const onLive = vi.fn();
  const poller = new LivePoller<Snap>({
    fetchLive, fetchSnapshot, onSnapshot, onStatus, onLive,
    random: opts.random ?? (() => 0),
    visibility: {
      isHidden: () => hidden,
      subscribe: (cb) => { onVis = cb; return () => { onVis = null; }; },
    },
  });
  return {
    poller, fetchLive, fetchSnapshot, onSnapshot, onStatus, onLive,
    setVersion: (v: number) => { current = v; },
    setStatus: (st: LiveElectionStatus) => { status = st; },
    setHidden: (h: boolean) => { hidden = h; onVis?.(); },
  };
}

/** Let pending promise callbacks run without moving the clock. */
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('LivePoller', () => {
  it('fetches /live and the first snapshot immediately, without the version-change delay', async () => {
    const t = setup();
    t.poller.start();
    await flush();
    expect(t.fetchLive).toHaveBeenCalledTimes(1);
    expect(t.fetchSnapshot).toHaveBeenCalledWith(1);
    expect(t.onSnapshot).toHaveBeenCalledWith({ version: 1 }, live(1));
    expect(t.onStatus).toHaveBeenLastCalledWith(true, 0);
    t.poller.stop();
  });

  it.each([[0, POLL.intervalMs], [0.999, POLL.intervalMs + POLL.intervalJitterMs]])(
    'polls every 10 s + random 0–3 s (random=%s → next poll at %i ms)', async (r, expected) => {
      const t = setup({ random: () => r });
      t.poller.start();
      await flush();
      await vi.advanceTimersByTimeAsync(expected - 5);
      expect(t.fetchLive).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(10);
      expect(t.fetchLive).toHaveBeenCalledTimes(2);
      t.poller.stop();
    });

  it('an unchanged version fetches no snapshot', async () => {
    const t = setup();
    t.poller.start();
    await flush();
    await vi.advanceTimersByTimeAsync(POLL.intervalMs * 3);
    expect(t.fetchLive).toHaveBeenCalledTimes(4);
    expect(t.fetchSnapshot).toHaveBeenCalledTimes(1);
    t.poller.stop();
  });

  it('a version change → one snapshot fetch after a random 0–2 s wait', async () => {
    const t = setup({ random: () => 0.5 });
    t.poller.start();
    await flush();
    t.setVersion(2);
    await vi.advanceTimersByTimeAsync(POLL.intervalMs + 0.5 * POLL.intervalJitterMs);
    expect(t.fetchLive).toHaveBeenCalledTimes(2);
    expect(t.fetchSnapshot).toHaveBeenCalledTimes(1); // waiting 0.5 × 2 s
    await vi.advanceTimersByTimeAsync(0.5 * POLL.snapshotJitterMs);
    expect(t.fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(t.fetchSnapshot).toHaveBeenLastCalledWith(2);
    expect(t.onSnapshot).toHaveBeenLastCalledWith({ version: 2 }, live(2));
    await vi.advanceTimersByTimeAsync(POLL.intervalMs * 2);
    expect(t.fetchSnapshot).toHaveBeenCalledTimes(2);
    t.poller.stop();
  });

  it('records the version the snapshot carries (after a redirect to a newer one)', async () => {
    const t = setup();
    t.fetchSnapshot.mockImplementation(async () => ({ version: 5 }));
    t.poller.start();
    await flush();
    t.setVersion(5);
    await vi.advanceTimersByTimeAsync(POLL.intervalMs);
    expect(t.fetchSnapshot).toHaveBeenCalledTimes(1);
    t.poller.stop();
  });

  it('pauses while the tab is hidden and polls immediately when it becomes visible', async () => {
    const t = setup();
    t.poller.start();
    await flush();
    await vi.advanceTimersByTimeAsync(POLL.minVisiblePollGapMs);
    t.setHidden(true);
    await vi.advanceTimersByTimeAsync(POLL.intervalMs * 6);
    expect(t.fetchLive).toHaveBeenCalledTimes(1);
    t.setHidden(false);
    await flush();
    expect(t.fetchLive).toHaveBeenCalledTimes(2);
    t.poller.stop();
  });

  it('does not start polling in a hidden tab until it is shown', async () => {
    const t = setup({ hidden: true });
    t.poller.start();
    await vi.advanceTimersByTimeAsync(POLL.intervalMs * 3);
    expect(t.fetchLive).not.toHaveBeenCalled();
    t.setHidden(false);
    await flush();
    expect(t.fetchLive).toHaveBeenCalledTimes(1);
    t.poller.stop();
  });

  it('backs off exponentially with jitter on errors, capped at 60 s, and recovers', async () => {
    const t = setup({ random: () => 1 });
    const netErr = new Error('network');
    t.fetchLive.mockRejectedValue(netErr);
    t.poller.start();
    await flush();
    expect(t.onStatus).toHaveBeenLastCalledWith(false, 1, netErr);
    const times: number[] = [];
    let last = Date.now();
    for (let i = 0; i < 6; i++) {
      const before = t.fetchLive.mock.calls.length;
      while (t.fetchLive.mock.calls.length === before) await vi.advanceTimersByTimeAsync(500);
      times.push(Date.now() - last);
      last = Date.now();
    }
    expect(times[0]).toBeGreaterThanOrEqual(9_500);
    expect(times[1]).toBeGreaterThan(times[0]);
    expect(times[2]).toBeGreaterThan(times[1]);
    expect(Math.max(...times)).toBeLessThanOrEqual(POLL.backoffMaxMs + 500);
    t.fetchLive.mockImplementation(async () => live(1));
    while (t.onStatus.mock.calls.at(-1)?.[0] !== true) await vi.advanceTimersByTimeAsync(1_000);
    t.poller.stop();
  });

  it('honours Retry-After when it is longer than the backoff', async () => {
    const t = setup({ random: () => 0 });
    t.fetchLive.mockRejectedValueOnce(Object.assign(new Error('429'), { retryAfterMs: 45_000 }));
    t.poller.start();
    await flush();
    await vi.advanceTimersByTimeAsync(44_000);
    expect(t.fetchLive).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_500);
    expect(t.fetchLive).toHaveBeenCalledTimes(2);
    t.poller.stop();
  });

  it('a failed snapshot fetch is retried on the next poll', async () => {
    const t = setup();
    t.fetchSnapshot.mockRejectedValueOnce(new Error('500'));
    t.poller.start();
    await flush();
    expect(t.onSnapshot).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL.backoffMaxMs);
    expect(t.onSnapshot).toHaveBeenCalledWith({ version: 1 }, live(1));
    t.poller.stop();
  });

  it('stop() cancels timers and ignores in-flight responses', async () => {
    const t = setup();
    let release!: (s: LiveState) => void;
    t.fetchLive.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    t.poller.start();
    t.poller.stop();
    release(live(1));
    await vi.advanceTimersByTimeAsync(POLL.intervalMs * 3);
    expect(t.fetchSnapshot).not.toHaveBeenCalled();
    expect(t.fetchLive).toHaveBeenCalledTimes(1);
  });
});

describe('LivePoller: forward only (I1)', () => {
  it('an older /live version after a newer snapshot fetches nothing and emits nothing', async () => {
    const t = setup();
    t.setVersion(5);
    t.poller.start();
    await flush();
    expect(t.onSnapshot).toHaveBeenCalledTimes(1);
    t.setVersion(4); // a stale CDN colo
    await vi.advanceTimersByTimeAsync(POLL.intervalMs * 3);
    expect(t.fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(t.onSnapshot).toHaveBeenCalledTimes(1);
  });

  it('an older snapshot (served by a stale colo for a newer /live) is dropped', async () => {
    const t = setup();
    t.setVersion(5);
    t.poller.start();
    await flush();
    t.setVersion(6);
    t.fetchSnapshot.mockImplementationOnce(async () => ({ version: 4 }));
    await vi.advanceTimersByTimeAsync(POLL.intervalMs + POLL.snapshotJitterMs);
    expect(t.fetchSnapshot).toHaveBeenCalledTimes(2);
    expect(t.onSnapshot).toHaveBeenCalledTimes(1);
    expect(t.onSnapshot).toHaveBeenLastCalledWith({ version: 5 }, live(5));
    t.poller.stop();
  });
});

describe('LivePoller: election status (upcoming → counting → finalized)', () => {
  it('Upcoming: /live only, every 60 s + 0–15 s; picks up Live by itself and starts fetching snapshots', async () => {
    const t = setup({ random: () => 0 });
    t.setStatus('Upcoming');
    t.poller.start();
    await flush();
    expect(t.fetchSnapshot).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(POLL.upcomingIntervalMs - 100);
    expect(t.fetchLive).toHaveBeenCalledTimes(1);
    t.setStatus('Live');
    await vi.advanceTimersByTimeAsync(200);
    expect(t.fetchLive).toHaveBeenCalledTimes(2);
    expect(t.fetchSnapshot).toHaveBeenCalledTimes(1);
    expect(t.onLive).toHaveBeenLastCalledWith(live(1, 'Live'));
    await vi.advanceTimersByTimeAsync(POLL.intervalMs);
    expect(t.fetchLive).toHaveBeenCalledTimes(3);
    t.poller.stop();
  });

  it('Upcoming jitter is bounded by 75 s', async () => {
    const t = setup({ random: () => 0.999 });
    t.setStatus('Upcoming');
    t.poller.start();
    await flush();
    await vi.advanceTimersByTimeAsync(POLL.upcomingIntervalMs + POLL.upcomingJitterMs);
    expect(t.fetchLive).toHaveBeenCalledTimes(2);
    t.poller.stop();
  });

  it('Finalized: fetches the final snapshot once, then stops polling', async () => {
    const t = setup();
    t.poller.start();
    await flush();
    t.setVersion(2);
    t.setStatus('Finalized');
    await vi.advanceTimersByTimeAsync(POLL.intervalMs + POLL.intervalJitterMs + POLL.snapshotJitterMs);
    expect(t.onSnapshot).toHaveBeenLastCalledWith({ version: 2 }, live(2, 'Finalized'));
    const calls = t.fetchLive.mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL.upcomingIntervalMs * 5);
    expect(t.fetchLive.mock.calls.length).toBe(calls);
  });
});

describe('LivePoller: retry and tab switching', () => {
  it('pollNow() polls at once and resets the backoff (Retry button)', async () => {
    const t = setup({ random: () => 1 });
    t.fetchLive.mockRejectedValue(new Error('x'));
    t.poller.start();
    await flush();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(t.onStatus).toHaveBeenLastCalledWith(false, 2, expect.any(Error));
    t.fetchLive.mockImplementation(async () => live(1));
    t.poller.pollNow();
    await flush();
    expect(t.onStatus).toHaveBeenLastCalledWith(true, 0);
    expect(t.onSnapshot).toHaveBeenCalledTimes(1);
    t.poller.stop();
  });

  it('rapid visibility changes poll at most once per 2 s', async () => {
    const t = setup();
    t.poller.start();
    await flush();
    t.setHidden(false);
    t.setHidden(false);
    await flush();
    expect(t.fetchLive).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL.minVisiblePollGapMs);
    t.setHidden(false);
    await flush();
    expect(t.fetchLive).toHaveBeenCalledTimes(2);
    t.poller.stop();
  });
});

describe('shouldPoll', () => {
  const day = 86_400_000;
  const at = Date.parse('2027-02-27T00:00:00Z');
  const el = (status: LiveElectionStatus, date: string | null) => ({ status, tentative_next_date: date });
  it('Live always, Finalized never, Upcoming only near its tentative date', () => {
    expect(shouldPoll(el('Live', null), at)).toBe(true);
    expect(shouldPoll(el('Finalized', '2027-02-27'), at)).toBe(false);
    expect(shouldPoll(el('Upcoming', null), at)).toBe(false);
    expect(shouldPoll(el('Upcoming', '2027-02-27'), at - 2 * day)).toBe(true);
    expect(shouldPoll(el('Upcoming', '2027-02-27'), at - 4 * day)).toBe(false);
    expect(shouldPoll(el('Upcoming', '2027-02-27'), at + 30 * day)).toBe(true);
    expect(shouldPoll(el('Upcoming', '2027-02-27'), at + 61 * day)).toBe(false);
  });
});

describe('backoffDelay', () => {
  it('grows exponentially within [cap/2, cap] and never exceeds 60 s', () => {
    expect(backoffDelay(1, () => 0)).toBe(5_000);
    expect(backoffDelay(1, () => 1)).toBe(10_000);
    expect(backoffDelay(2, () => 1)).toBe(20_000);
    expect(backoffDelay(10, () => 1)).toBe(60_000);
    expect(backoffDelay(10, () => 0)).toBe(30_000);
  });

  it('uses Retry-After as a floor (bounded to 10 min)', () => {
    expect(backoffDelay(1, () => 0, 30_000)).toBe(30_000);
    expect(backoffDelay(1, () => 0, 1_000)).toBe(5_000);
    expect(backoffDelay(1, () => 0, 10 ** 9)).toBe(600_000);
  });
});
