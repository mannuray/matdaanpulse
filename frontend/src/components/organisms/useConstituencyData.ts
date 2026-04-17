import { useMemo } from 'react';
import { useApi } from '../../hooks/useApi';
import { getConstituency, getConstituencyAnalysis } from '../../services/api';
import type { SwingEntry, SpoilerInfo, DominanceEntry } from '../../types';

interface UseConstituencyDataProps {
  electionId: string;
  constituencyId: string;
  electionStatus?: string;
  swingEntry?: SwingEntry;
  spoilerInfo?: SpoilerInfo;
  allianceLookup?: Map<string, { name: string; color: string }>;
  dominanceEntry?: DominanceEntry;
  partyColorMap?: Map<string, string>;
  revisionEntry?: { pre: number; post: number; label: string };
}

export function useConstituencyData({
  electionId,
  constituencyId,
  electionStatus,
  swingEntry,
  spoilerInfo,
  allianceLookup,
  dominanceEntry,
  partyColorMap,
  revisionEntry,
}: UseConstituencyDataProps) {
  const { data: constituency, loading, error } = useApi(
    () => getConstituency(electionId, constituencyId),
    [electionId, constituencyId]
  );

  const { data: aiAnalysis } = useApi(
    () => (electionStatus === 'Finalized' || electionStatus === 'Live')
      ? getConstituencyAnalysis(electionId, constituencyId)
      : Promise.resolve(null),
    [electionId, constituencyId, electionStatus]
  );

  const stats = useMemo(() => {
    const total = constituency?.candidates?.reduce((sum, c) => sum + c.votes, 0) ?? 0;
    const s = constituency?.candidates ? [...constituency.candidates].sort((a, b) => b.votes - a.votes) : [];
    const top = s[0]?.votes ?? 0;
    const margin = s.length >= 2 ? s[0].votes - s[1].votes : 0;
    const withShare = s.map((c) => ({
      ...c,
      vote_share: total > 0 ? parseFloat(((c.votes / total) * 100).toFixed(1)) : 0,
      margin: c.votes - top,
    }));
    return { totalVotesPolled: total, winMargin: margin, candidatesWithShare: withShare };
  }, [constituency?.candidates]);

  const badges = useMemo(() => {
    // Swing Badge
    let swing = null;
    if (swingEntry) {
      if (swingEntry.flipped) {
        const prevAlliance = allianceLookup?.get(swingEntry.prevParty);
        const currAlliance = allianceLookup?.get(swingEntry.currentParty);
        swing = {
          flipped: true as const,
          fromLabel: prevAlliance?.name || swingEntry.prevParty,
          fromColor: prevAlliance?.color || '#6b7280',
          toLabel: currAlliance?.name || swingEntry.currentParty,
          toColor: currAlliance?.color || '#6b7280',
        };
      } else {
        const holdAlliance = allianceLookup?.get(swingEntry.currentParty);
        swing = {
          flipped: false as const,
          holdLabel: holdAlliance?.name || swingEntry.currentParty,
          holdColor: holdAlliance?.color || '#6b7280',
        };
      }
    }

    // Spoiler Badge
    let spoiler = null;
    if (spoilerInfo) {
      const hurtsEntry = allianceLookup?.get(spoilerInfo.hurtsAlliance);
      spoiler = {
        hurtsColor: hurtsEntry?.color || '#f59e0b',
        hurtsName: hurtsEntry?.name || spoilerInfo.hurtsAlliance,
      };
    }

    // Dominance Badge
    let dominance = null;
    if (dominanceEntry && dominanceEntry.classification !== 'new') {
      const domColor = dominanceEntry.dominantParty
        ? (partyColorMap?.get(dominanceEntry.dominantParty) || '#6b7280')
        : '#f59e0b';
      const label = dominanceEntry.classification === 'stronghold'
        ? `${dominanceEntry.dominantParty} Stronghold`
        : dominanceEntry.classification === 'loyal'
        ? `${dominanceEntry.dominantParty} Loyal`
        : 'Swing Seat';
      const bgColor = dominanceEntry.classification === 'swing' ? '#f59e0b' : domColor;
      dominance = { bgColor, label };
    }

    return { swing, spoiler, dominance };
  }, [swingEntry, spoilerInfo, allianceLookup, dominanceEntry, partyColorMap]);

  const revisionData = useMemo(() => {
    if (!revisionEntry) return null;
    const { winMargin } = stats;
    const netChange = revisionEntry.post - revisionEntry.pre;
    const pctChange = revisionEntry.pre > 0 ? ((netChange / revisionEntry.pre) * 100) : 0;
    const absNet = Math.abs(netChange);
    const ratio = winMargin > 0 ? absNet / winMargin : 0;
    const tier = ratio > 1 ? 'High' : ratio >= 0.5 ? 'Moderate' : 'Low';
    const tierColor = tier === 'High' ? 'var(--danger)' : tier === 'Moderate' ? 'var(--warning)' : 'var(--text-secondary)';
    return { netChange, pctChange, absNet, ratio, tier, tierColor };
  }, [revisionEntry, stats.winMargin]);

  return { constituency, loading, error, aiAnalysis, stats, badges, revisionData };
}
