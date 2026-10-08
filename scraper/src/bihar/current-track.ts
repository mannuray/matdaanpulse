/**
 * The current-track tools (leaders, profiles, photos, affidavits, party profiles) for one state: data directory, years,
 * seed names, media paths and seed header options. A state's `currentTrack` overrides in the registry keep its historical
 * values (Bihar), so its seeds regenerate unchanged.
 */
import * as path from 'path';
import { STATES, electionOf, electionsOf, type StateCode } from './elections';
import { dataDir, rawDir } from './load';
import type { LeadersSeedOpts } from './leaders-seed';
import type { PhotosSeedOpts } from './photos';
import type { AffidavitsSeedOpts } from './affidavits';
import type { PartyProfilesSeedOpts } from './party-profiles';

export function trackOf(st: StateCode) {
  const s = STATES[st];
  const o = s.currentTrack;
  const name = (kind: string) => `seed_${s.slug}_${kind}`;
  /** Elections with current-track data: the override's years (Bihar 2010-2025); elsewhere the latest assembly (results site / MyNeta). */
  const years = o ? o.years : electionsOf(st).filter(e => e.resultsSite || e.myneta).map(e => e.year);
  const leadersSeed = name('leaders'), photosSeed = name('candidate_photos'), affidavitsSeed = name('affidavits'), partyProfilesSeed = name('party_profiles');
  return {
    st, state: s, dir: dataDir(st), years,
    leadersSeed, photosSeed, affidavitsSeed, partyProfilesSeed,
    /** stableUuid namespace for seatless leaders. */
    leaderNs: `${s.slug}-leader`,
    /** photos-cli's cache of ECI candidate-wise pages. */
    photosRaw: (year: number) => (o ? path.resolve(__dirname, '../../data/raw', o.photosRaw) : path.join(rawDir(st), String(year), 'cand')),
    /** S3 key of a candidate photo. */
    photoKey: (year: number, constNo: number, serial: number) => (o ? o.photoKey(constNo, serial) : `persons/eci${year}/${s.slug}-${constNo}-${serial}.jpg`),
    mynetaSlug: (year: number) => (o ? o.myneta[year] : electionOf(st, year).myneta!),
    /** Leaders seed options; `leaderYears` are the years of leaders.json (an override's own years win). */
    leadersOpts: (leaderYears: number[]): LeadersSeedOpts =>
      ({ stateId: s.stateId, stateName: s.name, slug: s.slug, seedName: leadersSeed, years: (o ? o.years : leaderYears).map(String) }),
    photosOpts: (year: number): PhotosSeedOpts => ({ seedName: photosSeed, label: `${s.name} ${year}` }),
    affidavitsOpts: (): AffidavitsSeedOpts => ({ seedName: affidavitsSeed, label: o ? o.affidavitsLabel : `${s.name} VS ${years.join(', ')}` }),
    partyProfilesOpts: (year: number): PartyProfilesSeedOpts =>
      ({ seedName: partyProfilesSeed, label: `${s.name} ${year}`, dataFile: `scraper/data/${s.slug}/parties-${year}.json` }),
  };
}

/** The newest current-track election year (photos, party profiles); a clear error when the state has none yet. */
export function latestYear(track: ReturnType<typeof trackOf>): number {
  if (!track.years.length) throw new Error(`${track.state.name} has no current-track election (no results site / MyNeta in the registry)`);
  return track.years[track.years.length - 1];
}
