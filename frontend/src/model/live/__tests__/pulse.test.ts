import { describe, it, expect } from 'vitest';
import { pulseKinds, newUpsets } from '../pulse';
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
