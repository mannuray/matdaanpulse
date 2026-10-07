import { isUnopposedWinner } from './uncontested';
import { RAW_COMPARER, type PartyComparer } from './partyComparer';
import type { ResultRow, MarginTrendPoint, PartyTrendPoint } from '../types';

/**
 * CORE MODEL: Intelligence Service (MVC: Model)
 * Pure logic for the historical trend charts (margins, party seats over time). Seat-level analysis lives in
 * derive/seatAnalysis (the shared module).
 * Decoupled from React Hooks for better testability and reuse.
 */

export function calculateMarginTrend(
  allElections: { results: ResultRow[]; year: number }[] | null
): MarginTrendPoint[] {
  if (!allElections) return [];

  return allElections.map(({ results: elResults, year }) => {
    const won = elResults.filter((r: ResultRow) => r.status === 'WON' || r.status === 'LEADING');
    // Seats won unopposed have no margin: counted as seats, left out of the average and median.
    const margins = won.filter(r => !isUnopposedWinner(r)).map(r => r.margin).sort((a, b) => a - b);
    const n = margins.length;
    const avg = n > 0 ? Math.round(margins.reduce((s, m) => s + m, 0) / n) : 0;
    const mid = Math.floor(n / 2);
    const median = n === 0 ? 0 : n % 2 === 0 ? Math.round((margins[mid - 1] + margins[mid]) / 2) : margins[mid];
    return { year, avgMargin: avg, medianMargin: median, seats: won.length };
  });
}

export function calculatePartyTrend(
  allElections: { results: ResultRow[]; year: number }[] | null,
  cmp: PartyComparer = RAW_COMPARER,
): PartyTrendPoint[] {
  if (!allElections) return [];
  // Each year's parties carried forward to the latest year, so a renamed party is one series.
  const latest = Math.max(...allElections.map(e => e.year));

  const points: PartyTrendPoint[] = [];
  for (const { results: elResults, year } of allElections) {
    const won = elResults.filter((r: ResultRow) => r.status === 'WON' || r.status === 'LEADING');
    const byParty = new Map<string, { seats: number; margins: number; marginSum: number }>();
    for (const r of won) {
      const party = cmp.carry(r.party_id, year, latest);
      const entry = byParty.get(party) || { seats: 0, margins: 0, marginSum: 0 };
      entry.seats++;
      if (!isUnopposedWinner(r)) { entry.margins++; entry.marginSum += r.margin; }
      byParty.set(party, entry);
    }
    for (const [party, data] of byParty) {
      points.push({
        party,
        year,
        seatsWon: data.seats,
        avgMargin: data.margins > 0 ? Math.round(data.marginSum / data.margins) : 0,
      });
    }
  }

  return points;
}
