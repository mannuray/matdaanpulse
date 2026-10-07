import type { Baseline, SeatLive } from './seatAnalysis';
import type { DominanceEntry, IncumbencyEntry, PartySwitchEntry, SwingEntry } from '../types';

/**
 * Live / upcoming election: the dashboard's seat maps from the baseline (history, class before, switchers) and the
 * live analysis (outcome, sitting MLA). The Finalized path reads the stored analysis instead (mapAnalysis).
 */
export function liveMaps(b: Baseline, live: SeatLive[], year: number) {
  const byId = new Map(live.map(s => [s.const_id, s]));
  const dominance = new Map<string, DominanceEntry>();
  const swing = new Map<string, SwingEntry>();
  const incumbency: IncumbencyEntry[] = [];
  const partySwitches: PartySwitchEntry[] = [];
  for (const s of b.seats) {
    const l = byId.get(s.const_id);
    if (s.class_before) dominance.set(s.const_id, { constId: s.const_id, winners: s.history.map(h => ({ party: h.party ?? '' })), classification: s.class_before.kind, dominantParty: s.class_before.holder, streak: s.class_before.streak });
    if (l?.outcome && l.outcome.kind !== 'new' && l.leader?.party_id && l.outcome.from_raw) {
      swing.set(s.const_id, { constId: s.const_id, currentParty: l.leader.party_id, prevParty: l.outcome.from_raw, currentMargin: l.margin ?? 0, prevMargin: s.prev?.margin ?? 0, flipped: l.outcome.kind === 'gained', split: l.outcome.kind === 'split' });
    }
    // Only sitting MLAs who contest again (as the old engine did): "not contesting" is not "lost".
    if (s.sitting && l?.sitting && l.sitting !== 'not_started' && l.sitting !== 'not_contesting') {
      incumbency.push({ constId: s.const_id, incumbentName: s.sitting.name, incumbentParty: s.sitting.party ?? '', won: l.sitting === 'won' || l.sitting === 'leading', currentMargin: l.margin ?? 0 });
    }
    for (const n of s.switchers) partySwitches.push({ constId: s.const_id, candidateName: n.name, fromParty: n.from, toParty: n.to, fromYear: n.year, toYear: year, wonInNewParty: l?.leader?.name === n.name, margin: l?.margin ?? 0 });
  }
  return { dominance, swing, incumbency, partySwitches };
}

/** The year seats are compared with: the baseline's previous election when there is one, else the manifest's last history year. */
export function prevYearOf(b: Baseline | null, historyYears: number[]): number | null {
  const fromBaseline = b?.seats.find(s => s.prev)?.prev?.year;
  return fromBaseline ?? (historyYears.length > 0 ? historyYears[historyYears.length - 1] : null);
}
