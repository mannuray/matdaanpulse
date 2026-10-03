import { LiveStateService, LIVE_STATE_MEMO_MS } from './live-state.service';
import { buildSnapshot } from './results.service';

function makePrisma(version = 5n) {
  const state = { version };
  const readRow = jest.fn(async (): Promise<unknown[]> => [{ status: 'Live', version: state.version, updated_at: new Date('2026-09-30T00:00:00Z') }]);
  const prisma = {
    elections: { findUnique: jest.fn() },
    $executeRaw: jest.fn(),
    // Tagged template: the first chunk tells the row read from the counts query.
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) =>
      strings.join('').includes('LEFT JOIN election_live_state') ? readRow() : [{ declared: 3, total: 10 }]),
  };
  return { prisma, state, readRow };
}

describe('LiveStateService', () => {
  it('returns { version, status, updatedAt, declared, total } with the bigint version as a number', async () => {
    const { prisma } = makePrisma(1790761782122n);
    const svc = new LiveStateService(prisma as any);
    await expect(svc.get('e1')).resolves.toEqual({
      version: 1790761782122,
      status: 'Live',
      updatedAt: '2026-09-30T00:00:00.000Z',
      declared: 3,
      total: 10,
    });
  });

  it('single-flights concurrent reads and memoises briefly', async () => {
    const { prisma, readRow } = makePrisma();
    const svc = new LiveStateService(prisma as any);
    await Promise.all(Array.from({ length: 50 }, () => svc.get('e1')));
    expect(readRow).toHaveBeenCalledTimes(1);
    await svc.get('e1');
    expect(readRow).toHaveBeenCalledTimes(1);
    await svc.get('e1', Date.now() + LIVE_STATE_MEMO_MS + 1);
    expect(readRow).toHaveBeenCalledTimes(2);
  });

  it('invalidate() makes the next read see a new version immediately (after an override)', async () => {
    const { prisma, state } = makePrisma(5n);
    const svc = new LiveStateService(prisma as any);
    expect((await svc.get('e1')).version).toBe(5);
    state.version = 6n; // the DB trigger bumped it in the override's transaction
    expect((await svc.get('e1')).version).toBe(5); // memo
    svc.invalidate('e1');
    expect((await svc.get('e1')).version).toBe(6);
  });

  it('creates the row on first read of an election that has none', async () => {
    const { prisma, readRow } = makePrisma();
    readRow
      .mockResolvedValueOnce([{ status: 'Upcoming', version: null, updated_at: null }])
      .mockResolvedValueOnce([{ status: 'Upcoming', version: 7n, updated_at: new Date() }]);
    const svc = new LiveStateService(prisma as any);
    await expect(svc.get('e1')).resolves.toMatchObject({ version: 7, status: 'Upcoming' });
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('404s for an unknown election', async () => {
    const { prisma, readRow } = makePrisma();
    readRow.mockResolvedValueOnce([]);
    const svc = new LiveStateService(prisma as any);
    await expect(svc.get('nope')).rejects.toMatchObject({ status: 404 });
  });
});

describe('buildSnapshot', () => {
  const row = (const_id: string, party: string | null, votes: number, status: string) => ({
    const_id,
    votes,
    status,
    margin: 0,
    candidates: { party_id: party, name: `${party}-cand`, parties: party ? { name: `${party} name`, color: '#111' } : null },
    constituencies: { type: 'GEN' },
  });

  it('carries per-seat state and rounds when given', () => {
    const snap = buildSnapshot(7, [], [{ const_id: 'S1', state: 'countermanded', round_current: null, round_total: null }, { const_id: 'S2', state: 'counting', round_current: 4, round_total: 20 }]);
    expect(snap.seats).toEqual({ S1: { state: 'countermanded', cr: null, tr: null }, S2: { state: 'counting', cr: 4, tr: 20 } });
    expect(buildSnapshot(7, []).seats).toEqual({});
  });

  it('derives the seat tally and vote share from the same rows as the results list', () => {
    const snap = buildSnapshot(9, [
      row('A', 'P1', 60, 'WON'),
      row('A', 'P2', 40, 'LOST'),
      row('B', 'P2', 70, 'LEADING'),
      row('B', 'P1', 20, 'TRAILING'),
      row('B', null, 10, 'TRAILING'),
      row('C', 'P3', 0, 'TRAILING'),
    ]);
    expect(snap.version).toBe(9);
    expect(snap.results).toHaveLength(6);
    expect(snap.results[4]).toEqual({ const_id: 'B', party_id: null, candidate_name: 'null-cand', votes: 10, status: 'TRAILING', margin: 0, const_type: 'GEN' });
    expect(snap.summary).toEqual([
      { party_id: 'P1', party_name: 'P1 name', color: '#111', won: 1, leading: 0 },
      { party_id: 'P2', party_name: 'P2 name', color: '#111', won: 0, leading: 1 },
    ]);
    expect(snap.voteShare.map((v) => [v.party_id, v.total_votes, v.percentage])).toEqual([
      ['P2', 110, 57.89],
      ['P1', 80, 42.11],
      ['P3', 0, 0],
    ]);
  });
});

describe('ResultsService (version-keyed caches, consistent snapshot)', () => {
  const { ResultsService } = require('./results.service');

  function make(version = 42, dbVersion = 42) {
    const keys: string[] = [];
    const cache = { getOrSet: jest.fn(async (key: string, _ttl: number, loader: () => Promise<unknown>) => { keys.push(key); return loader(); }) };
    const liveState = { get: jest.fn(async () => ({ version })) };
    const tx = {
      $queryRaw: jest.fn(async () => [{ version: BigInt(dbVersion) }]),
      results: { findMany: jest.fn(async () => []) },
      seat_ingest_state: { findMany: jest.fn(async () => []) },
    };
    const prisma = {
      $queryRaw: jest.fn(async () => []),
      results: { findMany: jest.fn(async () => []) },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown, opts: unknown) => { (prisma as any).lastTxOpts = opts; return fn(tx); }),
    };
    return { svc: new ResultsService(prisma, cache, liveState), keys, prisma };
  }

  it('keys summary / vote share / full results by the live version, so any writer (trigger bump) moves readers to a fresh key', async () => {
    const { svc, keys } = make(42);
    await svc.getElectionSummary('e1');
    await svc.getVoteShare('e1');
    await svc.getResults('e1');
    expect(keys).toEqual(['election:e1:summary:v42', 'election:e1:vote-share:v42', 'election:e1:full-results:v42']);
  });

  it('reads the snapshot version and rows in one REPEATABLE READ transaction', async () => {
    const { svc, keys, prisma } = make(42, 42);
    const snap = await svc.getSnapshot('e1', 42);
    expect(snap.version).toBe(42);
    expect(keys).toEqual(['election:e1:snapshot:v42']);
    expect((prisma as any).lastTxOpts).toEqual({ isolationLevel: 'RepeatableRead' });
  });

  it('a snapshot whose version moved on is returned (labelled with its real version) but not cached under the requested key', async () => {
    const cacheStore = new Map<string, unknown>();
    const { svc } = make(42, 43);
    (svc as any).cache.getOrSet = async (key: string, _t: number, loader: () => Promise<unknown>) => {
      const v = await loader();
      cacheStore.set(key, v);
      return v;
    };
    const snap = await svc.getSnapshot('e1', 42);
    expect(snap.version).toBe(43);
    expect(cacheStore.size).toBe(0);
  });
});
