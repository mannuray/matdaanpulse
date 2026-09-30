import { LiveStateService, LIVE_STATE_MEMO_MS } from './live-state.service';
import { buildSnapshot } from './results.service';

function makePrisma(version = 5n) {
  const state = { version };
  const readRow = jest.fn(async (): Promise<unknown[]> => [{ version: state.version, updated_at: new Date('2026-09-30T00:00:00Z') }]);
  const prisma = {
    elections: { findUnique: jest.fn() },
    $executeRaw: jest.fn(),
    // Tagged template: the first chunk tells the row read from the counts query.
    $queryRaw: jest.fn(async (strings: TemplateStringsArray) =>
      strings[0].includes('FROM election_live_state') ? readRow() : [{ declared: 3, total: 10 }]),
  };
  return { prisma, state, readRow };
}

describe('LiveStateService', () => {
  it('returns { version, updatedAt, declared, total } with the bigint version as a number', async () => {
    const { prisma } = makePrisma(1790761782122n);
    const svc = new LiveStateService(prisma as any);
    await expect(svc.get('e1')).resolves.toEqual({
      version: 1790761782122,
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
    readRow.mockResolvedValueOnce([]).mockResolvedValueOnce([{ version: 7n, updated_at: new Date() }]);
    prisma.elections.findUnique.mockResolvedValue({ id: 'e1' });
    const svc = new LiveStateService(prisma as any);
    expect((await svc.get('e1')).version).toBe(7);
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('404s for an unknown election', async () => {
    const { prisma, readRow } = makePrisma();
    readRow.mockResolvedValueOnce([]);
    prisma.elections.findUnique.mockResolvedValue(null);
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
