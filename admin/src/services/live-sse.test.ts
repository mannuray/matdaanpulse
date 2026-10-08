import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { subscribeLiveUpdates, sseRetryDelay } from './live.service';

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  listeners = new Map<string, (e: { data: string }) => void>();
  constructor(public url: string) { FakeEventSource.instances.push(this); }
  addEventListener(name: string, fn: (e: { data: string }) => void) { this.listeners.set(name, fn); }
  close() { this.closed = true; }
}

const EID = 'c3d4e5f6-a7b8-9012-cdef-234567890abc';
let tokenN = 0;

beforeEach(() => {
  vi.useFakeTimers();
  FakeEventSource.instances = [];
  tokenN = 0;
  vi.stubGlobal('EventSource', FakeEventSource);
  vi.stubGlobal('localStorage', { getItem: () => 'jwt', setItem: () => {}, removeItem: () => {} });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, statusText: '', json: async () => ({ success: true, data: { token: `t${++tokenN}`, expiresInSeconds: 300 } }) })));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('admin live SSE subscription', () => {
  it('fetches an SSE token and opens /admin/live/updates with it', async () => {
    const onBatch = vi.fn();
    const stop = subscribeLiveUpdates(EID, { onResultUpdate: vi.fn(), onBatchUpdate: onBatch });
    await vi.advanceTimersByTimeAsync(0);
    const es = FakeEventSource.instances[0];
    expect(es.url).toMatch(new RegExp(`/admin/live/updates\\?election_id=${EID}&token=t1$`));
    const [url, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toMatch(/\/admin\/live\/sse-token$/);
    expect(init.method).toBe('POST');
    es.listeners.get('batch-update')!({ data: JSON.stringify([{ const_id: 'A' }, { x: 1 }]) });
    expect(onBatch).toHaveBeenCalledWith([{ const_id: 'A' }]);
    stop();
    expect(es.closed).toBe(true);
  });

  it('on error: closes, fetches a fresh token, reconnects with backoff and reports the reconnect', async () => {
    const onReconnect = vi.fn();
    subscribeLiveUpdates(EID, { onResultUpdate: vi.fn(), onBatchUpdate: vi.fn(), onReconnect });
    await vi.advanceTimersByTimeAsync(0);
    const first = FakeEventSource.instances[0];
    first.onopen!();
    first.onerror!();
    expect(first.closed).toBe(true);
    await vi.advanceTimersByTimeAsync(2_100);
    const second = FakeEventSource.instances[1];
    expect(second.url).toMatch(/token=t2$/);
    second.onopen!();
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('backoff grows and is capped at ~30 s', () => {
    expect(sseRetryDelay(0, () => 0)).toBe(1000);
    expect(sseRetryDelay(3, () => 0)).toBe(8000);
    expect(sseRetryDelay(20, () => 1)).toBe(31_000);
  });

  it('reports offline after three failed attempts in a row; a retry does not flip it back; open again once connected', async () => {
    const onStatus = vi.fn();
    const stop = subscribeLiveUpdates(EID, { onResultUpdate: vi.fn(), onBatchUpdate: vi.fn(), onStatus });
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(['connecting']);
    FakeEventSource.instances[0].onerror!();
    await vi.advanceTimersByTimeAsync(2_100);
    FakeEventSource.instances[1].onerror!();
    await vi.advanceTimersByTimeAsync(3_100);
    FakeEventSource.instances[2].onerror!();
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(['connecting', 'reconnecting', 'reconnecting', 'offline']);
    await vi.advanceTimersByTimeAsync(5_100);
    expect(FakeEventSource.instances).toHaveLength(4);
    expect(onStatus).toHaveBeenLastCalledWith('offline');
    FakeEventSource.instances[3].onopen!();
    expect(onStatus).toHaveBeenLastCalledWith('open');
    stop();
  });

  it('a failing token request counts as a failed attempt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const onStatus = vi.fn();
    const stop = subscribeLiveUpdates(EID, { onResultUpdate: vi.fn(), onBatchUpdate: vi.fn(), onStatus });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_100);
    await vi.advanceTimersByTimeAsync(3_100);
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(['connecting', 'reconnecting', 'reconnecting', 'offline']);
    expect(FakeEventSource.instances).toHaveLength(0);
    stop();
  });
});
