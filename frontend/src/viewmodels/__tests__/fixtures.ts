import type { DashboardSources } from '../sources/useDashboardSources';
import type { ResultRow } from '../../model/types';

const rows: ResultRow[] = [
  { const_id: 'BR_VS_1_SANDESH', party_id: 'JDU', candidate_name: 'RADHA CHARAN SAH', votes: 1000, status: 'WON', margin: 27 },
  { const_id: 'BR_VS_1_SANDESH', party_id: 'RJD', candidate_name: 'R', votes: 973, status: 'LOST', margin: 0 },
  { const_id: 'BR_VS_2_RUPAULI', party_id: 'JDU', candidate_name: 'KALADHAR PRASAD MANDAL', votes: 90000, status: 'WON', margin: 73572 },
  { const_id: 'BR_VS_3_AGIAON', party_id: 'BJP', candidate_name: 'MAHESH PASWAN', votes: 5000, status: 'WON', margin: 95 },
];

export function makeSources(over: Partial<DashboardSources> = {}): DashboardSources {
  const winners = new Map(rows.filter(r => r.status === 'WON').map(r => [r.const_id, r]));
  const cc = new Map<string, ResultRow[]>();
  rows.forEach(r => cc.set(r.const_id, [...(cc.get(r.const_id) ?? []), r]));
  const mapRegions = [...winners.values()].map(w => ({
    id: w.const_id, name: w.const_id.split('_').pop()!.toLowerCase().replace(/^./, c => c.toUpperCase()),
    party: w.party_id, margin: w.margin, status: 'WON', type: 'GEN' as const,
    color: '#fff', candidate: w.candidate_name, partyColor: '#fff', recentChange: false,
  }));
  return {
    election: { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 4, state: { id: 4, name: 'Bihar', code: 'BR', total_assembly_seats: 243, total_ls_seats: 40 }, year: 2025, status: 'Finalized', tentative_next_date: null, manifest_url: null },
    data: {
      results: rows, seats: {}, trails: {}, manifestData: { alliances: [{ id: 'NDA', name: 'NDA', color: '#FF7A1A', parties: ['BJP', 'JDU'] }, { id: 'MGB', name: 'MGB', color: '#7BD34A', parties: ['RJD'] }] },
      standings: { groups: [], independents: [] }, constCandidates: cc, currentWinnerMap: winners,
      partyColorMap: new Map([['JDU', '#1FA37A'], ['BJP', '#FF7A1A'], ['RJD', '#7BD34A']]),
      partyNameMap: new Map([['JDU', 'Janata Dal (United)'], ['BJP', 'Bharatiya Janata Party'], ['RJD', 'Rashtriya Janata Dal']]),
      mapPartyList: [{ id: 'JDU', name: 'Janata Dal (United)', color: '#1FA37A', seats: 2 }, { id: 'BJP', name: 'Bharatiya Janata Party', color: '#FF7A1A', seats: 1 }, { id: 'RJD', name: 'Rashtriya Janata Dal', color: '#7BD34A', seats: 0 }],
      mapRegions, spoilerData: { spoilerSeats: new Set(), threeWaySeats: new Set(), hasData: true }, addableItems: [], voteShare: [],
      loading: false, error: null, modalConstId: null, setModalConstId: () => {}, mapTab: 'overview', setMapTab: () => {},
      userTracked: [], setUserTracked: () => {}, untrack: () => {}, spoilerFilter: null, setSpoilerFilter: () => {},
      refreshAll: () => {}, liveConnected: false, liveStatus: 'Finalized', liveVersion: null,
    },
    swing: new Map(), dominance: new Map(), incumbency: [], partySwitches: [], marginTrend: [], partyTrend: [], historyPartyIds: new Set(), prevYear: null,
    totalSeats: 243, majority: 122, votePct: new Map(), ticker: [], recentSeats: new Map(), liveConnected: false,
    availableLayers: ['overview', 'battle', 'demographics', 'insights'],
    partyMeta: new Map([
      ['BJP', { id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#FF7A1A', mark: '/symbols/logos/BJP.svg', eciRecognition: 'National' as const }],
      ['JDU', { id: 'JDU', name: 'Janata Dal (United)', abbreviation: 'JD(U)', color: '#1FA37A', mark: null, eciRecognition: 'State' as const }],
    ]),
    watchlist: [], addWatch: () => {}, removeWatch: () => {}, liveAnalysis: null,
    ...over,
  };
}
