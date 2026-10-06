import { isUncontested } from './uncontested';
import type { ResultRow, CandidateResult, AnalysisEntry, SeatHistoryEntry, SeatLiveState } from '../types';
import { isNota, type PartyMeta } from './partyMeta';

export type SeatPill = 'LEADING' | 'WON' | null;
export interface SeatCandidateView {
  key: string; name: string; partyId: string | null; partyLabel: string; mark: string | null; color: string;
  votes: number; share: number; pill: SeatPill; incumbent: boolean; photo: string | null;
  personId: string | null; nota: boolean;
  affidavit: { age: number | null; assets: number | null; liabilities: number | null; criminalCases: number | null } | null;
}
export interface SeatView { candidates: SeatCandidateView[]; others: { count: number; votes: number; share: number } | null; totalVotes: number; margin: number | null;
  /** Won unopposed (no poll): no margin, no shares. */ uncontested?: boolean }

const pct = (votes: number, total: number) => (total > 0 ? Math.round((votes / total) * 1000) / 10 : 0);
const joinKey = (partyId: string | null | undefined, name: string) => `${partyId ?? ''}|${name.trim().toUpperCase()}`;

export function buildSeatView(rows: ResultRow[], o: { partyMeta: Map<string, PartyMeta>; partyColor: Map<string, string>; detail?: CandidateResult[] | null; limit?: number }): SeatView {
  const total = rows.reduce((s, r) => s + (Number(r.votes) || 0), 0);
  const byKey = new Map((o.detail ?? []).map(c => [joinKey(c.party?.id ?? null, c.name), c]));
  const sorted = [...rows].sort((a, b) => {
    const na = isNota(a.party_id, a.candidate_name), nb = isNota(b.party_id, b.candidate_name);
    if (na !== nb) return na ? 1 : -1;
    return (b.votes || 0) - (a.votes || 0);
  });
  const all = sorted.map((r): SeatCandidateView => {
    const nota = isNota(r.party_id, r.candidate_name);
    const d = byKey.get(joinKey(r.party_id, r.candidate_name));
    const m = r.party_id ? o.partyMeta.get(r.party_id) : undefined;
    const counted = total > 0;
    const hasAffidavit = !!d && [d.age, d.assets, d.liabilities, d.criminal_cases].some(x => x != null);
    return {
      key: `${r.party_id || ''}-${r.candidate_name}`,
      name: r.candidate_name,
      partyId: nota ? null : r.party_id || null,
      partyLabel: nota ? '' : m?.abbreviation ?? r.party_id ?? '',
      mark: nota ? null : m?.mark ?? null,
      color: (r.party_id && o.partyColor.get(r.party_id)) || 'var(--color-fallback)',
      votes: Number(r.votes) || 0,
      share: pct(Number(r.votes) || 0, total),
      pill: counted && (r.status === 'WON' || r.status === 'LEADING') ? r.status : null,
      incumbent: !!d?.is_incumbent,
      photo: d?.person?.photo_url ?? null,
      personId: nota ? null : d?.person_id ?? d?.person?.id ?? null,
      nota,
      affidavit: hasAffidavit ? { age: d!.age ?? null, assets: d!.assets ?? null, liabilities: d!.liabilities ?? null, criminalCases: d!.criminal_cases ?? null } : null,
    };
  });
  const limit = o.limit ?? Infinity;
  const shown = all.slice(0, limit);
  const rest = all.slice(limit);
  const restVotes = rest.reduce((s, c) => s + c.votes, 0);
  const leaderRow = total > 0 ? sorted.find(r => r.status === 'WON' || r.status === 'LEADING') : undefined;
  return {
    candidates: shown,
    others: rest.length ? { count: rest.length, votes: restVotes, share: pct(restVotes, total) } : null,
    totalVotes: total,
    margin: leaderRow ? Number(leaderRow.margin) || null : null,
    uncontested: isUncontested(rows),
  };
}

/** Counting / Declared / Countermanded / Adjourned chip of a seat; null hides it (election not started, or status unknown). */
export type LiveChipState = { kind: 'counting'; round: { current: number; total: number } | null } | { kind: 'declared' } | { kind: 'countermanded' } | { kind: 'adjourned' } | null;

/** One rule for the seat dialog and the constituency page: the snapshot's seat state (when ingested) wins, then declared once the election is final or the seat has a winner. */
export function liveChipState(
  status: 'Upcoming' | 'Live' | 'Finalized' | null | undefined,
  rows: ResultRow[],
  detail: { current_round?: number | null; total_rounds?: number | null } | null,
  seat?: SeatLiveState | null,
): LiveChipState {
  if (!status || status === 'Upcoming') return null;
  if (status === 'Finalized') return { kind: 'declared' };
  if (seat?.state === 'countermanded' || seat?.state === 'adjourned') return { kind: seat.state };
  if (seat?.state === 'declared' || rows.some(r => r.status === 'WON')) return { kind: 'declared' };
  const round = seat?.cr && seat.tr ? { current: seat.cr, total: seat.tr }
    : detail?.current_round && detail.total_rounds ? { current: detail.current_round, total: detail.total_rounds } : null;
  return { kind: 'counting', round };
}

export function seatHistory(analysis: AnalysisEntry | null, currentYear: number): SeatHistoryEntry[] {
  const list = (analysis?.incumbency as { seat_history?: SeatHistoryEntry[] } | undefined)?.seat_history ?? [];
  return list.filter(h => h.year !== currentYear).sort((a, b) => b.year - a.year)
    .map(h => ({ ...h, unopposed: !h.runner_up && !h.margin }));
}

export type SeatNote = { kind: 'threeWay'; thirdName: string; thirdVotes: number; margin: number } | { kind: 'spoiler'; party: string; votes: number; margin: number };

export function seatNotes(view: SeatView, analysis: AnalysisEntry | null): SeatNote[] {
  const notes: SeatNote[] = [];
  const ranked = view.candidates.filter(c => !c.nota);
  if (view.totalVotes > 0 && view.margin != null && ranked.length >= 3 && ranked[2].votes > view.margin) {
    notes.push({ kind: 'threeWay', thirdName: ranked[2].name, thirdVotes: ranked[2].votes, margin: view.margin });
  }
  const sp = (analysis?.incumbency as { spoiler?: { spoiler_party: string; spoiler_votes: number; winner_margin: number } } | undefined)?.spoiler;
  if (sp) notes.push({ kind: 'spoiler', party: sp.spoiler_party, votes: sp.spoiler_votes, margin: sp.winner_margin });
  return notes;
}

export function detailToRows(constId: string, detail: CandidateResult[]): ResultRow[] {
  return detail.map(c => ({ const_id: constId, party_id: c.party?.id ?? (isNota(null, c.name) ? 'NOTA' : ''), candidate_name: c.name, votes: c.votes, status: c.status ?? 'PENDING', margin: c.margin }));
}
