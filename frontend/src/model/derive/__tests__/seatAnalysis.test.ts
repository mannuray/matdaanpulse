import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { analyse } from '../seatAnalysis';

const SHARED = ['types', 'rank', 'match', 'seat', 'notes', 'election', 'index'];

describe('seatAnalysis stays identical to the backend copy', () => {
  it.each(SHARED)('%s.ts', f => {
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
    expect(read(`../seatAnalysis/${f}.ts`)).toBe(read(`../../../../../backend/src/common/seat-analysis/${f}.ts`));
  });
});

describe('seatAnalysis (smoke)', () => {
  it('runs on the frontend lineage copy', () => {
    const seat = { const_id: 'T_1', const_no: 1, reserved: 'GEN' as const, region_id: null, turnout: null, electors: null,
      candidates: [{ person_id: null, name: 'A', party_id: 'BJP', votes: 50, status: 'WON' }, { person_id: null, name: 'B', party_id: 'JMM', votes: 40, status: 'LOST' }] };
    const prev = { ...seat, candidates: [{ ...seat.candidates[0], party_id: 'JVM' }, seat.candidates[1]] };
    const e = (year: number, s: typeof seat) => ({ id: `E${year}`, year, date: `${year}-07-01`, seats: [s], alliances: [], government: null });
    const lineage = [{ party_id: 'BJP', predecessor_id: 'JVM', kind: 'merger', effective_date: '2020-02-17', state_id: null, is_successor: true }];
    const r = analyse({ stateId: 1, current: e(2024, seat), history: [e(2014, prev)], previousAny: e(2014, prev), voteSplits: [], heavyweights: [], lineage });
    expect(r.seats[0].outcome).toEqual({ kind: 'retained', from: 'BJP', from_raw: 'JVM' });
  });
});
