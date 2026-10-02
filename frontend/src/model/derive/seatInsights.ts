import type { SeatHistoryEntry } from '../types';
import type { SeatNote, SeatView } from './seatView';

/** Data-backed facts about one seat for the constituency page (each appears only when its data exists). */
export type SeatInsight =
  | { kind: 'flip'; from: string; to: string; fromYear: number }
  | { kind: 'hold'; party: string; streak: number }
  | { kind: 'photoFinish'; pct: number; margin: number }
  | { kind: 'nota'; nota: number; margin: number }
  | { kind: 'incumbent'; name: string; won: boolean }
  | { kind: 'marginChange'; prevYear: number; prev: number; now: number }
  | { kind: 'affidavit'; withCases: number; total: number; winnerCases: number | null; richest: { name: string; assets: number } | null }
  | SeatNote;

/** Below this share of the votes polled, a margin is a photo finish. */
const PHOTO_FINISH_PCT = 1;

/**
 * Ordered by importance: flip/hold, photo finish, NOTA over the margin, incumbent result, margin change, 3-way, spoiler,
 * affidavit highlights. `history` is the seat's past results newest first (seatHistory), `notes` the 3-way/spoiler notes.
 */
export function seatInsights(view: SeatView, history: SeatHistoryEntry[], notes: SeatNote[], limit = 6): SeatInsight[] {
  const out: SeatInsight[] = [];
  const ranked = view.candidates.filter(c => !c.nota);
  const lead = ranked.find(c => c.pill);
  if (!lead || view.totalVotes <= 0) return [];
  const margin = view.margin;

  const prev = history[0];
  if (prev?.party && lead.partyId) {
    if (prev.party !== lead.partyId) out.push({ kind: 'flip', from: prev.party, to: lead.partyId, fromYear: prev.year });
    else {
      let streak = 1;
      for (const e of history) { if (e.party === lead.partyId) streak++; else break; }
      out.push({ kind: 'hold', party: lead.partyId, streak });
    }
  }
  if (margin != null) {
    const pct = Math.round((margin / view.totalVotes) * 1000) / 10;
    if (pct < PHOTO_FINISH_PCT) out.push({ kind: 'photoFinish', pct, margin });
    const nota = view.candidates.find(c => c.nota);
    if (nota && nota.votes > margin) out.push({ kind: 'nota', nota: nota.votes, margin });
  }
  const incumbent = ranked.find(c => c.incumbent);
  if (incumbent) out.push({ kind: 'incumbent', name: incumbent.name, won: !!incumbent.pill });
  if (prev && margin != null && prev.party === lead.partyId) out.push({ kind: 'marginChange', prevYear: prev.year, prev: prev.margin, now: margin });
  out.push(...notes);

  const declared = ranked.filter(c => c.affidavit?.criminalCases != null);
  if (declared.length >= 2) {
    const rich = ranked.filter(c => c.affidavit?.assets != null).sort((a, b) => b.affidavit!.assets! - a.affidavit!.assets!)[0];
    out.push({
      kind: 'affidavit', withCases: declared.filter(c => c.affidavit!.criminalCases! > 0).length, total: declared.length,
      winnerCases: lead.affidavit?.criminalCases ?? null, richest: rich ? { name: rich.name, assets: rich.affidavit!.assets! } : null,
    });
  }
  return out.slice(0, limit);
}
