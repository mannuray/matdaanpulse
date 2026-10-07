import { describe, it, expect } from 'vitest';
import { pulseKinds, newUpsets, liveStep } from '../pulse';
import type { Upset } from '../../derive/seatAnalysis';
import type { LeaderChange } from '../liveUpdates';

const ch = (const_id: string, kind: 'won' | 'lead', prevParty?: string): LeaderChange => ({ const_id, party_id: 'BJP', prevParty, margin: 10, kind });
describe('pulse kinds', () => {
  it('precedence upset > switch > declared > update', () => {
    const k = pulseKinds([ch('A', 'lead', 'RJD'), ch('B', 'won', 'BJP'), ch('C', 'lead'), ch('D', 'lead', 'RJD')],
      new Map(), new Map([['D', ['sitting_trailing']], ['E', ['stronghold_trailing']]]));
    expect([...k]).toEqual([['A', 'switch'], ['B', 'declared'], ['C', 'update'], ['D', 'upset'], ['E', 'upset']]);
  });
  it('an upset already present before is not new', () => {
    expect(newUpsets(new Map([['A', ['sitting_trailing']]]), new Map([['A', ['sitting_trailing']]]))).toEqual([]);
    expect(newUpsets(new Map([['A', ['sitting_trailing']]]), new Map([['A', ['sitting_trailing', 'heavyweight_trailing']]]))).toEqual([{ const_id: 'A', upset: 'heavyweight_trailing' }]);
  });
});

describe('liveStep', () => {
  const rows = (party: string, status = 'LEADING') => [{ const_id: 'A', party_id: party, candidate_name: 'x', votes: 10, status, margin: 5 }];
  const st = (version: number, party: string, upsets: [string, Upset[]][] = [], electionId = 'e') => ({ electionId, version, results: rows(party), upsets: new Map(upsets) });
  it('the baseline arriving after the first snapshot does not turn existing upsets into news', () => {
    let s = liveStep(null, st(1, 'BJP')).state;                                   // first snapshot: no live analysis yet
    const quiet = liveStep(s, st(1, 'BJP', [['A', ['sitting_trailing']]]));       // same version, baseline loaded
    expect(quiet.kinds.size).toBe(0);
    s = quiet.state;
    const next = liveStep(s, st(2, 'BJP', [['A', ['sitting_trailing']]]));
    expect([...next.kinds]).toEqual([]);
    expect(next.ups).toEqual([]);
  });
  it('a new version with a lead switch and a new upset pulses; an election switch never does', () => {
    const s = liveStep(null, st(1, 'BJP')).state;
    const r = liveStep(s, st(2, 'RJD', [['A', ['heavyweight_trailing']]]));
    expect([...r.kinds]).toEqual([['A', 'upset']]);
    expect(r.ups).toEqual([{ const_id: 'A', upset: 'heavyweight_trailing' }]);
    expect(liveStep(r.state, st(5, 'INC', [['A', ['sitting_trailing']]], 'other')).kinds.size).toBe(0);
  });
});
