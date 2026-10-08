import { describe, it, expect } from 'vitest';
import * as path from 'path';
import { latestYear, trackOf } from '../current-track';
import { STATES, electionOf } from '../elections';
import { BIHAR_AFFIDAVITS, MYNETA_SLUGS } from '../affidavits';
import { BIHAR_LEADERS } from '../leaders-seed';
import { BIHAR_PHOTOS } from '../photos';
import { BIHAR_PARTIES } from '../party-profiles';

describe('trackOf', () => {
  it('current-track years are the elections with a results site or MyNeta page (the latest assembly), not every new election', () => {
    expect(trackOf('DL').years).toEqual([2025]);
    expect(trackOf('OD').years).toEqual([2024]);
    expect(trackOf('WB').years).toEqual([2026]);
    expect(trackOf('UP').years).toEqual([]);
    expect(trackOf('BR').years).toEqual([2010, 2015, 2020, 2025]);
  });
});

describe('latestYear', () => {
  it('is the newest current-track election, and a clear error for a state without one (Phase 3A states until 2027)', () => {
    expect(latestYear(trackOf('DL'))).toBe(2025);
    expect(() => latestYear(trackOf('UP'))).toThrow(/Uttar Pradesh has no current-track election/);
  });
});

// The "before" values: what the CLIs computed with their former `ST === 'BR'` branches.
describe('trackOf: per-state names and paths (Bihar keeps its historical ones)', () => {
  const scraper = path.resolve(__dirname, '../../..');
  it('Bihar', () => {
    const t = trackOf('BR');
    expect([t.leadersSeed, t.photosSeed, t.affidavitsSeed, t.partyProfilesSeed, t.leaderNs])
      .toEqual(['seed_bihar_leaders', 'seed_bihar_candidate_photos', 'seed_bihar_affidavits', 'seed_bihar_party_profiles', 'bihar-leader']);
    expect(t.photosRaw(2025)).toBe(path.join(scraper, 'data/raw/eci2025'));
    expect(t.photoKey(2025, 12, 3)).toBe('persons/eci2025/12-3.jpg');
    expect(t.years.map(t.mynetaSlug)).toEqual(['bih2010', 'bihar2015', 'bihar2020', 'Bihar2025']);
    expect(t.years.map(t.mynetaSlug)).toEqual(t.years.map(y => MYNETA_SLUGS[y]));
    expect(t.leadersOpts([2025])).toEqual(BIHAR_LEADERS);
    expect(t.photosOpts(2025)).toEqual(BIHAR_PHOTOS);
    expect(t.affidavitsOpts()).toEqual(BIHAR_AFFIDAVITS);
    expect(t.partyProfilesOpts(2025)).toEqual(BIHAR_PARTIES);
  });
  it('another state (Delhi)', () => {
    const t = trackOf('DL');
    expect([t.leadersSeed, t.photosSeed, t.affidavitsSeed, t.partyProfilesSeed, t.leaderNs])
      .toEqual(['seed_dl_leaders', 'seed_dl_candidate_photos', 'seed_dl_affidavits', 'seed_dl_party_profiles', 'dl-leader']);
    expect(t.photosRaw(2025)).toBe(path.join(scraper, 'data/raw/dl/2025/cand'));
    expect(t.photoKey(2025, 12, 3)).toBe('persons/eci2025/dl-12-3.jpg');
    expect(t.mynetaSlug(2025)).toBe(electionOf('DL', 2025).myneta);
    expect(t.leadersOpts([2020, 2025])).toEqual({ stateId: STATES.DL.stateId, stateName: STATES.DL.name, slug: 'dl', seedName: 'seed_dl_leaders', years: ['2020', '2025'] });
    expect(t.photosOpts(2025)).toEqual({ seedName: 'seed_dl_candidate_photos', label: `${STATES.DL.name} 2025` });
    expect(t.affidavitsOpts()).toEqual({ seedName: 'seed_dl_affidavits', label: `${STATES.DL.name} VS 2025` });
    expect(t.partyProfilesOpts(2025)).toEqual({ seedName: 'seed_dl_party_profiles', label: `${STATES.DL.name} 2025`, dataFile: 'scraper/data/dl/parties-2025.json' });
  });
});
