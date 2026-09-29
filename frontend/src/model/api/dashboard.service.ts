import type { 
  Alliance, VoteShare, ManifestAlliance, StandingsData, 
  PartyStanding, AllianceGroup 
} from '../types';

/**
 * DashboardService encapsulates complex business logic for 
 * processing election data into display-ready standings.
 */
export const DashboardService = {
  /**
   * Build standings by merging: per-party seats, vote-share, and manifest definitions.
   * Satisfies SRP by isolating calculation from rendering.
   */
  buildStandings(
    partySeats: Alliance[],
    voteShare: VoteShare[],
    manifestAlliances: ManifestAlliance[],
    trackedIds: Set<string>,
    manifestIds: Set<string>,
  ): StandingsData {
    const seatMap = new Map<string, Alliance>();
    (partySeats || []).forEach((a) => seatMap.set(a.party_id, a));

    const voteMap = new Map<string, VoteShare>();
    (voteShare || []).forEach((v) => voteMap.set(v.party_id, v));

    const makePartyStanding = (partyId: string): PartyStanding => {
      const seat = seatMap.get(partyId);
      const vote = voteMap.get(partyId);
      return {
        id: partyId,
        name: seat?.party_name || vote?.party_name || partyId,
        color: seat?.color || vote?.color || '#6b7280',
        won: seat ? Number(seat.won) : 0,
        leading: seat ? Number(seat.leading) : 0,
        votePct: vote?.percentage,
        isManifest: manifestIds.has(partyId),
      };
    };

    const groups: AllianceGroup[] = [];
    const usedPartyIds = new Set<string>();

    // 1. Build alliances defined in manifest
    for (const ma of (manifestAlliances || [])) {
      const allianceTracked = trackedIds.has(ma.id);
      const memberTracked = ma.parties.some((p) => trackedIds.has(p));
      
      // Filter logic if user has selected specific parties/alliances to track
      if (trackedIds.size > 0 && !allianceTracked && !memberTracked) continue;

      const parties = ma.parties.map(makePartyStanding);
      parties.sort((a, b) => (b.won + b.leading) - (a.won + a.leading));
      ma.parties.forEach((p) => usedPartyIds.add(p));

      const totalWon = parties.reduce((s, p) => s + p.won, 0);
      const totalLeading = parties.reduce((s, p) => s + p.leading, 0);
      const totalVotePct = parties.reduce((s, p) => s + (p.votePct || 0), 0);

      groups.push({
        id: ma.id,
        name: ma.name,
        color: ma.color,
        won: totalWon,
        leading: totalLeading,
        votePct: Math.round(totalVotePct * 10) / 10,
        parties,
      });
    }
    groups.sort((a, b) => (b.won + b.leading) - (a.won + a.leading));

    // 2. Build independents (parties not in any manifest alliance)
    const allPartyIds = new Set([...seatMap.keys(), ...voteMap.keys()]);
    const independents: PartyStanding[] = [];
    for (const pid of allPartyIds) {
      if (usedPartyIds.has(pid)) continue;
      if (trackedIds.size > 0 && !trackedIds.has(pid)) continue;
      independents.push(makePartyStanding(pid));
    }
    independents.sort((a, b) => (b.won + b.leading) - (a.won + a.leading));

    return { groups, independents };
  }
};
