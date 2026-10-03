import { DominanceStrategy } from './dominance.strategy';

describe('DominanceStrategy', () => {
  const ctx = (history: string[], winners: Record<string, string>) => ({
    constNo: '40', electionId: 'now', historyElectionIds: history,
    winnersByElection: new Map(Object.entries(winners).map(([eid, party]) => [eid, new Map([['40', { party_id: party }]])])),
  }) as any;

  it('a seat with no comparable past result is new, even with a winner now (first election after a redraw)', () => {
    expect(new DominanceStrategy().execute(ctx([], { now: 'BJP' }))).toMatchObject({ dominance: 'new', dominance_party: null });
  });

  it('with past results it is classified as before', () => {
    expect(new DominanceStrategy().execute(ctx(['e1', 'e2'], { e1: 'BJP', e2: 'BJP', now: 'BJP' }))).toMatchObject({ dominance: 'stronghold', dominance_party: 'BJP' });
    expect(new DominanceStrategy().execute(ctx(['e1', 'e2'], { e1: 'INC', e2: 'BJP', now: 'AGP' }))).toMatchObject({ dominance: 'swing' });
  });
});
