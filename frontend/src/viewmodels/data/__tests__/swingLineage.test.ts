import { describe, it, expect } from 'vitest';
import { makeComparer } from '../../../model/derive/partyComparer';
import { calculateSwing } from '../useHistoryAnalysis';
import type { ResultRow } from '../../../model/types';

const events = [
  { party_id: 'BRS', predecessor_id: 'TRS', kind: 'rename', effective_date: '2022-12-09', state_id: null, is_successor: true },
  { party_id: 'SSUBT', predecessor_id: 'SHS', kind: 'split', effective_date: '2022-10-10', state_id: null, is_successor: false },
];
const cmp = makeComparer(events, new Map([[2019, '2019-10-24'], [2024, '2024-11-23']]), 1);
const row = (const_id: string, party_id: string) => ({ const_id, party_id, candidate_name: 'A', status: 'WON', votes: 100, margin: 10 }) as unknown as ResultRow;

describe('calculateSwing follows party lineage', () => {
  it('calculateSwing: a rename is not a flip; a split faction seat is labelled split', () => {
    const s = calculateSwing([row('X_1', 'TRS'), row('X_2', 'SHS'), row('X_3', 'INC')],
      new Map([['X_1', row('X_1', 'BRS')], ['X_2', row('X_2', 'SSUBT')], ['X_3', row('X_3', 'SSUBT')]]), { cmp, fromYear: 2019, toYear: 2024 });
    expect([...s.values()].map(e => [e.constId, e.flipped, !!e.split])).toEqual([['X_1', false, false], ['X_2', false, true], ['X_3', true, false]]);
  });

});
