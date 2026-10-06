import { describe, it, expect } from 'vitest';
import { swingSummary } from '../swing';
import { makeCtx, seat } from './fixtures';
import type { SwingEntry } from '../../../types';

const sw = (constId: string, prevParty: string, currentParty: string, currentMargin: number): [string, SwingEntry] =>
  [constId, { constId, prevParty, currentParty, currentMargin, prevMargin: 100, flipped: prevParty !== currentParty } as SwingEntry];

describe('swingSummary', () => {
  it('a flip won unopposed counts, but shows no margin and sorts after the real margins', () => {
    const unopposed = { ...seat('U', 'BJP', undefined), uncontested: true as const };
    const ctx = makeCtx({ seats: [seat('A', 'BJP', 800), unopposed], swing: new Map([sw('A', 'RJD', 'BJP', 800), sw('U', 'RJD', 'BJP', 0)]) });
    const flipped = swingSummary(ctx).find(s => s.id === 'flipped')!;
    expect(flipped.titleParams).toEqual({ count: 2 });
    expect(flipped.rows.map(r => [r.id, r.value])).toEqual([['seat:A', 800], ['seat:U', null]]);
  });
});
