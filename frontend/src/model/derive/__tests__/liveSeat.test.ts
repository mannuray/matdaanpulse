import { describe, it, expect } from 'vitest';
import { trendPoints, narrowedLine, upsetBadges } from '../liveSeat';
import type { SeatLive, SeatBaseline } from '../seatAnalysis';

describe('trendPoints with repeated rounds', () => {
  it('keeps the last row per round, carries seq for keys, and continues a missing round number from the previous one', () => {
    const r = (seq: number, round: number | null, lp: string, m: number) => ({ seq, r: round, rt: 20, lp, m, v: 1, declared: false, at: '' });
    expect(trendPoints([r(1, 1, 'BJP', 100), r(2, 2, 'BJP', 150), r(3, 2, 'RJD', 40), r(4, null, 'RJD', 90)])).toEqual([
      { seq: 1, x: 1, y: 100, party: 'BJP', switched: false },
      { seq: 3, x: 2, y: 40, party: 'RJD', switched: true },
      { seq: 4, x: 3, y: 90, party: 'RJD', switched: false },
    ]);
  });
});

describe('live seat helpers', () => {
  it('trendPoints: one point per round, party segments, lead switches marked', () => {
    const rounds = [{ r: 1, lp: 'BJP', m: 300 }, { r: 2, lp: 'BJP', m: 120 }, { r: 3, lp: 'RJD', m: 80 }, { r: 4, lp: 'RJD', m: 342 }].map((x, i) => ({ seq: i + 1, rt: 20, v: 1000, declared: false, at: '', ...x }));
    expect(trendPoints(rounds)).toEqual([
      { seq: 1, x: 1, y: 300, party: 'BJP', switched: false }, { seq: 2, x: 2, y: 120, party: 'BJP', switched: false },
      { seq: 3, x: 3, y: 80, party: 'RJD', switched: true }, { seq: 4, x: 4, y: 342, party: 'RJD', switched: false },
    ]);
  });
  it('narrowedLine: from the trail\'s last 3 points, when narrowing or widening', () => {
    const trail = { points: [{ r: 1, lp: 'X', m: 4000, v: 1 }, { r: 2, lp: 'X', m: 2890, v: 1 }, { r: 3, lp: 'X', m: 1200, v: 1 }, { r: 4, lp: 'X', m: 342, v: 1 }], lc: 0, pk: 4000 };
    expect(narrowedLine(trail, 'narrowing')).toEqual({ kind: 'narrowed', from: 2890, to: 342, rounds: 3 });
    expect(narrowedLine(trail, 'stable')).toBeNull();
    expect(narrowedLine({ points: [trail.points[0]], lc: 0, pk: null }, 'narrowing')).toBeNull();
  });
  it('upsetBadges: names the sitting MLA, the stronghold holder and the heavyweight', () => {
    const live = { upsets: ['sitting_trailing', 'stronghold_trailing', 'heavyweight_trailing'], margin: 342 } as unknown as SeatLive;
    const base = { sitting: { name: 'Asha Devi', party: 'BJP' }, class_before: { holder: 'BJP', since: 2005 }, heavyweights: [{ name: 'Q', party: 'INC' }] } as unknown as SeatBaseline;
    expect(upsetBadges(live, base)).toEqual([
      { kind: 'sitting_trailing', name: 'Asha Devi', party: 'BJP', margin: 342 },
      { kind: 'stronghold_trailing', party: 'BJP', since: 2005 },
      { kind: 'heavyweight_trailing', name: 'Q', party: 'INC' },
    ]);
  });
});
