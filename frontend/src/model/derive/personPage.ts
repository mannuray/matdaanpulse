import type { PersonCandidate } from '../types';
import { partyMark } from './partyMeta';

export type ContestStatus = 'LEADING' | 'TRAILING' | 'WON' | 'LOST' | 'PENDING';
export interface ContestView { key: string; year: number | null; electionName: string; constituency: string; constHref: string; partyId: string | null; partyLabel: string; mark: string | null; color: string;
  status: ContestStatus; votes: number; share: number | null; margin: number | null; firstUnderParty: boolean }
export interface PersonStats { contests: number; wins: number; winRate: number | null; parties: string[]; switches: { from: string; to: string; year: number }[] }
export interface AffidavitPoint { year: number; assets: number | null; liabilities: number | null; criminalCases: number | null }

const byYearDesc = (a: PersonCandidate, b: PersonCandidate) => (b.election_year ?? 0) - (a.election_year ?? 0);
const byYearAsc = (a: PersonCandidate, b: PersonCandidate) => -byYearDesc(a, b);

export function contestStatus(c: PersonCandidate): ContestStatus {
  if (c.status === 'WON' || c.status === 'LEADING' || c.status === 'LOST') return c.status;
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
    partyId: c.party_id, partyLabel: c.party_abbreviation ?? c.party_id ?? '',
    mark: partyMark({ symbol_url: c.party_symbol_url, eci_symbol_url: c.party_eci_symbol_url }),
    color: c.party_color ?? 'var(--color-fallback)', status: contestStatus(c), votes: c.votes, share: c.vote_share ?? null,
    margin: c.margin || null, firstUnderParty: first.has(c.id + c.election_id),
  }));
}

export function personStats(cands: PersonCandidate[]): PersonStats {
  const decided = cands.filter(c => c.election_status === 'Finalized' || c.status === 'WON');
  const wins = cands.filter(c => c.status === 'WON').length;
  const parties: string[] = [];
  for (const c of [...cands].sort(byYearDesc)) if (c.party_id && !parties.includes(c.party_id)) parties.push(c.party_id);
  const switches: PersonStats['switches'] = [];
  let prev: string | null = null;
  for (const c of [...cands].sort(byYearAsc)) {
    if (!c.party_id) continue;
    if (prev && prev !== c.party_id) switches.push({ from: prev, to: c.party_id, year: c.election_year ?? 0 });
    prev = c.party_id;
  }
  return { contests: cands.length, wins, winRate: decided.length ? Math.round((wins / decided.length) * 100) : null, parties, switches };
}

export function affidavitSeries(cands: PersonCandidate[]): AffidavitPoint[] {
  return [...cands].sort(byYearAsc)
    .filter(c => [c.assets, c.liabilities, c.criminal_cases].some(x => x != null))
    .map(c => ({ year: c.election_year ?? 0, assets: c.assets ?? null, liabilities: c.liabilities ?? null, criminalCases: c.criminal_cases ?? null }));
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
