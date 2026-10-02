import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useApi } from '../data/useApi';
import { getParty } from '../../model/api/geo.service';
import { partyElectionStats, type PartyElectionStats } from '../../model/derive/partyElection';
import { collectLeaderEntries, deriveLeaderCards, type LeaderCard } from '../../model/derive/leaders';

export interface PartyDialogVM {
  id: string; name: string; abbreviation: string | null; mark: string | null; color: string | null;
  recognition: 'National' | 'State' | 'Unrecognised' | null;
  electionName: string; stats: PartyElectionStats; totalSeats: number; majority: number;
  profile: { leader: string | null; founded: number | null; hq: string | null; website: string | null; wikipedia: string | null; description: string | null } | null;
  keyCandidates: LeaderCard[];
  onClose(): void; onSelectSeat(id: string): void;
}

export function usePartyDialogVM(): PartyDialogVM | null {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const id = state.selectedParty;
  const { data: party } = useApi(() => (id ? getParty(id).catch(() => null) : Promise.resolve(null)), [id], { key: id ? `party_${id}` : undefined });
  const alliances = useMemo(() => src.data.manifestData?.alliances ?? [], [src.data.manifestData]);
  const stats = useMemo(() => (id ? partyElectionStats(id, src.data.results, src.votePct, alliances) : null), [id, src.data.results, src.votePct, alliances]);
  const keyCandidates = useMemo(
    () => (id ? deriveLeaderCards(collectLeaderEntries(src.data.manifestData, []), src.data.currentWinnerMap)
      // Only this party's leaders who hold or lead a seat (a card opens that seat).
      .filter(c => c.partyId === id && c.constId && (c.status === 'WON' || c.status === 'LEADING')) : []),
    [id, src.data.manifestData, src.data.currentWinnerMap],
  );
  if (!id || !stats) return null;
  const m = src.partyMeta.get(id);
  // An id the loaded party list and this election's results both lack opens nothing.
  if (!m && src.partyMeta.size > 0 && stats.contested === 0) return null;
  return {
    id,
    name: m?.name ?? src.data.partyNameMap.get(id) ?? id,
    abbreviation: m?.abbreviation ?? null,
    mark: m?.mark ?? null,
    color: src.data.partyColorMap.get(id) ?? m?.color ?? null,
    recognition: m?.eciRecognition ?? null,
    electionName: src.election.name,
    stats,
    totalSeats: src.totalSeats,
    majority: src.majority,
    profile: party && id === party.id ? { leader: party.leader_name, founded: party.founded_year, hq: party.headquarters, website: party.website, wikipedia: party.wikipedia_url, description: party.description } : null,
    keyCandidates,
    onClose: () => dispatch({ type: 'selectParty', party: null }),
    onSelectSeat: seat => { dispatch({ type: 'selectParty', party: null }); dispatch({ type: 'selectSeat', seat }); },
  };
}
