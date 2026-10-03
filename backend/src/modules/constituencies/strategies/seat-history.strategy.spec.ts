import { SeatHistoryStrategy } from './seat-history.strategy';
import type { AnalysisContext, SeatStats } from './analysis-strategy.interface';

function ctx(over: Partial<AnalysisContext> = {}): AnalysisContext {
  const winners = new Map([
    ['e2020', new Map([['100', { party_id: 'BJP', candidate_name: 'A', margin: 300, votes: 600 }]])],
    ['e2025', new Map([['100', { party_id: 'RJD', candidate_name: 'B', margin: 50, votes: 0 }]])],
  ]);
  const stats = new Map<string, Map<string, SeatStats>>([
    ['e2020', new Map([['100', { total: 1000, runnerUp: { name: 'B', party_id: 'RJD' } }]])],
    ['e2025', new Map([['100', { total: 0, runnerUp: null }]])],
  ]);
  return {
    constId: 'BR_VS_100_X', constNo: '100', electionId: 'e2025', historyElectionIds: ['e2020'],
    electionYearMap: new Map([['e2020', 2020], ['e2025', 2025]]),
    winnersByElection: winners, resultsByConst: new Map(), candidatesByElectionConst: new Map(), manifest: null,
    seatStatsByElection: stats, ...over,
  };
}

describe('SeatHistoryStrategy', () => {
  it('stores the winner share and the runner-up for each election', () => {
    const { seat_history } = new SeatHistoryStrategy().execute(ctx());
    expect(seat_history[0]).toEqual({ year: 2020, party: 'BJP', candidate: 'A', margin: 300, vote_share: 60, runner_up: 'B', runner_up_party: 'RJD' });
  });

  it('a seat with no votes yet has a null share, not NaN', () => {
    const { seat_history } = new SeatHistoryStrategy().execute(ctx());
    expect(seat_history[1]).toMatchObject({ year: 2025, vote_share: null, runner_up: null, runner_up_party: null });
  });

  it('an election without stats for the seat still yields the winner', () => {
    const { seat_history } = new SeatHistoryStrategy().execute(ctx({ seatStatsByElection: new Map() }));
    expect(seat_history[0]).toMatchObject({ candidate: 'A', vote_share: null, runner_up: null });
  });
});
