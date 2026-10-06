import { describe, it, expect } from 'vitest';
import { seatInsights } from '../seatInsights';
import type { SeatView, SeatCandidateView, SeatNote } from '../seatView';
import type { SeatHistoryEntry } from '../../types';

const cand = (o: Partial<SeatCandidateView>): SeatCandidateView => ({ key: String(o.name), name: 'X', partyId: 'P', partyLabel: 'P', mark: null, color: '#000', votes: 0, share: 0, pill: null, incumbent: false, photo: null, personId: null, nota: false, affidavit: null, ...o });
const view = (candidates: SeatCandidateView[], margin: number | null): SeatView => ({ candidates, others: null, totalVotes: candidates.reduce((n, c) => n + c.votes, 0), margin });
const h = (year: number, party: string, margin: number): SeatHistoryEntry => ({ year, party, candidate: 'c', margin });

describe('seatInsights', () => {
  const lead = cand({ name: 'A', partyId: 'LJPRV', votes: 88520, pill: 'WON' });
  const second = cand({ name: 'B', partyId: 'RJD', votes: 87539, incumbent: true });
  const nota = cand({ name: 'NOTA', partyId: null, nota: true, votes: 3635 });
  const v = view([lead, second, cand({ name: 'C', partyId: 'JSP', votes: 6581 }), nota], 981);

  it('flip from the last winner, photo finish, NOTA over the margin, incumbent lost, then the notes', () => {
    const notes: SeatNote[] = [{ kind: 'threeWay', thirdName: 'C', thirdVotes: 6581, margin: 981 }];
    const out = seatInsights(v, [h(2020, 'RJD', 20672), h(2015, 'BJP', 7902)], notes);
    expect(out.map(i => i.kind)).toEqual(['flip', 'photoFinish', 'nota', 'incumbent', 'threeWay']);
    expect(out[0]).toEqual({ kind: 'flip', from: 'RJD', to: 'LJPRV', fromYear: 2020 });
    expect(out[1]).toEqual({ kind: 'photoFinish', pct: 0.5, margin: 981 });
    expect(out[2]).toEqual({ kind: 'nota', nota: 3635, margin: 981 });
    expect(out[3]).toEqual({ kind: 'incumbent', name: 'B', won: false });
  });

  it('no "margin up/down" after a year the seat was won unopposed (there was no margin)', () => {
    const held = view([cand({ name: 'A', partyId: 'BJP', votes: 6000, pill: 'WON' }), cand({ name: 'B', partyId: 'INC', votes: 2842 })], 3158);
    const out = seatInsights(held, [{ ...h(2019, 'BJP', 0), runner_up: null, unopposed: true }], []);
    expect(out.find(i => i.kind === 'marginChange')).toBeUndefined();
  });

  it('a hold counts the streak and reports the margin change', () => {
    const held = view([cand({ name: 'A', partyId: 'RJD', votes: 60000, pill: 'WON' }), cand({ name: 'B', partyId: 'BJP', votes: 40000 })], 20000);
    const out = seatInsights(held, [h(2020, 'RJD', 5000), h(2015, 'RJD', 3000), h(2010, 'BJP', 100)], []);
    expect(out).toEqual([{ kind: 'hold', party: 'RJD', streak: 3 }, { kind: 'marginChange', prevYear: 2020, prev: 5000, now: 20000 }]);
  });

  it('affidavit highlights need at least two candidates with data', () => {
    const withAff = view([
      cand({ name: 'A', partyId: 'X', votes: 10, pill: 'WON', affidavit: { age: 50, assets: 100, liabilities: 0, criminalCases: 0 } }),
      cand({ name: 'B', partyId: 'Y', votes: 5, affidavit: { age: 40, assets: 900, liabilities: 0, criminalCases: 13 } }),
    ], 5);
    expect(seatInsights(withAff, [], [])).toContainEqual({ kind: 'affidavit', withCases: 1, total: 2, winnerCases: 0, richest: { name: 'B', assets: 900 } });
  });

  it('nothing for an uncounted seat; caps at the limit', () => {
    expect(seatInsights(view([cand({ name: 'A' }), cand({ name: 'B' })], null), [h(2020, 'P', 1)], [])).toEqual([]);
    const notes: SeatNote[] = [{ kind: 'threeWay', thirdName: 'C', thirdVotes: 6581, margin: 981 }, { kind: 'spoiler', party: 'JSP', votes: 6581, margin: 981 }];
    expect(seatInsights(v, [h(2020, 'RJD', 1)], notes, 3)).toHaveLength(3);
  });
});
