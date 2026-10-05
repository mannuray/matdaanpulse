import { describe, expect, it } from 'vitest';
import { emitStateRegions } from '../regions';

const base = {
  stateId: 9, stateName: 'Goa', seatCount: 2,
  districts: [{ code: 'GA_NORTHGOA', name: 'North Goa' }, { code: 'GA_SOUTHGOA', name: 'South Goa' }],
  regions: [{ code: 'GA_NORTH', name: 'North Goa', districts: ['GA_NORTHGOA'] }, { code: 'GA_SOUTH', name: 'South Goa', districts: ['GA_SOUTHGOA'] }],
  seats: { 1: 'GA_NORTHGOA', 2: 'GA_SOUTHGOA' } as Record<number, string>,
  electionIds: ['a', 'b'],
};

describe('emitStateRegions', () => {
  const sql = emitStateRegions(base);
  it('inserts the districts and regions fill-only', () => {
    expect(sql).toContain("INSERT INTO districts (state_id, name, code) VALUES (9, 'North Goa', 'GA_NORTHGOA') ON CONFLICT (code) DO NOTHING;");
    expect(sql).toContain("INSERT INTO regions (state_id, name, code) VALUES (9, 'South Goa', 'GA_SOUTH') ON CONFLICT (state_id, code) DO NOTHING;");
  });
  it('tags each seat of the given elections with its district and region', () => {
    expect(sql).toContain("UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'GA_NORTHGOA'), region_id = (SELECT id FROM regions WHERE state_id = 9 AND code = 'GA_NORTH') WHERE election_id IN ('a', 'b') AND const_no = 1;");
  });
  it('refuses a missing seat, an unknown district or a district in no region', () => {
    expect(() => emitStateRegions({ ...base, seats: { 1: 'GA_NORTHGOA' } })).toThrow(/seat 2 has no district/);
    expect(() => emitStateRegions({ ...base, seats: { 1: 'GA_NORTHGOA', 2: 'GA_X' } })).toThrow(/GA_X is not a district/);
    expect(() => emitStateRegions({ ...base, regions: [base.regions[0]] })).toThrow(/GA_SOUTHGOA is in no region/);
  });
});
