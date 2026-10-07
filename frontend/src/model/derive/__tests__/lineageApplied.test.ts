import { describe, it, expect } from 'vitest';
import { makeComparer } from '../partyComparer';
import { calculatePartyTrend } from '../intelligence';
import { seatInsights } from '../seatInsights';
import { personStats } from '../personPage';
import { compareRegions } from '../regionComparison';
import { deriveLayerInsight } from '../layerInsights';
import type { ResultRow, SwingEntry } from '../../types';

// TRS was renamed BRS (Dec 2022); Shiv Sena split (Oct 2022) — Shiv Sena (UBT) is the non-successor faction.
const events = [
  { party_id: 'BRS', predecessor_id: 'TRS', kind: 'rename', effective_date: '2022-12-09', state_id: null, is_successor: true },
  { party_id: 'SSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_id: null, is_successor: false },
];
const cmp = makeComparer(events, new Map([[2018, '2018-12-11'], [2019, '2019-10-24'], [2023, '2023-12-03'], [2024, '2024-11-23']]), 1);
const row = (const_id: string, party_id: string, candidate_name = 'A', status = 'WON', votes = 100, margin = 10) =>
  ({ const_id, party_id, candidate_name, status, votes, margin }) as unknown as ResultRow;

describe('cross-election comparisons follow party lineage', () => {
  it('calculatePartyTrend: a renamed party is one series (carried to the latest year)', () => {
    const t = calculatePartyTrend([{ year: 2018, results: [row('X_1', 'TRS')] }, { year: 2023, results: [row('X_1', 'BRS')] }], cmp);
    expect(t.map(p => [p.party, p.year])).toEqual([['BRS', 2018], ['BRS', 2023]]);
  });

  it('seatInsights: a rename holds the seat; a split faction is a split, not a flip', () => {
    const view = (party: string) => ({ totalVotes: 1000, margin: 50, candidates: [{ name: 'A', partyId: party, votes: 600, pill: 'WON' }] }) as never;
    const hist = (party: string) => [{ year: 2019, party, candidate: 'A', margin: 30 }];
    expect(seatInsights(view('BRS'), hist('TRS'), [], 6, { cmp, year: 2024 })[0]).toMatchObject({ kind: 'hold', party: 'BRS', streak: 2 });
    expect(seatInsights(view('SSUBT'), hist('SHS'), [], 6, { cmp, year: 2024 })[0]).toMatchObject({ kind: 'split', from: 'SHS', to: 'SSUBT', fromYear: 2019 });
  });

  it('personStats: a person who followed a rename or a split did not switch parties', () => {
    const c = (party_id: string, election_year: number) => ({ id: party_id + election_year, election_id: 'e' + election_year, party_id, election_year, status: 'WON', election_status: 'Finalized', election_type: 'VS' }) as never;
    expect(personStats([c('SHS', 2019), c('SSUBT', 2024)], cmp).switches).toEqual([]);
    expect(personStats([c('SHS', 2019), c('INC', 2024)], cmp).switches.map(s => s.to)).toEqual(['INC']);
  });

  it('compareRegions (party mode): previous parties are carried forward before grouping, without double counting', () => {
    const cur = { regions: [{ id: 1, name: 'R', seats: 2, parties: [{ party_id: 'BRS', votes: 60, won: 2 }, { party_id: 'INC', votes: 40, won: 0 }] }] };
    const prev = { regions: [{ id: 1, name: 'R', seats: 2, parties: [{ party_id: 'TRS', votes: 50, won: 1 }, { party_id: 'INC', votes: 50, won: 1 }] }] };
    const rows = compareRegions(cur, prev, { mode: 'party', partyMeta: new Map(), labels: { statewide: 'All', others: 'Others' }, carry: p => cmp.carry(p, 2018, 2023) });
    const brs = rows[0].groups.find(g => g.id === 'BRS')!;
    expect(brs.share).toEqual([50, 60]);
    expect(brs.won).toEqual([1, 2]);
  });

  it('layer insights (swing): split seats form their own chips, tagged split, not flips', () => {
    const swing = new Map<string, SwingEntry>([
      ['X_1', { constId: 'X_1', prevParty: 'SHS', currentParty: 'SSUBT', currentMargin: 1, prevMargin: 0, flipped: false, split: true }],
      ['X_2', { constId: 'X_2', prevParty: 'INC', currentParty: 'SSUBT', currentMargin: 1, prevMargin: 0, flipped: true }],
    ]);
    const ins = deriveLayerInsight('swing', { electionType: 'VS', seats: [], alliances: [], partyColor: new Map(), swing, prevYear: 2019 } as never)!;
    expect(ins.headlineParams.flipped).toBe(1);
    expect(ins.chips.map(c => [c.label, c.tag ?? null])).toEqual([['INC → SSUBT', null], ['SHS → SSUBT', 'split']]);
  });
});
