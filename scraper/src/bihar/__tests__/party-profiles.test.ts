import { describe, it, expect } from 'vitest';
import { currentPath, emitPartyProfilesSeed, symbolsSeedLine, type PartyProfile } from '../party-profiles';

const rjd: PartyProfile = {
  id: 'RJD', name: 'Rashtriya Janata Dal', abbreviation: 'RJD', eci_recognition: 'State', founded_year: 1997, leader_name: 'Lalu Prasad Yadav',
  headquarters: 'Patna, Bihar', website: 'https://rjd.co.in', wikipedia_url: 'https://en.wikipedia.org/wiki/Rashtriya_Janata_Dal', color: '#1C8A3C',
  description: "Bihar's largest opposition party, founded by Lalu Prasad Yadav.", eci_symbol: 'Hurricane lamp', sources: ['https://en.wikipedia.org/wiki/Rashtriya_Janata_Dal'],
  logo: { file: 'RJD-logo.svg', commons: 'File:RJD.svg', source_url: 'https://commons.wikimedia.org/wiki/File:RJD.svg', author: "O'Neil", licence: 'CC BY-SA 4.0' },
  eci_image: null,
};

describe('party profiles seed', () => {
  it('fills empty fields only, tidies name spacing, colours only placeholder greys, and is run-once', () => {
    const sql = emitPartyProfilesSeed([rjd], { RJD: { logo: '/symbols/logos/RJD.svg' } });
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_party_profiles')");
    expect(sql).toContain("abbreviation = COALESCE(abbreviation, 'RJD')");
    expect(sql).toContain("founded_year = COALESCE(founded_year, 1997)");
    expect(sql).toContain("description = COALESCE(description, 'Bihar''s largest opposition party, founded by Lalu Prasad Yadav.')");
    expect(sql).toContain("eci_recognition = COALESCE(eci_recognition, 'State')");
    expect(sql).toContain("color = CASE WHEN color IS NULL OR upper(color) IN ('#808080', '#9CA3AF') THEN '#1C8A3C' ELSE color END");
    expect(sql).toContain("name = regexp_replace(name, '\\s+', ' ', 'g')");
    expect(sql).toContain("WHERE id = 'RJD';");
  });
  it('credits each approved image every run, by its served path', () => {
    const sql = emitPartyProfilesSeed([rjd], { RJD: { logo: '/symbols/logos/RJD.svg' } });
    const always = sql.slice(0, sql.indexOf('\\if :seed_apply'));
    expect(always).toContain("('/symbols/logos/RJD.svg', 'https://commons.wikimedia.org/wiki/File:RJD.svg', 'O''Neil', 'CC BY-SA 4.0')");
    expect(always).toContain('ON CONFLICT (url) DO NOTHING;');
  });
  it('clears a wrong image once, only while the old path is still set (an admin upload is never touched)', () => {
    const sql = emitPartyProfilesSeed([{ ...rjd, id: 'HAMS' }], {}, { HAMS: { logo: '/symbols/logos/HAMS.svg' } });
    const body = sql.slice(sql.indexOf('\\if :seed_apply'));
    expect(body).toContain("UPDATE parties SET symbol_url = NULL WHERE id = 'HAMS' AND symbol_url = '/symbols/logos/HAMS.svg';");
  });
  it('skips nulls, so a missing fact never blanks a field', () => {
    const sql = emitPartyProfilesSeed([{ ...rjd, website: null, color: null, logo: null }], {});
    expect(sql).not.toContain('website =');
    expect(sql).not.toContain('color =');
    expect(sql).not.toContain('INSERT INTO image_credits');
  });
  it('reads a party\'s current paths from the symbols seed without confusing symbol_url and eci_symbol_url', () => {
    const seed = "UPDATE parties SET eci_symbol_url = '/symbols/eci/BSP.png' WHERE id = 'BSP';\nUPDATE parties SET symbol_url = '/symbols/logos/RJD.svg', eci_symbol_url = '/symbols/eci/RJD.jpg' WHERE id = 'RJD';\n";
    expect(currentPath(seed, 'BSP', 'symbol_url')).toBeNull();
    expect(currentPath(seed, 'BSP', 'eci_symbol_url')).toBe('/symbols/eci/BSP.png');
    expect(currentPath(seed, 'RJD', 'symbol_url')).toBe('/symbols/logos/RJD.svg');
    expect(currentPath(seed, 'RJD', 'eci_symbol_url')).toBe('/symbols/eci/RJD.jpg');
  });
  it('writes the symbols seed line for a party', () => {
    expect(symbolsSeedLine('RJD', '/symbols/logos/RJD.svg', '/symbols/eci/RJD.svg')).toBe("UPDATE parties SET symbol_url = '/symbols/logos/RJD.svg', eci_symbol_url = '/symbols/eci/RJD.svg' WHERE id = 'RJD';");
    expect(symbolsSeedLine('JSP', '/symbols/logos/JSP.png', null)).toBe("UPDATE parties SET symbol_url = '/symbols/logos/JSP.png' WHERE id = 'JSP';");
    expect(symbolsSeedLine('X', null, null)).toBeNull();
  });
});
