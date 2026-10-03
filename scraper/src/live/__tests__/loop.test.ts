import { describe, it, expect, vi } from 'vitest';
import { newLoopState, runCycle, POST_CHUNK, REPREPARE_MS, type LoopDeps } from '../loop';
import { IngestApiError } from '../client';

const roster = { election: { id: 'e', type: 'VS', state_id: 4, year: 2026, status: 'Live' }, parties: [], seats: [] };
function deps(over: Partial<{ status: string; source: string | null; lease: 'ok' | 'held'; seats: number }> = {}) {
  const adapter = { id: 'fake', intervalMs: 30_000, prepare: vi.fn(async () => ({ seats_total: 1, seats_mapped: 1, unmapped: [] })),
    poll: vi.fn(async () => Array.from({ length: over.seats ?? 1 }, (_, i) => ({ const_id: `S${i}`, state: 'counting' as const, votes: {} }))) };
  const client = {
    config: vi.fn(async () => ({ status: over.status ?? 'Live', source: over.source === undefined ? 'fake' : over.source, poll_hint_ms: 10_000, shard: { name: 'rest', seat_count: 1 }, lease: { holder: null, expires_at: null } })),
    lease: vi.fn(async () => { if (over.lease === 'held') throw new IngestApiError('held', 409, 'INGEST_0004', { holder: 'laptop' }); return { expires_at: 't' }; }),
    release: vi.fn(async () => undefined),
    roster: vi.fn(async () => roster),
    seats: vi.fn(async (_e: string, b: any) => ({ counts: { applied: b.seats.length, unchanged: 0, stale: 0, held: 0, rejected: 0 }, seats: [] })),
    tally: vi.fn(async () => ({ mismatch: [] })),
  };
  const log = vi.fn();
  const d: LoopDeps = { client: client as any, adapters: { fake: () => adapter }, adapterOpts: {}, holder: 'w1', log, now: () => new Date('2027-02-27T04:00:00Z') };
  return { d, client, adapter, log };
}

describe('runCycle commit', () => {
  it('commits after all chunks posted, not when a post rejects', async () => {
    const { d, client, adapter } = deps({ seats: POST_CHUNK + 1 });
    const commit = vi.fn(); (adapter as any).commit = commit;
    await runCycle('e', 'rest', newLoopState(), d);
    expect(commit).toHaveBeenCalledTimes(1);
    commit.mockClear();
    client.seats.mockRejectedValueOnce(new Error('5xx'));
    await runCycle('e', 'rest', newLoopState(), d);
    expect(commit).not.toHaveBeenCalled();
    commit.mockClear();
    client.seats.mockResolvedValueOnce({ counts: { applied: 0, unchanged: 0, stale: 0, held: 0, rejected: 0 }, seats: [] }).mockRejectedValueOnce(new Error('second chunk'));
    await runCycle('e', 'rest', newLoopState(), d);
    expect(commit).not.toHaveBeenCalled();
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
    expect(log).toHaveBeenCalledWith(expect.stringContaining('laptop'), undefined);
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
    client.config.mockResolvedValue({ status: 'Live', source: 'fake2', poll_hint_ms: 10_000, shard: { name: 'rest', seat_count: 1 }, lease: { holder: null, expires_at: null } });
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
