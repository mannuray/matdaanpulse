import { describe, expect, it } from 'vitest';
import { emitRegions2026 } from '../regions-2026';

describe('emitRegions2026', () => {
  const sql = emitRegions2026([{ constNo: 33, district: 'AS_KAMRUPMETRO' }], { AS_KAMRUPMETRO: 'AS_CENTRALASSAM' }, 'f6a7b8c9-d0e1-2345-f012-567890122026');
  it('tags each seat of that election only, with its district and the district\'s region', () => {
    expect(sql).toContain("UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = 'AS_KAMRUPMETRO'), region_id = (SELECT id FROM regions WHERE code = 'AS_CENTRALASSAM') WHERE election_id = 'f6a7b8c9-d0e1-2345-f012-567890122026' AND const_no = 33;");
  });
  it('fails on a district with no region', () => {
    expect(() => emitRegions2026([{ constNo: 1, district: 'AS_X' }], {}, 'e')).toThrow(/AS_X has no region/);
  });
});
