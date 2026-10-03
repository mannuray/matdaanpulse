import { describe, expect, it } from 'vitest';
import { alliancePartyGaps, emitAllianceMoves, emitManifestFixes } from '../manifest-fixes';
import type { ElectionJson } from '../types';

const manifest = JSON.stringify({
  alliances: [{ id: 'UDF', parties: ['INC', 'MUL'] }, { id: 'LDF', parties: ['CPIM', 'KECST'] }],
  leaders: [{ name: 'X', party_id: 'MUL', const_id: 'KL_VS11_1_A' }],
});
const json = { seats: [{ candidates: [{ partyId: 'INC' }, { partyId: 'IUML' }, { partyId: 'CPIM' }, { partyId: 'NOTA' }] }] } as unknown as ElectionJson;

describe('alliancePartyGaps', () => {
  it('lists alliance party ids no candidate of the election has', () => {
    expect(alliancePartyGaps(manifest, json, {})).toEqual(['MUL', 'KECST']);
  });
  it('applies the manifest fixes before checking', () => {
    expect(alliancePartyGaps(manifest, json, { MUL: 'IUML' })).toEqual(['KECST']);
  });
  it('has no gaps without a manifest', () => {
    expect(alliancePartyGaps(null, json, {})).toEqual([]);
  });
});

describe('emitManifestFixes', () => {
  const sql = emitManifestFixes('seed_kl_manifest_fixes_v1', 'Kerala', [{ electionId: 'e-2011', year: 2011, fixes: { MUL: 'IUML' } }]);
  it('replaces the quoted party id in that election only, once (seed_runs)', () => {
    expect(sql).toContain(`UPDATE elections SET manifest_url = replace(manifest_url, '"MUL"', '"IUML"') WHERE id = 'e-2011';`);
    expect(sql).toContain("seed_runs WHERE name = 'seed_kl_manifest_fixes_v1'");
    expect(sql).toMatch(/INSERT INTO seed_runs/);
  });
});

describe('emitAllianceMoves', () => {
  const sql = emitAllianceMoves('seed_manifest_alliances_v1', [
    { electionId: 'e-2011', party: 'JDS', from: 'UDF', to: 'LDF' },
    { electionId: 'e-2011w', party: 'SUCI', from: null, to: 'TMCALL' },
  ]);
  it('moves a party between alliances only while it is still in the old one (admin edits win)', () => {
    expect(sql).toContain("WHERE id = 'e-2011' AND manifest_url::jsonb->'alliances' @> '[{\"id\":\"UDF\",\"parties\":[\"JDS\"]}]'::jsonb;");
  });
  it('adds an unallied party only while no alliance lists it', () => {
    expect(sql).toMatch(/WHERE id = 'e-2011w' AND NOT EXISTS \(SELECT 1 FROM jsonb_array_elements\(manifest_url::jsonb->'alliances'\) x WHERE x->'parties' \? 'SUCI'\);/);
  });
  it('runs once (seed_runs)', () => {
    expect(sql).toContain("seed_runs WHERE name = 'seed_manifest_alliances_v1'");
  });
});
