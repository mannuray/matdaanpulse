/**
 * Per-candidate party fixes (scraper/data/<slug>/candidate-fixes.json: year → "<seat>:<serial>" → { partyId, reason }).
 * The DB holds one candidate per party per seat (live ingest relies on it); a report listing one party twice in a seat
 * (UP 2012, seat 72: two "ASP") needs a sourced decision, and the generator refuses such a seat otherwise.
 */
import type { ElectionJson } from './types';

export type CandidateFixes = Record<string, { partyId: string; reason: string }>;

/** "<seat>: <party>" for every seat where a party other than IND/NOTA has more than one candidate. */
export function duplicatePartySeats(json: ElectionJson): string[] {
  return json.seats.flatMap(s => {
    const seen = new Map<string, number>();
    for (const c of s.candidates) if (c.partyId !== 'IND' && c.partyId !== 'NOTA') seen.set(c.partyId, (seen.get(c.partyId) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([p]) => `${s.constNo}: ${p}`);
  });
}

export function applyCandidateFixes(json: ElectionJson, fixes: CandidateFixes): ElectionJson {
  const out = { ...json, seats: json.seats.map(s => ({ ...s, candidates: s.candidates.map(c => ({ ...c })) })) };
  for (const [key, fix] of Object.entries(fixes)) {
    const [seat, serial] = key.split(':').map(Number);
    const c = out.seats.find(s => s.constNo === seat)?.candidates.find(x => x.serial === serial);
    if (!c) throw new Error(`candidate fix ${key}: no such candidate`);
    c.partyId = fix.partyId;
  }
  return out;
}
