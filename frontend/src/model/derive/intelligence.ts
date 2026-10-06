import { isUnopposedWinner } from './uncontested';
import { normalizeConstId } from '../geo/normalizeConstId';
import { RAW_COMPARER, type PartyComparer } from './partyComparer';
import type {
  ResultRow, DominanceEntry, IncumbencyEntry,
  PartySwitchEntry, MarginTrendPoint, PartyTrendPoint,
} from '../types';

/**
 * CORE MODEL: Intelligence Service (MVC: Model)
 * Pure logic for election analysis, dominance, and trends.
 * Decoupled from React Hooks for better testability and reuse.
 */

function normalizeCandidateName(n: string): string {
  return n.toUpperCase().trim().replace(/\s+ALIAS\s+.*$/i, '').replace(/[^A-Z\s]/g, '').trim();
}

export function calculateDominance(
  allHistResults: ResultRow[][] | null,
  currentWinnerMap: Map<string, ResultRow>,
  normToConstId: Map<string, string>,
  /** Party lineage: each past winner counts as the party it became by `currentYear`; `years` = allHistResults' years. */
  lineage: { cmp: PartyComparer; years: number[]; currentYear: number } = { cmp: RAW_COMPARER, years: [], currentYear: 0 },
): Map<string, DominanceEntry> {
  if (!allHistResults) return new Map<string, DominanceEntry>();
  const map = new Map<string, DominanceEntry>();

  const histWinnerMaps: Map<string, string>[] = allHistResults.map((histResults: ResultRow[], hi: number) => {
    const winMap = new Map<string, { party: string; votes: number }>();
    const won = histResults.filter((r: ResultRow) => r.status === 'WON' || r.status === 'LEADING');
    for (const r of won) {
      const norm = normalizeConstId(r.const_id);
      const existing = winMap.get(norm);
      if (!existing || r.votes > existing.votes) {
        winMap.set(norm, { party: r.party_id, votes: r.votes });
      }
    }
    const partyMap = new Map<string, string>();
    for (const [k, v] of winMap) partyMap.set(k, lineage.cmp.carry(v.party, lineage.years[hi] ?? 0, lineage.currentYear));
    return partyMap;
  });

  const allNorms = new Set<string>();
  for (const winMap of histWinnerMaps) {
    for (const norm of winMap.keys()) allNorms.add(norm);
  }
  for (const id of currentWinnerMap.keys()) allNorms.add(normalizeConstId(id));
  for (const [, id] of normToConstId) allNorms.add(normalizeConstId(id));

  for (const norm of allNorms) {
    const constId = normToConstId.get(norm) || norm;
    const current = currentWinnerMap.get(constId);
    const winners: { party: string }[] = [];
    for (const winMap of histWinnerMaps) {
      const party = winMap.get(norm);
      if (party) winners.push({ party });
    }
    if (current) winners.push({ party: current.party_id });

    if (winners.length === 0) continue;
    if (winners.length === 1) {
      map.set(constId, { constId, winners, classification: 'new', streak: 1, dominantParty: winners[0].party });
      continue;
    }

    const partyCounts = new Map<string, number>();
    for (const w of winners) {
      partyCounts.set(w.party, (partyCounts.get(w.party) || 0) + 1);
    }

    let dominantParty = '';
    let maxWins = 0;
    for (const [party, count] of partyCounts) {
      if (count > maxWins) { maxWins = count; dominantParty = party; }
    }

    let streak = 0;
    const latestParty = winners[winners.length - 1].party;
    for (let i = winners.length - 1; i >= 0; i--) {
      if (winners[i].party === latestParty) streak++;
      else break;
    }

    let classification: DominanceEntry['classification'];
    const totalElections = winners.length;
    if (maxWins >= 3 || (totalElections <= 3 && maxWins === totalElections)) {
      classification = 'stronghold';
    } else if (maxWins >= 2) {
      classification = 'loyal';
    } else {
      classification = 'swing';
    }

    map.set(constId, { constId, winners, classification, dominantParty, streak });
  }

  return map;
}

export function calculateIncumbency(
  prevResults: ResultRow[] | null,
  results: ResultRow[] | null,
  normToConstId: Map<string, string>
): IncumbencyEntry[] {
  if (!prevResults || !results) return [];
  const entries: IncumbencyEntry[] = [];

  const prevWinners = new Map<string, { name: string; party: string }>();
  const prevWon = prevResults.filter((r: ResultRow) => r.status === 'WON');
  for (const r of prevWon) {
    const norm = normalizeConstId(r.const_id);
    prevWinners.set(norm, { name: r.candidate_name, party: r.party_id });
  }

  const currentByConst = new Map<string, ResultRow[]>();
  for (const r of results) {
    const norm = normalizeConstId(r.const_id);
    const arr = currentByConst.get(norm) || [];
    arr.push(r);
    currentByConst.set(norm, arr);
  }

  for (const [norm, prev] of prevWinners) {
    const currentCands = currentByConst.get(norm);
    if (!currentCands) continue;
    const prevNorm = normalizeCandidateName(prev.name);
    const match = currentCands.find(c => normalizeCandidateName(c.candidate_name) === prevNorm);
    if (match) {
      const won = match.status === 'WON' || match.status === 'LEADING';
      const currentConstId = normToConstId.get(norm);
      if (currentConstId) {
        entries.push({
          constId: currentConstId,
          incumbentName: prev.name,
          incumbentParty: prev.party,
          won,
          currentMargin: match.margin,
        });
      }
    }
  }

  return entries;
}

export function calculatePartySwitches(
  allElections: { results: ResultRow[]; year: number }[] | null,
  normToConstId: Map<string, string>,
  cmp: PartyComparer = RAW_COMPARER,
): PartySwitchEntry[] {
  if (!allElections) return [];

  const entries: PartySwitchEntry[] = [];

  for (let ei = 0; ei < allElections.length - 1; ei++) {
    const prev = allElections[ei];
    const next = allElections[ei + 1];

    const prevWinners = new Map<string, { name: string; party: string; votes: number }>();
    for (const r of prev.results) {
      if (r.status === 'WON' || r.status === 'LEADING') {
        const norm = normalizeConstId(r.const_id);
        const existing = prevWinners.get(norm);
        if (!existing || r.votes > existing.votes) {
          prevWinners.set(norm, { name: r.candidate_name, party: r.party_id, votes: r.votes });
        }
      }
    }

    const nextByConst = new Map<string, ResultRow[]>();
    for (const r of next.results) {
      const norm = normalizeConstId(r.const_id);
      const arr = nextByConst.get(norm) || [];
      arr.push(r);
      nextByConst.set(norm, arr);
    }

    for (const [norm, prevWinner] of prevWinners) {
      const nextCands = nextByConst.get(norm);
      if (!nextCands) continue;
      const prevNorm = normalizeCandidateName(prevWinner.name);
      const match = nextCands.find(c => normalizeCandidateName(c.candidate_name) === prevNorm);
      // Following the party through a rename, merger or split is no switch (party lineage).
      if (match && cmp.relation(prevWinner.party, match.party_id, prev.year, next.year) === 'different') {
        const won = match.status === 'WON' || match.status === 'LEADING';
        const constId = nextCands[0]?.const_id || norm;
        // Every pair maps to the current election's seat id (const_no is stable across post-2008 elections).
        const actualConstId = normToConstId.get(norm) ?? constId;
        entries.push({
          constId: actualConstId,
          candidateName: match.candidate_name,
          fromParty: prevWinner.party,
          toParty: match.party_id,
          fromYear: prev.year,
          toYear: next.year,
          wonInNewParty: won,
          margin: match.margin,
        });
      }
    }
  }

  // Newest switches first (stable, so the order within a year is unchanged).
  return entries.sort((a, b) => b.toYear - a.toYear);
}

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
