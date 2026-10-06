import * as fs from 'fs';
import * as path from 'path';
import { carryForward, familyOf, relation } from './comparable-parties';

const T = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/party-lineage-cases.json'), 'utf8'));

describe('comparable parties (shared case table)', () => {
  it.each(T.relation as any[])('relation: $case', c => {
    expect(relation(T.events, c.prev, c.cur, { fromDate: c.from, toDate: c.to, stateId: c.state })).toBe(c.expect);
  });
  it.each(T.carryForward as any[])('carryForward: $case', c => {
    expect(carryForward(T.events, c.party, c.from, c.to, c.state)).toBe(c.expect);
  });
  it.each(T.familyOf as any[])('familyOf: $case', c => {
    const f = familyOf(T.events, c.party, c.date, c.state);
    expect({ root: f.root, members: [...f.members].sort() }).toEqual({ root: c.expect.root, members: [...c.expect.members].sort() });
  });
  it('a lineage cycle throws', () => {
    const c = T.cycle;
    expect(() => carryForward(c.events, c.party, c.from, c.to, c.state)).toThrow(c.expectError);
  });
});
