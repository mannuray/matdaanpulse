import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { makeCtx, seat } from './fixtures';

const seats = [
  seat('u1', 'BJP', 100, 'GEN', 'Uttar Pradesh'), seat('u2', 'BJP', 200, 'GEN', 'Uttar Pradesh'), seat('u3', 'RJD', 300, 'GEN', 'Uttar Pradesh'),
  seat('k1', 'INC', 100, 'GEN', 'Kerala'), seat('k2', 'RJD', 100, 'GEN', 'Kerala'), seat('k3', 'BJP', 100, 'GEN', 'Kerala'),
  seat('b1', 'JDU', 100, 'GEN', 'Bihar'), seat('b2', 'JDU', 500, 'GEN', 'Bihar'),
  seat('x1', 'AIMIM', 100, 'GEN', 'Assam'),
];
const run = (over = {}) => deriveLayerSummary('states', makeCtx({ electionType: 'LS', seats, ...over })).sections.filter(s => s.id !== 'key_stats');

describe('states summary', () => {
  it('state leaderboard (top 10): seats per state, dominant alliance (or party) as sub text', () => {
    // StatesSection.tsx: sorted by seats desc (stable); dominant = alliance name, else the party id.
    const s = run();
    expect(s.map(x => x.id)).toEqual(['state_leaderboard', 'sweep_states', 'competitive_states']);
    expect(s[0].rows.map(r => [r.label, r.value, r.sub])).toEqual([
      ['Uttar Pradesh', 3, 'NDA'], ['Kerala', 3, 'MGB'], ['Bihar', 2, 'NDA'], ['Assam', 1, 'AIMIM'],
    ]);
    expect(s[0].rows[3].seatIds).toEqual(['x1']);
  });

  it('sweep states: dominant share >= 80% (rounded), competitive states: lowest average margin first', () => {
    // Bihar 2/2 = 100%, Assam 1/1 = 100%; UP: NDA 2/3 = 67%. Averages: UP 200, Kerala 100, Bihar 300, Assam 100.
    const s = run();
    expect(s[1].titleParams).toEqual({ count: 2 });
    expect(s[1].rows.map(r => [r.label, r.value, r.valueFormat])).toEqual([['Bihar', 100, 'pct0'], ['Assam', 100, 'pct0']]);
    expect(s[2].rows.map(r => [r.label, r.value, r.valueFormat])).toEqual([['Kerala', 100, 'compact'], ['Assam', 100, 'compact'], ['Uttar Pradesh', 200, 'compact'], ['Bihar', 300, 'compact']]);
  });

  it('works without alliances (dominant party) and is empty for a state election or without state data', () => {
    expect(run({ alliances: [] })[0].rows[0]).toMatchObject({ label: 'Uttar Pradesh', sub: 'BJP' });
    expect(run({ electionType: 'VS' })).toEqual([]);
    expect(run({ seats: [seat('z', 'BJP', 1)] })).toEqual([]);
  });
});
