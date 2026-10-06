import { describe, it, expect } from 'vitest';
import { majorityOf } from '../majority';
import { deriveScoreboard } from '../scoreboard';

describe('majorityOf', () => {
  it('the manifest milestone, else half the seats plus one, or none when the manifest says so (Andhra 2009: part of an undivided assembly)', () => {
    expect(majorityOf({ milestones: [{ label: 'Majority', value: 88 }] }, 175)).toBe(88);
    expect(majorityOf({ milestones: [] }, 175)).toBe(88);
    expect(majorityOf(null, 60)).toBe(31);
    expect(majorityOf({ milestones: [], no_majority: true }, 175)).toBeNull();
  });
  it('deriveScoreboard names no winner without a majority', () => {
    const sb = deriveScoreboard([], [{ party_id: 'INC', party_name: 'INC', color: '#38C6F4', seats: 106 }] as never, new Map([['INC', 38.7]]), 175, null);
    expect([sb.majority, sb.winnerId ?? null, sb.marginOverMajority]).toEqual([null, null, null]);
  });
});
