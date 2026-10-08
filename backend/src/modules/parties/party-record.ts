import type { ElectionAnalysis, PartyRow } from '../../common/seat-analysis/types';

/**
 * A party's record across elections (spec docs/superpowers/specs/2026-10-08-party-page-design.md §2), built from the
 * stored seat analysis of each Finalized VS election. Pure: the loader in PartiesService.record supplies the rows.
 */
export interface LineageRow { party_id: string; predecessor_id: string; kind: string; effective_date: string; state_id: number | null; is_successor: boolean; note: string | null; source_url: string | null }
export interface LoadedElection {
  id: string; state_id: number; state_code: string; state_name: string; year: number;
  /** Counting day YYYY-MM-DD (else `${year}-07-01`): the lineage comparison window. */
  date: string;
  delimitation: string | null; seats_total: number;
  /** Manifest `government.parties`; null when not recorded. */
  government: string[] | null;
  analysis: Pick<ElectionAnalysis, 'parties' | 'flow' | 'breakdowns'> | null;
}

/** The party and every party linked to it by lineage, transitively (predecessors and successors). */
export function familyIds(partyId: string, lineage: LineageRow[]): Set<string> {
  const ids = new Set([partyId]);
  for (let grew = true; grew;) {
    grew = false;
    for (const e of lineage) {
      if (ids.has(e.party_id) && !ids.has(e.predecessor_id)) { ids.add(e.predecessor_id); grew = true; }
      if (ids.has(e.predecessor_id) && !ids.has(e.party_id)) { ids.add(e.party_id); grew = true; }
    }
  }
  return ids;
}

export function buildPartyRecord(partyId: string, elections: LoadedElection[], lineage: LineageRow[]) {
  const family = familyIds(partyId, lineage);
  const rows = elections.flatMap(e => {
    const parties: PartyRow[] = e.analysis?.parties ?? [];
    const own = parties.find(p => p.party_id === partyId);
    if (!own || own.contested <= 0) return [];
    const top = Math.max(...parties.map(p => p.won));
    return [{
      election_id: e.id, state_id: e.state_id, state_code: e.state_code, state_name: e.state_name, year: e.year, date: e.date,
      delimitation: e.delimitation, contested: own.contested, won: own.won, votes: own.votes, share: own.share,
      held: own.held, gained: own.gained, lost: own.lost, split_gained: own.split_gained, split_lost: own.split_lost,
      seats_total: e.seats_total, largest: own.won > 0 && own.won === top,
      formed_government: e.government ? e.government.includes(partyId) : null,
      family: parties.filter(p => p.party_id !== partyId && family.has(p.party_id)).map(p => ({ party_id: p.party_id, won: p.won, share: p.share })),
    }];
  }).sort((a, b) => b.date.localeCompare(a.date));
  return {
    party_id: partyId,
    elections: rows,
    lineage: lineage.filter(e => family.has(e.party_id) || family.has(e.predecessor_id)).sort((a, b) => a.effective_date.localeCompare(b.effective_date)),
  };
}

/**
 * `?state` extras from one election's analysis: the seats the party gained or lost (held seats, from = to, left out),
 * and its seats per region. The analysis groups regions by id: `regionName` turns one into its name.
 */
export function stateExtras(partyId: string, e: LoadedElection, regionName: (group: string) => string = g => g) {
  const flow = (e.analysis?.flow ?? []).filter(f => f.from !== f.to && (f.from === partyId || f.to === partyId));
  const region = e.analysis?.breakdowns?.region ?? [];
  const regions = region.length
    ? region.map(r => ({ region: regionName(r.group), seats: r.seats, won: r.parties.find(p => p.party_id === partyId)?.won ?? 0 })).sort((a, b) => b.won - a.won)
    : null;
  return { flow, regions };
}
