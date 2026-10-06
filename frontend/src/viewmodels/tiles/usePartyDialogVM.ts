import { useMemo } from 'react';
import { useSources } from '../sources/DashboardSourcesProvider';
import { useDashboardStore } from '../store/DashboardStoreProvider';
import { useApi } from '../data/useApi';
import { getParty } from '../../model/api/geo.service';
import { getConstituency } from '../../model/api/election.service';
import { partyElectionStats, partyKeyCandidates, type PartyElectionStats, type PartyKeyCandidate } from '../../model/derive/partyElection';
import { collectLeaderEntries, deriveLeaderCards, resolveLeaderSeats } from '../../model/derive/leaders';
import { partyContext, type LineageNote, type PartyUnitSummary } from '../../model/derive/partyContext';
import { useLineageEvents } from '../data/usePartyComparer';

export interface PartyDialogVM {
  id: string; name: string; abbreviation: string | null; mark: string | null; color: string | null;
  recognition: 'National' | 'State' | 'Unrecognised' | null;
  electionName: string; stats: PartyElectionStats; totalSeats: number; majority: number;
  profile: { leader: string | null; founded: number | null; hq: string | null; website: string | null; wikipedia: string | null; description: string | null } | null;
  /** The party's leaders first (a seatless one as party leader), then its biggest wins. */
  keyCandidates: (PartyKeyCandidate & { photo: string | null; tracked: boolean })[];
  /** Adds or removes the seat on the dashboard watchlist. */
  onToggleTrack(constId: string, label: string): void;
  onClose(): void; onSelectSeat(id: string): void;
  /** The party's unit in this election's state: recognition there and its current leaders (party model). */
  unit?: PartyUnitSummary | null;
  /** Its lineage in plain terms (renames, mergers, splits, breakaways). */
  lineage?: { kind: LineageNote['kind']; otherLabel: string; year: number }[];
  /** Its family's seats in this election, when it is part of a split. */
  family?: { rootLabel: string; members: { label: string; seats: number }[]; total: number } | null;
}

/** Cards in the scrolling key-candidates strip. */
const KEY_LIMIT = 8;

export function usePartyDialogVM(): PartyDialogVM | null {
  const src = useSources();
  const { state, dispatch } = useDashboardStore();
  const id = state.selectedParty;
  const { data: party } = useApi(() => (id ? getParty(id).catch(() => null) : Promise.resolve(null)), [id], { key: id ? `party_${id}` : undefined });
  const alliances = useMemo(() => src.data.manifestData?.alliances ?? [], [src.data.manifestData]);
  const stats = useMemo(() => (id ? partyElectionStats(id, src.data.results, src.votePct, alliances) : null), [id, src.data.results, src.votePct, alliances]);
  const keyCandidates = useMemo(
    () => (id ? partyKeyCandidates(id, deriveLeaderCards(resolveLeaderSeats(collectLeaderEntries(src.data.manifestData, []), src.data.results), src.data.currentWinnerMap), src.data.currentWinnerMap, KEY_LIMIT) : []),
    [id, src.data.manifestData, src.data.results, src.data.currentWinnerMap],
  );
  const lineage = useLineageEvents();
  // Seats won or leading per party in this election (the family total after a split).
  const seatsByParty = useMemo(() => {
    const n = new Map<string, number>();
    for (const w of src.data.currentWinnerMap.values()) n.set(w.party_id, (n.get(w.party_id) ?? 0) + 1);
    return n;
  }, [src.data.currentWinnerMap]);
  // Snapshot rows carry no photos: read them from the shown seats' details (the seat dialog's cache keys).
  const eid = src.election.id;
  const seats = useMemo(() => [...new Set(keyCandidates.map(c => c.constId).filter(Boolean))].sort(), [keyCandidates]);
  const { data: details } = useApi(
    () => Promise.all(seats.map(c => getConstituency(eid, c).catch(() => null))),
    [eid, seats.join(',')], { key: seats.length ? `party_photos_${eid}_${seats.join(',')}` : undefined },
  );
  const withPhotos = useMemo(() => keyCandidates.map(c => {
    const d = details?.find(x => x?.id === c.constId);
    // One candidate per party per seat; manifest names differ from ballot names ("Tejashwi Yadav" vs "TEJASHWI PRASAD YADAV").
    const m = d?.candidates?.find(x => x.party?.id === id);
    return { ...c, photo: m?.person?.photo_url ?? null, tracked: !!c.constId && src.watchlist.some(w => w.const_id === c.constId) };
  }), [keyCandidates, details, id, src.watchlist]);
  if (!id || !stats) return null;
  const m = src.partyMeta.get(id);
  const label = (pid: string) => src.partyMeta.get(pid)?.abbreviation ?? pid;
  const ctx = party && id === party.id && lineage ? partyContext({
    partyId: id, units: party.units ?? [], events: lineage, stateId: src.election.state_id ?? null,
    date: src.election.tentative_next_date?.slice(0, 10) ?? `${src.election.year}-07-01`, seats: seatsByParty,
    // A note about another party only when it won seats in this state (any year) or contests this election.
    relevant: p => seatsByParty.has(p) || src.historyPartyIds.has(p) || src.data.results.some(r => r.party_id === p),
  }) : null;
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
    keyCandidates: withPhotos,
    unit: ctx?.unit ?? null,
    lineage: (ctx?.notes ?? []).map(n => ({ kind: n.kind, otherLabel: label(n.other), year: n.year })),
    family: ctx?.family ? { rootLabel: label(ctx.family.root), members: ctx.family.members.map(x => ({ label: label(x.id), seats: x.seats })), total: ctx.family.total } : null,
    onToggleTrack: (constId, label) => (src.watchlist.some(w => w.const_id === constId) ? src.removeWatch(constId) : src.addWatch(constId, label)),
    onClose: () => dispatch({ type: 'selectParty', party: null }),
    onSelectSeat: seat => { dispatch({ type: 'selectParty', party: null }); dispatch({ type: 'selectSeat', seat }); },
  };
}
