import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { carryForward, familyOf, relation } from '../comparableParties';

interface Base { case: string; from: string; to: string; state: number }
interface RelationCase extends Base { prev: string; cur: string; expect: string }
interface CarryCase extends Base { party: string; expect: string }
interface FamilyCase { case: string; party: string; date: string; state: number; expect: { root: string; members: string[] } }
const T = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../docs/party-lineage-cases.json'), 'utf8'));

describe('comparable parties (shared case table)', () => {
  it.each(T.relation as RelationCase[])('relation: $case', (c: RelationCase) => {
    expect(relation(T.events, c.prev, c.cur, { fromDate: c.from, toDate: c.to, stateId: c.state })).toBe(c.expect);
  });
  it.each(T.carryForward as CarryCase[])('carryForward: $case', (c: CarryCase) => {
    expect(carryForward(T.events, c.party, c.from, c.to, c.state)).toBe(c.expect);
  });
  it.each(T.familyOf as FamilyCase[])('familyOf: $case', (c: FamilyCase) => {
    const f = familyOf(T.events, c.party, c.date, c.state);
    expect({ root: f.root, members: [...f.members].sort() }).toEqual({ root: c.expect.root, members: [...c.expect.members].sort() });
  });
  it('a lineage cycle throws', () => {
    const c = T.cycle;
    expect(() => carryForward(c.events, c.party, c.from, c.to, c.state)).toThrow(c.expectError);
  });
});

describe('comparableParties stays identical to the backend copy', () => {
  it('frontend/src/model/derive/comparableParties.ts equals backend/src/common/comparable-parties.ts', () => {
    const read = (p: string) => fs.readFileSync(path.resolve(__dirname, p), 'utf8');
    expect(read('../comparableParties.ts')).toBe(read('../../../../../backend/src/common/comparable-parties.ts'));
  });
});
