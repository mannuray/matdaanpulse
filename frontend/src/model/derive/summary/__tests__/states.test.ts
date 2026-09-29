import { describe, it, expect } from 'vitest';
import { deriveLayerSummary } from '../index';
import { makeCtx, seat } from './fixtures';

const seats = [
  seat('u1', 'BJP', 100, 'GEN', 'Uttar Pradesh'), seat('u2', 'BJP', 200, 'GEN', 'Uttar Pradesh'), seat('u3', 'RJD', 300, 'GEN', 'Uttar Pradesh'),
  seat('k1', 'INC', 100, 'GEN', 'Kerala'), seat('k2', 'RJD', 100, 'GEN', 'Kerala'), seat('k3', 'BJP', 100, 'GEN', 'Kerala'),
  seat('b1', 'JDU', 100, 'GEN', 'Bihar'), seat('b2', 'RJD', 100, 'GEN', 'Bihar'),
  seat('x1', 'AIMIM', 100, 'GEN', 'Assam'),
];
const run = (over = {}) => deriveLayerSummary('states', makeCtx({ electionType: 'LS', seats, ...over })).sections;

describe('states summary', () => {
  it('states led per alliance, with the state list', () => {
    // layerInsights.states: the alliance with most seats leads a state (ties: first alliance seen).
    // UP: NDA 2-1; Kerala: MGB 2-1; Bihar: 1-1 tie -> JDU (NDA) is first; Assam: no alliance seat -> no leader.
    const s = run();
    expect(s.map(x => x.id)).toEqual(['states_by_alliance']);
    expect(s[0].rows.map(r => [r.label, r.value, r.sub])).toEqual([['NDA', 2, 'Bihar, Uttar Pradesh'], ['MGB', 1, 'Kerala']]);
    expect(s[0].rows[1].seatIds).toEqual(['k1', 'k2', 'k3']);
  });

  it('is empty for a state election, without alliances or without state data', () => {
    expect(run({ electionType: 'VS' })).toEqual([]);
    expect(run({ alliances: [] })).toEqual([]);
    expect(run({ seats: [seat('z', 'BJP', 1)] })).toEqual([]);
  });
});
