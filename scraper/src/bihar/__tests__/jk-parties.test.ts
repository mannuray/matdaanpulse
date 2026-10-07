import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const map: Record<string, { id: string; abbreviation: string | null }> =
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../data/parties/party-map.json'), 'utf8'));
const abbrs = (id: string) => new Set(Object.values(map).filter(p => p.id === id).map(p => p.abbreviation));

describe("J&K's two People's Democratic Fronts", () => {
  it("label Hakeem Yaseen's party (JKPDF) and the 2008 namesake (JKPDFS) apart, never with each other's id", () => {
    expect(abbrs('JKPDF')).toEqual(new Set(['JKPDF']));
    expect(abbrs('JKPDFS')).toEqual(new Set(['JKPDF(S)']));
  });
});

describe("J&K's seeded manifests", () => {
  it('carry the curated alliance colours (the year seeds are written from manifest-<year>.json)', () => {
    for (const y of [2008, 2014, 2024]) {
      const curated = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../data/jk/manifest-${y}.json`), 'utf8')) as { alliances: { color: string }[] };
      const seed = fs.readFileSync(path.resolve(__dirname, `../../../../database/seed_jk_vs_${y}.sql`), 'utf8');
      for (const a of curated.alliances) expect(seed, `${y} ${a.color}`).toContain(`"color":"${a.color}"`);
    }
  });
});
