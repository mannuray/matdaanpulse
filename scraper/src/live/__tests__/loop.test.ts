import { describe, it, expect, vi, afterEach } from 'vitest';
import { newLoopState, runCycle, POST_CHUNK, REPREPARE_MS, HEARTBEAT_MS, TALLY_EVERY, type LoopDeps } from '../loop';
import { IngestApiError } from '../client';

const roster = { election: { id: 'e', type: 'VS', state_id: 4, year: 2026, status: 'Live' }, parties: [], seats: [] };
function deps(over: Partial<{ status: string; source: string | null; lease: 'ok' | 'held'; seats: number }> = {}) {
  const adapter = { id: 'fake', intervalMs: 30_000, prepare: vi.fn(async () => ({ seats_total: 1, seats_mapped: 1, unmapped: [] })),
    poll: vi.fn(async () => Array.from({ length: over.seats ?? 1 }, (_, i) => ({ const_id: `S${i}`, state: 'counting' as const, votes: {} }))) };
  const client = {
    config: vi.fn(async () => ({ status: over.status ?? 'Live', source: over.source === undefined ? 'fake' : over.source, poll_hint_ms: 10_000, shard: { name: 'rest', seat_count: 1 }, lease: { expires_at: null } })),
    lease: vi.fn(async () => { if (over.lease === 'held') throw new IngestApiError('held', 409, 'INGEST_0004', { expires_at: '2027-02-27T04:01:30Z' }); return { expires_at: 't' }; }),
    release: vi.fn(async () => undefined),
    roster: vi.fn(async () => roster),
    seats: vi.fn(async (_e: string, b: any) => ({ counts: { applied: b.seats.length, unchanged: 0, stale: 0, held: 0, rejected: 0 }, seats: [] })),
    tally: vi.fn(async () => ({ mismatch: [] })),
  };
  const log = vi.fn();
  const d: LoopDeps = { client: client as any, adapters: { fake: () => adapter }, adapterOpts: {}, holder: 'w1', log, now: () => new Date('2027-02-27T04:00:00Z') };
  return { d, client, adapter, log };
}

describe('runCycle posting', () => {
  it('posts a whole state (UP, 403 seats) in ONE request per cycle (one snapshot version), chunking only above the API max', async () => {
    expect(POST_CHUNK).toBe(500); // = backend MAX_SEATS_PER_REQUEST (backend/src/modules/ingest/dto/ingest.dto.ts)
    const up = deps({ seats: 403 });
    await runCycle('e', 'rest', newLoopState(), up.d);
    expect(up.client.seats).toHaveBeenCalledTimes(1);
    expect(up.client.seats.mock.calls[0][1].seats).toHaveLength(403);
    const big = deps({ seats: 1001 });
    await runCycle('e', 'rest', newLoopState(), big.d);
    expect(big.client.seats.mock.calls.map((c: any[]) => c[1].seats.length)).toEqual([500, 500, 1]);
  });
});

describe('runCycle commit', () => {
  it('commits each delivered chunk with its const_ids; nothing for a chunk that failed', async () => {
    const { d, client, adapter } = deps({ seats: POST_CHUNK + 1 });
    const commit = vi.fn(); (adapter as any).commit = commit;
    await runCycle('e', 'rest', newLoopState(), d);
    expect(commit).toHaveBeenCalledTimes(2);
    expect(commit.mock.calls[0][0]).toHaveLength(POST_CHUNK);
    expect(commit.mock.calls[1][0]).toEqual([`S${POST_CHUNK}`]);
    commit.mockClear();
    client.seats.mockRejectedValueOnce(new Error('5xx'));
    await runCycle('e', 'rest', newLoopState(), d);
    expect(commit).not.toHaveBeenCalled();
    commit.mockClear();
    client.seats.mockResolvedValueOnce({ counts: { applied: POST_CHUNK, unchanged: 0, stale: 0, held: 0, rejected: 0 }, seats: [] }).mockRejectedValueOnce(new Error('second chunk'));
    await runCycle('e', 'rest', newLoopState(), d);
    expect(commit).toHaveBeenCalledTimes(1);   // the first chunk was delivered and stays delivered
    expect(commit.mock.calls[0][0]).toHaveLength(POST_CHUNK);
  });
  it('seats the server held or rejected are not committed; stale and unchanged are', async () => {
    const { d, client, adapter } = deps({ seats: 4 });
    const commit = vi.fn(); (adapter as any).commit = commit;
    client.seats.mockResolvedValueOnce({ counts: { applied: 0, unchanged: 1, stale: 1, held: 1, rejected: 1 },
      seats: [{ const_id: 'S1', outcome: 'stale' }, { const_id: 'S2', outcome: 'held' }, { const_id: 'S3', outcome: 'rejected', reason: 'roster_mismatch' }] } as any);
    await runCycle('e', 'rest', newLoopState(), d);
    expect(commit).toHaveBeenCalledWith(['S0', 'S1']);
  });
});

describe('runCycle lease', () => {
  afterEach(() => { vi.useRealTimers(); });
  it('renews the lease from a heartbeat while a poll outlasts the lease TTL, and the posts still go through', async () => {
    vi.useFakeTimers();
    const { d, client, adapter } = deps({ seats: 2 });
    adapter.poll.mockImplementation(() => new Promise(r => setTimeout(() => r([{ const_id: 'S0', state: 'counting', votes: {} }, { const_id: 'S1', state: 'counting', votes: {} }]), 150_000)));
    const p = runCycle('e', 'rest', newLoopState(), d);
    await vi.advanceTimersByTimeAsync(150_000);
    await p;
    // 1 claim + 5 heartbeats (30 s … 150 s) + 1 re-claim before the chunk
    expect(client.lease).toHaveBeenCalledTimes(1 + 150_000 / HEARTBEAT_MS + 1);
    expect(client.seats).toHaveBeenCalledTimes(1);
    const n = client.lease.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5 * HEARTBEAT_MS);
    expect(client.lease).toHaveBeenCalledTimes(n);   // heartbeat stopped with the cycle
  });
  it('a 409 on the re-claim before a chunk ends the cycle cleanly: no post, no backoff, lease marked lost', async () => {
    const { d, client, log } = deps({ seats: POST_CHUNK + 1 });
    client.lease.mockResolvedValueOnce({ expires_at: 't' }).mockResolvedValueOnce({ expires_at: 't' })
      .mockRejectedValueOnce(new IngestApiError('held', 409, 'INGEST_0004', { expires_at: '2027-02-27T04:01:30Z' }));
    const st = newLoopState();
    expect(await runCycle('e', 'rest', st, d)).toBe(10_000);
    expect(client.seats).toHaveBeenCalledTimes(1);
    expect(st).toMatchObject({ leased: false, failures: 0 });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('lease lost to another job (held until 2027-02-27T04:01:30Z)'));
  });
  it('a heartbeat 409 stops the cycle before its next chunk', async () => {
    vi.useFakeTimers();
    const { d, client, adapter } = deps({ seats: 1 });
    adapter.poll.mockImplementation(() => new Promise(r => setTimeout(() => r([{ const_id: 'S0', state: 'counting', votes: {} }]), 40_000)));
    client.lease.mockResolvedValueOnce({ expires_at: 't' }).mockRejectedValue(new IngestApiError('held', 409, 'INGEST_0004', { expires_at: '2027-02-27T04:01:30Z' }));
    const p = runCycle('e', 'rest', newLoopState(), d);
    await vi.advanceTimersByTimeAsync(40_000);
    expect(await p).toBe(10_000);
    expect(client.seats).not.toHaveBeenCalled();
  });
});

describe('runCycle tally and timing', () => {
  it('only the rest loop posts the tally by default; a task flag overrides it', async () => {
    for (const [shard, flag, want] of [['rest', undefined, 1], ['upper', undefined, 0], ['upper', true, 1], ['rest', false, 0]] as const) {
      const { d, client, adapter } = deps();
      (adapter as any).tally = vi.fn(async () => [{ party_id: 'BJP', won: 1, leading: 0 }]);
      if (flag !== undefined) d.tally = flag;
      const st = newLoopState();
      for (let i = 0; i < TALLY_EVERY; i++) await runCycle('e', shard, st, d);
      expect(client.tally).toHaveBeenCalledTimes(want);
    }
  });
  it('logs the cycle duration and warns over 60 s', async () => {
    const { d, log } = deps();
    let t = Date.parse('2027-02-27T04:00:00Z');
    d.now = () => { const r = new Date(t); t += 31_000; return r; };
    await runCycle('e', 'rest', newLoopState(), d);
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/^WARN slow cycle: \[e:rest\] cycle 1: 1 seat\(s\) in \d+\.\ds$/));
  });
});

describe('runCycle', () => {
  it('prepares once, polls and posts in chunks with the poll start as observed_at', async () => {
    const { d, client, adapter } = deps({ seats: POST_CHUNK + 1 });
    const st = newLoopState();
    const wait = await runCycle('e', 'rest', st, d);
    expect(wait).toBeGreaterThanOrEqual(24_000); expect(wait).toBeLessThanOrEqual(36_000);
    expect(adapter.prepare).toHaveBeenCalledTimes(1);
    expect(client.seats).toHaveBeenCalledTimes(2);
    expect(client.seats.mock.calls[0][1]).toMatchObject({ shard: 'rest', source: 'fake', holder: 'w1', observed_at: '2027-02-27T04:00:00.000Z' });
    await runCycle('e', 'rest', st, d);
    expect(adapter.prepare).toHaveBeenCalledTimes(1);
  });
  it('idles (and releases a held lease) when paused, not Live, or the source has no adapter here', async () => {
    for (const over of [{ source: null }, { status: 'Upcoming' }, { source: 'other' }]) {
      const { d, client, adapter } = deps(over as any);
      const st = { ...newLoopState(), leased: true };
      expect(await runCycle('e', 'rest', st, d)).toBe(10_000);
      expect(client.release).toHaveBeenCalled();
      expect(adapter.poll).not.toHaveBeenCalled();
    }
  });
  it('another holder: logs and waits without polling', async () => {
    const { d, adapter, log } = deps({ lease: 'held' });
    expect(await runCycle('e', 'rest', newLoopState(), d)).toBe(10_000);
    expect(adapter.poll).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('lease held by another job until 2027-02-27T04:01:30Z'), undefined);
  });
  it('a failing config call backs off and never throws', async () => {
    const { d, client } = deps();
    client.config.mockRejectedValue(new Error('down'));
    const st = newLoopState();
    expect(await runCycle('e', 'rest', st, d)).toBe(10_000);
    expect(await runCycle('e', 'rest', st, d)).toBe(20_000);
  });
  it('cycle failures (poll rejecting) back off 10s, 20s, 40s, then cap at 60s', async () => {
    const { d, adapter } = deps();
    adapter.poll.mockRejectedValue(new Error('boom'));
    const st = newLoopState();
    const waits = [];
    for (let i = 0; i < 5; i++) waits.push(await runCycle('e', 'rest', st, d));
    expect(waits).toEqual([10_000, 20_000, 40_000, 60_000, 60_000]);
  });
  it('a failed prepare after a source switch is retried before any poll', async () => {
    const { d, adapter, client } = deps();
    const st = newLoopState();
    await runCycle('e', 'rest', st, d);
    expect(adapter.prepare).toHaveBeenCalledTimes(1);
    client.config.mockResolvedValue({ status: 'Live', source: 'fake2', poll_hint_ms: 10_000, shard: { name: 'rest', seat_count: 1 }, lease: { expires_at: null } });
    const adapter2 = { ...adapter, prepare: vi.fn().mockRejectedValueOnce(new Error('roster')).mockResolvedValue({ seats_total: 1, seats_mapped: 1, unmapped: [] }), poll: vi.fn(async () => []) };
    d.adapters.fake2 = () => adapter2;
    await runCycle('e', 'rest', st, d);
    expect(adapter2.poll).not.toHaveBeenCalled();
    await runCycle('e', 'rest', st, d);
    expect(adapter2.prepare).toHaveBeenCalledTimes(2);
    expect(adapter2.poll).toHaveBeenCalledTimes(1);
  });
  it('re-prepares after REPREPARE_MS using the injected clock', async () => {
    const { d, adapter } = deps();
    let t = Date.parse('2027-02-27T04:00:00Z');
    d.now = () => new Date(t);
    const st = newLoopState();
    await runCycle('e', 'rest', st, d);
    t += REPREPARE_MS - 1; await runCycle('e', 'rest', st, d);
    expect(adapter.prepare).toHaveBeenCalledTimes(1);
    t += 2; await runCycle('e', 'rest', st, d);
    expect(adapter.prepare).toHaveBeenCalledTimes(2);
  });
});
