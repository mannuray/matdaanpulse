import { RAW_COMPARER, type PartyComparer } from './partyComparer';
import { partyPageHref } from './partyRecord';
import type { PersonCandidate } from '../types';
import { partyMark } from './partyMeta';

export type ContestStatus = 'LEADING' | 'TRAILING' | 'WON' | 'LOST' | 'PENDING';
export interface ContestView { key: string; year: number | null; electionName: string; constituency: string; constHref: string; partyId: string | null;
  /** The contest's election dashboard with this party's dialog open (null when party-less). */
  partyHref: string | null; partyLabel: string; /** Full party name (falls back to the label). */ partyName: string; mark: string | null; color: string;
  house: 'LS' | 'VS' | null;
  status: ContestStatus; votes: number; share: number | null; margin: number | null; firstUnderParty: boolean }
export interface PersonStats { contests: number; wins: number; /** Contests already decided (finalized, or won). */ decided: number; winRate: number | null;
  /** Houses contested, Lok Sabha first. */ houses: ('LS' | 'VS')[]; parties: string[]; /** Party ids plus display labels (abbreviation, else the id). */
  switches: { from: string; to: string; fromLabel: string; toLabel: string; year: number }[] }
export interface AffidavitPoint { year: number; house: 'LS' | 'VS' | null; assets: number | null; liabilities: number | null; criminalCases: number | null }

const byYearDesc = (a: PersonCandidate, b: PersonCandidate) => (b.election_year ?? 0) - (a.election_year ?? 0);
const byYearAsc = (a: PersonCandidate, b: PersonCandidate) => -byYearDesc(a, b);

export function contestStatus(c: PersonCandidate): ContestStatus {
  if (c.status === 'WON' || c.status === 'LEADING') return c.status;
  if (c.election_status === 'Finalized') return 'LOST';
  if (c.status === 'TRAILING') return 'TRAILING';
  return 'PENDING';
}

export function contestViews(cands: PersonCandidate[]): ContestView[] {
  const first = new Set<string>();
  const seen = new Set<string>();
  [...cands].sort(byYearAsc).forEach(c => {
    if (!c.party_id) return;
    if (seen.size > 0 && !seen.has(c.party_id)) first.add(c.id + c.election_id);
    seen.add(c.party_id);
  });
  return [...cands].sort(byYearDesc).map(c => ({
    key: c.id + c.election_id, year: c.election_year, electionName: c.election_name ?? '', constituency: c.constituency_name ?? '',
    constHref: `/election/${c.election_id}/constituency/${c.const_id}`,
    partyId: c.party_id, partyHref: partyPageHref(c.party_id), partyLabel: c.party_abbreviation ?? c.party_id ?? '',
    partyName: c.party_name ?? c.party_abbreviation ?? c.party_id ?? '', house: c.election_type ?? null,
    mark: partyMark({ symbol_url: c.party_symbol_url, eci_symbol_url: c.party_eci_symbol_url }),
    color: c.party_color ?? 'var(--color-fallback)', status: contestStatus(c), votes: c.votes, share: c.vote_share ?? null,
    margin: c.margin || null, firstUnderParty: first.has(c.id + c.election_id),
  }));
}

/** `cmp`: party lineage — following a party through a rename, merger or split is not a switch. */
export function personStats(cands: PersonCandidate[], cmp: PartyComparer = RAW_COMPARER): PersonStats {
  const decided = cands.filter(c => c.election_status === 'Finalized' || c.status === 'WON');
  const wins = cands.filter(c => c.status === 'WON').length;
  const parties: string[] = [];
  for (const c of [...cands].sort(byYearDesc)) if (c.party_id && !parties.includes(c.party_id)) parties.push(c.party_id);
  const label = new Map<string, string>();
  for (const c of cands) if (c.party_id && c.party_abbreviation && !label.has(c.party_id)) label.set(c.party_id, c.party_abbreviation);
  const lab = (id: string) => label.get(id) ?? id;
  const switches: PersonStats['switches'] = [];
  let prev: string | null = null;
  let prevYear = 0;
  for (const c of [...cands].sort(byYearAsc)) {
    if (!c.party_id) continue;
    if (prev && prev !== c.party_id && cmp.relation(prev, c.party_id, prevYear, c.election_year ?? 0) === 'different') {
      switches.push({ from: prev, to: c.party_id, fromLabel: lab(prev), toLabel: lab(c.party_id), year: c.election_year ?? 0 });
    }
    prev = c.party_id;
    prevYear = c.election_year ?? 0;
  }
  const houses = (['LS', 'VS'] as const).filter(h => cands.some(c => c.election_type === h));
  return { contests: cands.length, wins, decided: decided.length, winRate: decided.length ? Math.round((wins / decided.length) * 100) : null, houses, parties, switches };
}

export function affidavitSeries(cands: PersonCandidate[]): AffidavitPoint[] {
  return [...cands].sort(byYearAsc)
    .filter(c => [c.assets, c.liabilities, c.criminal_cases].some(x => x != null))
    .map(c => ({ year: c.election_year ?? 0, house: c.election_type ?? null, assets: c.assets ?? null, liabilities: c.liabilities ?? null, criminalCases: c.criminal_cases ?? null }));
}

export function ageFrom(dob: string | null, today: Date = new Date()): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age;
}
