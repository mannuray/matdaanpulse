import { useMemo } from 'react';
import { useApi } from './useApi';
import { getConstituency, getConstituencyAnalysis, ElectionService } from '../../model/api/election.service';
import type { StandingsData, ManifestData, CandidateResult } from '../../model/types';

interface ConstituencyMeta {
  literacy_pct?: number | string | null;
  urban_pct?: number | string | null;
  sc_st_pct?: number | string | null;
  tags?: string[];
}

/**
 * CONTROLLER: Constituency Detail (MVC)
 * Standardizes detail fetching and ViewModel preparation.
 */
export function useConstituencyDetail(
  electionId: string, 
  constituencyId: string,
  standings?: StandingsData,
  manifest?: ManifestData | null
) {
  // 1. Core Data Fetching
  const { data: constituency, loading: cLoading, error: cError } = useApi(
    () => getConstituency(electionId, constituencyId),
    [electionId, constituencyId],
    { key: ElectionService.getConstituencyCacheKey(electionId, constituencyId) }
  );

  const { data: analysis, loading: aLoading } = useApi(
    () => getConstituencyAnalysis(electionId, constituencyId),
    [electionId, constituencyId],
    { key: ElectionService.getCacheKey(electionId, `analysis_${constituencyId}`) }
  );

  // 2. Party Context Lookup
  const partyMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    if (!standings) return map;
    (standings.groups || []).forEach(g => (g.parties || []).forEach(p => map.set(p.id, p)));
    (standings.independents || []).forEach(p => map.set(p.id, p));
    return map;
  }, [standings]);

  // 3. Derived Standings Stats
  const stats = useMemo(() => {
    if (!constituency?.candidates) return null;

    const candidatesWithShare = (constituency.candidates || []).map((c): CandidateResult => {
      const p = c.party;
      const partyInfo = p?.id ? partyMap.get(p.id) : null;
      
      return {
        ...c,
        vote_share: c.vote_share || 0,
        party: p && partyInfo ? { ...p, name: partyInfo.name, color: partyInfo.color } : p
      };
    }).sort((a, b) => b.votes - a.votes);

    return {
      totalVotesPolled: constituency.candidates.reduce((s, c) => s + (c.votes || 0), 0),
      winner: candidatesWithShare.find(c => c.status === 'WON' || c.status === 'LEADING'),
      candidatesWithShare
    };
  }, [constituency, partyMap]);

  // 4. Spoiler Detection Logic (Cumulative)
  const spoilerInfo = useMemo(() => {
    if (!constituency || !manifest?.vote_splits || !stats?.candidatesWithShare) return null;
    const cands = stats.candidatesWithShare;
    if (cands.length < 3) return null;

    const winner = cands[0];
    const runnerUp = cands[1];
    if (!winner || !runnerUp) return null;
    
    const winnerMargin = winner.votes - runnerUp.votes;
    
    const partyToAlliance = new Map<string, string>();
    (manifest.alliances || []).forEach(a => a.parties.forEach(pid => partyToAlliance.set(pid, a.id)));
    
    const runnerUpAlliance = partyToAlliance.get(runnerUp.party?.id || '');
    if (!runnerUpAlliance) return null;

    const allianceSplitters = manifest.vote_splits.filter(vs => vs.hurts === runnerUpAlliance);
    const splittersInSeat = cands.filter(c => 
      allianceSplitters.some(vs => vs.spoiler === c.party?.id)
    );
    
    const cumulativeSplitVotes = splittersInSeat.reduce((sum, c) => sum + (c.votes || 0), 0);
    const isAffected = cumulativeSplitVotes > winnerMargin;

    if (!isAffected) return null;

    return {
      isAffected: true,
      splitVotes: cumulativeSplitVotes,
      margin: winnerMargin,
      splitters: splittersInSeat.map(s => s.party?.id).filter(Boolean) as string[],
      beneficiary: runnerUpAlliance
    };
  }, [constituency, stats, manifest]);

  // 5. Demographics Formatting: only rows with a recorded value (no 0% placeholders)
  const formattedDemographics = useMemo(() => {
    if (!constituency?.metadata) return [];
    const meta = constituency.metadata as ConstituencyMeta;
    const rows: [string, ConstituencyMeta['literacy_pct']][] = [
      ['Literacy', meta.literacy_pct],
      ['Urbanization', meta.urban_pct],
      ['SC/ST Pop', meta.sc_st_pct],
    ];
    return rows
      .filter(([, v]) => v != null && v !== '' && Number.isFinite(Number(v)))
      .map(([label, v]) => ({ label, value: `${Number(v)}%` }));
  }, [constituency]);

  // 6. Final ViewModel Construction
  const viewModel = useMemo(() => {
    if (!constituency) return null;

    const cands = stats?.candidatesWithShare || [];
    const totalVotes = stats?.totalVotesPolled || 0;
    const isThreeWay = totalVotes > 0 && cands.length >= 3 && (cands[2].votes / totalVotes) * 100 >= 15;

    return {
      constituency,
      analysis,
      stats: {
        ...stats,
        candidatesWithShare: stats?.candidatesWithShare.map(c => ({
          ...c,
          isSplitter: spoilerInfo?.splitters.includes(c.party?.id || '')
        })) || []
      },
      spoilerInfo,
      badges: {
        isVip: manifest?.watchlists?.some(w => w.entries.some(e => e.const_id === constituencyId)) || false,
        isThreeWay,
        manualTags: (constituency?.metadata as ConstituencyMeta | undefined)?.tags || []
      },
      formattedDemographics
    };
  }, [constituency, analysis, stats, spoilerInfo, manifest, constituencyId]);

  return {
    ...viewModel,
    loading: cLoading || aLoading,
    error: cError
  };
}
