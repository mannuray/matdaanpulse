import { SwingAnalysisStrategy } from './swing.strategy';
import { IncumbencyStrategy } from './incumbency.strategy';
import { DominanceStrategy } from './dominance.strategy';
import type { AnalysisContext } from './analysis-strategy.interface';

const events = [
  { party_id: 'BRS', predecessor_id: 'TRS', kind: 'rename', effective_date: '2022-12-09', state_id: null, is_successor: true },
  { party_id: 'SSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_id: null, is_successor: false },
];
function ctx(prev: { party: string; name: string }, cur: { party: string; name: string }, more: Partial<AnalysisContext> = {}): AnalysisContext {
  return {
    constId: 'X_1', constNo: '1', electionId: 'e2', historyElectionIds: ['e1'],
    electionYearMap: new Map([['e1', 2019], ['e2', 2024]]),
    electionDateMap: new Map([['e1', '2019-10-24'], ['e2', '2024-11-23']]), stateId: 20, lineage: events,
    winnersByElection: new Map([['e1', new Map([['1', { party_id: prev.party, candidate_name: prev.name, margin: 10 }]])], ['e2', new Map([['1', { party_id: cur.party, candidate_name: cur.name, margin: 5 }]])]]),
    resultsByConst: new Map(), candidatesByElectionConst: new Map([['e2', new Map([['X_1', [{ name: prev.name, party_id: cur.party }]]])]]),
    seatStatsByElection: new Map(), manifest: null, ...more,
  } as AnalysisContext;
}

describe('analysis strategies follow party lineage', () => {
  it('swing: a rename is not a flip', () => {
    expect(new SwingAnalysisStrategy().execute(ctx({ party: 'TRS', name: 'A' }, { party: 'BRS', name: 'A' })).swing).toMatchObject({ flipped: false, split: false });
  });
  it('swing: a split faction holding an old-party seat is labelled split, not a flip', () => {
    expect(new SwingAnalysisStrategy().execute(ctx({ party: 'SHS', name: 'A' }, { party: 'SSUBT', name: 'A' })).swing).toMatchObject({ flipped: false, split: true });
  });
  it('swing: an unrelated party is a flip', () => {
    expect(new SwingAnalysisStrategy().execute(ctx({ party: 'INC', name: 'A' }, { party: 'SSUBT', name: 'B' })).swing).toMatchObject({ flipped: true, split: false });
  });
  it('incumbency: following the split is not a party switch', () => {
    const r = new IncumbencyStrategy().execute(ctx({ party: 'SHS', name: 'Ravi' }, { party: 'SSUBT', name: 'Ravi' })).incumbency;
    expect(r.switched_to).toBeUndefined();
    expect(r.followed_split).toBe('SSUBT');
  });
  it('incumbency: joining an unrelated party is a switch', () => {
    expect(new IncumbencyStrategy().execute(ctx({ party: 'SHS', name: 'Ravi' }, { party: 'INC', name: 'Ravi' })).incumbency.switched_to).toBe('INC');
  });
  it('dominance: a renamed party\'s wins count together', () => {
    const c = ctx({ party: 'TRS', name: 'A' }, { party: 'BRS', name: 'A' });
    expect(new DominanceStrategy().execute(c)).toMatchObject({ dominance: 'stronghold', dominance_party: 'BRS', dominance_wins: 2 });
  });
});
