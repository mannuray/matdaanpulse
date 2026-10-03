/**
 * The current-track tools (leaders, profiles, photos, affidavits, party profiles) for one state: data directory, years
 * and seed names. Bihar keeps its historical file names, so its seeds regenerate unchanged.
 */
import { STATES, electionsOf, type StateCode } from './elections';
import { dataDir } from './load';

export function trackOf(st: StateCode) {
  const s = STATES[st];
  const bihar = st === 'BR';
  const name = (kind: string) => (bihar ? `seed_bihar_${kind}` : `seed_${s.slug}_${kind}`);
  return {
    st, state: s, dir: dataDir(st),
    /** Elections with current-track data: Bihar 2010-2025 (leaders/affidavits), a 2026 state's new election. */
    years: bihar ? [2010, 2015, 2020, 2025] : electionsOf(st).filter(e => e.newElection).map(e => e.year),
    leadersSeed: name('leaders'), photosSeed: name('candidate_photos'), affidavitsSeed: name('affidavits'), partyProfilesSeed: name('party_profiles'),
    /** stableUuid namespace for seatless leaders. */
    leaderNs: bihar ? 'bihar-leader' : `${s.slug}-leader`,
  };
}
