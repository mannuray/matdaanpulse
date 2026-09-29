import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useElection } from '../hooks/useElection';
import { useSSE } from '../hooks/useSSE';
import { useDashboardData } from '../hooks/useDashboardData';
import { useHistoryAnalysis } from '../hooks/useHistoryAnalysis';
import { useHistoricalResults } from '../hooks/useHistoricalResults';
import { useAnalysis } from '../hooks/useAnalysis';
import { appendToasts } from '../utils/liveUpdates';
import { displayNameFromConstId } from '../utils/regionMatching';

import AllianceTally, { AllianceTallyBadge } from '../components/organisms/AllianceTally';
import InteractiveMap from '../components/organisms/InteractiveMap';
import WatchlistPanel from '../components/organisms/WatchlistPanel';
import ElectionSummary, { useDeclaredCount } from '../components/organisms/ElectionSummary';
import ConstituencyModal from '../components/organisms/ConstituencyModal';
import KeyBattlesTicker from '../components/organisms/KeyBattlesTicker';
import CollapsibleCard from '../components/atoms/CollapsibleCard';
import Spinner from '../components/atoms/Spinner';
import StatusBadge from '../components/atoms/StatusBadge';
import ShareButtons from '../components/atoms/ShareButtons';
import LiveToast from '../components/atoms/LiveToast';

import type { CSSProperties } from 'react';
import type { SSEEvent, ToastMessage, Election, ManifestAlliance, SwingEntry } from '../types';

/** How long a changed seat keeps its map pulse class. */
const RECENT_CHANGE_MS = 3000;
/** Fallback when an LS election has no constituency data yet. */
const LS_DEFAULT_SEATS = 543;
const EMPTY_ALLIANCES: ManifestAlliance[] = [];
const EMPTY_YEARS: number[] = [];
const EMPTY_MANIFEST_IDS: Set<string> = new Set();

/**
 * PAGE: Dashboard (MVC: View)
 * Highly optimized, delegated UI orchestrator for real-time election data.
 */
export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { election, setSseConnected } = useElection();
  
  const controller = useDashboardData(election);
  const {
    results, manifestData, standings, loading, error,
    constCandidates, currentWinnerMap, partyColorMap, partyNameMap, mapPartyList,
    mapRegions, spoilerData, addableItems,
    modalConstId, setModalConstId,
    mapTab, setMapTab,
    userTracked, setUserTracked, untrack,
    spoilerFilter, setSpoilerFilter,
    refreshAll, applyLiveUpdate,
  } = controller;

  const [recentChanges, setRecentChanges] = useState<Set<string>>(() => new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [battleSelectedIds, setBattleSelectedIds] = useState<Set<string>>(() => new Set());
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  const alliances = manifestData?.alliances || EMPTY_ALLIANCES;

  // 1. Domain Logic Delegation
  const historyResults = useHistoricalResults(manifestData?.history);
  const prevResults = historyResults && historyResults.length > 0 ? historyResults[historyResults.length - 1] : null;
  const allConstIds = useMemo(() => [...constCandidates.keys()], [constCandidates]);

  const ha = useHistoryAnalysis({
    results, currentWinnerMap,
    allHistResults: historyResults,
    prevResults,
    allConstIds,
    historyYears: manifestData?.history_years || EMPTY_YEARS,
    currentYear: election?.year || 0,
  });

  const ba = useAnalysis(election?.status === 'Finalized' ? election.id : undefined);

  // Prefer server-side analysis (finalized elections); fall back to client-side history analysis.
  const dominanceMap = ba.dominanceMap.size > 0 ? ba.dominanceMap : ha.dominanceMap;
  const swingMap: Map<string, SwingEntry> = ba.swingMap.size > 0 ? ba.swingMap : ha.swingMap;
  const incumbencyData = ba.incumbencyData.length > 0 ? ba.incumbencyData : ha.incumbencyData;
  const partySwitchData = ba.partySwitchData.length > 0 ? ba.partySwitchData : ha.partySwitchData;

  // 2. Real-time Events
  const recentTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = recentTimersRef.current;
    return () => { timers.forEach(clearTimeout); timers.clear(); };
  }, []);

  const markRecent = useCallback((ids: string[]) => {
    if (ids.length === 0) return;
    setRecentChanges(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
    const timers = recentTimersRef.current;
    for (const id of ids) {
      clearTimeout(timers.get(id));
      timers.set(id, setTimeout(() => {
        timers.delete(id);
        setRecentChanges(prev => {
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, RECENT_CHANGE_MS));
    }
  }, []);

  const partyInfoRef = useRef({ partyNameMap, partyColorMap });
  partyInfoRef.current = { partyNameMap, partyColorMap };

  const handleSSE = useCallback((event: SSEEvent) => {
    const rows = event.type === 'batch-update' ? event.data : [event.data];
    if (rows.length === 0) return;
    const changes = applyLiveUpdate(rows);
    markRecent(changes.map(c => c.const_id));
    if (changes.length > 0) {
      const { partyNameMap: names, partyColorMap: colors } = partyInfoRef.current;
      setToasts(prev => appendToasts(prev, changes, (partyId, constId) => ({
        party: names.get(partyId) || partyId,
        color: colors.get(partyId) || '#6b7280',
        constName: displayNameFromConstId(constId),
      })));
    }
  }, [applyLiveUpdate, markRecent]);

  const dismissToast = useCallback((id: string) => setToasts(prev => prev.filter(x => x.id !== id)), []);

  const { connected: sseConnected } = useSSE(election?.status === 'Live' ? election.id : undefined, handleSSE);
  useEffect(() => { setSseConnected(sseConnected); }, [sseConnected, setSseConnected]);

  // 3. Battles View Model
  const battles = useMemo(() => {
    if (!manifestData?.vip_seats) return [];
    return Object.entries(manifestData.vip_seats).map(([constId, info]) => {
      const res = currentWinnerMap.get(constId);
      return {
        const_id: constId,
        const_name: info.label || constId,
        candidate_name: res?.candidate_name || '—',
        party_id: res?.party_id || '',
        party_name: res?.party_id || '',
        party_color: partyColorMap.get(res?.party_id || '') || '#6b7280',
        status: res?.status || 'TRAILING',
        margin: res?.margin || 0,
        isVip: true,
      };
    });
  }, [manifestData, currentWinnerMap, partyColorMap]);

  const mapRegionsWithPulse = useMemo(
    () => (recentChanges.size === 0 ? mapRegions : mapRegions.map(r => (recentChanges.has(r.id) ? { ...r, recentChange: true } : r))),
    [mapRegions, recentChanges]
  );
  const allConstituencyIds = useMemo(() => mapRegions.map(r => r.id), [mapRegions]);

  const declaredCount = useDeclaredCount(mapRegions);
  const totalSeats = election?.type === 'LS'
    ? (mapRegions.length || LS_DEFAULT_SEATS)
    : (election?.state?.total_assembly_seats || mapRegions.length);
  const majorityMilestone = manifestData?.milestones?.find(m => /majority/i.test(m.label))?.value;
  const majorityMark = majorityMilestone || Math.floor(totalSeats / 2) + 1;

  const toggleAdd = useCallback(() => setShowAddDropdown(v => !v), []);
  const addTracked = useCallback((id: string) => {
    // Nothing tracked means "show all"; adding an item keeps everything else visible too.
    if (userTracked.length === 0) return;
    setUserTracked([...userTracked, id]);
  }, [userTracked, setUserTracked]);

  if (!election) return <div className="empty-state"><h3>{t('select_election_prompt')}</h3></div>;
  if (loading && mapRegions.length === 0) return <Spinner label={t('loading')} />;
  if (error && mapRegions.length === 0) return (
    <div className="empty-state" style={{ padding: 40 }}>
      <p style={{ color: 'var(--danger)', fontWeight: 600 }}>{t('failed_to_load_election')}</p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{error}</p>
      <button className="btn btn-outline" onClick={refreshAll} style={{ marginTop: 12 }}>{t('retry')}</button>
    </div>
  );

  return (
    <div className="fade-in dashboard-layout" style={styles.layout}>
      <DashboardHeader election={election} />
      <KeyBattlesTicker battles={battles} onSelect={setModalConstId} />

      <div className="grid-map" style={{ marginTop: 'var(--space-2)' }}>
        <div style={styles.mapContainer}>
          <InteractiveMap
            regions={mapRegionsWithPulse}
            onRegionClick={setModalConstId}
            alliances={alliances}
            partyList={mapPartyList}
            geoConfig={manifestData?.geo}
            mapTab={mapTab}
            onMapTabChange={setMapTab}
            selectedIds={battleSelectedIds}
            onSelectedIdsChange={setBattleSelectedIds}
            swingMap={swingMap}
            constCandidates={constCandidates}
            dominanceMap={dominanceMap}
            spoilerData={spoilerData}
            electionType={election.type}
            voteSplits={manifestData?.vote_splits}
            spoilerFilter={spoilerFilter}
          />
        </div>

        <aside className="sidebar-card">
          <CollapsibleCard 
            title={t('party_standings')} 
            badge={<AllianceTallyBadge majorityMark={majorityMark} showAdd={showAddDropdown} onToggleAdd={toggleAdd} />}
            defaultOpen
          >
            <AllianceTally
              standings={standings}
              totalSeats={totalSeats}
              majorityMark={majorityMark}
              addableItems={addableItems}
              manifestIds={EMPTY_MANIFEST_IDS}
              onAdd={addTracked}
              onRemove={untrack}
              showAddDropdown={showAddDropdown}
              onToggleAdd={toggleAdd}
              electionType={election.type}
            />
          </CollapsibleCard>

          <CollapsibleCard title={t('leaders_watchlist')}>
            <WatchlistPanel
              electionId={election.id}
              watchlists={manifestData?.watchlists || []}
              leaders={manifestData?.leaders || []}
              cabinet={manifestData?.cabinet || []}
              resultMap={currentWinnerMap}
              partyColorMap={partyColorMap}
              allConstituencies={allConstituencyIds}
              onConstituencyClick={setModalConstId}
            />
          </CollapsibleCard>

          <CollapsibleCard 
            title={t('election_summary')}
            badge={declaredCount > 0 ? <span style={{ fontSize: 'var(--text-xs)' }}>{t('n_declared', { count: declaredCount })}</span> : undefined}
          >
            <ElectionSummary
              regions={mapRegions}
              standings={standings}
              alliances={alliances}
              dominanceMap={dominanceMap}
              electionType={election.type}
              mapTab={mapTab}
              selectedIds={battleSelectedIds}
              partyList={mapPartyList}
              swingMap={swingMap}
              incumbencyData={incumbencyData}
              partySwitchData={partySwitchData}
              marginTrend={ha.marginTrend}
              partyTrend={ha.partyTrend}
              voteSplits={manifestData?.vote_splits}
              constCandidates={constCandidates}
              spoilerFilter={spoilerFilter}
              onSpoilerFilterChange={setSpoilerFilter}
              onRegionClick={setModalConstId}
            />
          </CollapsibleCard>
        </aside>
      </div>

      <LiveToast toasts={toasts} onDismiss={dismissToast} />
      {modalConstId && (
        <ConstituencyModal
          electionId={election.id}
          constituencyId={modalConstId}
          onClose={() => setModalConstId(null)}
          onOpenFullPage={() => navigate(`/election/${election.id}/constituency/${modalConstId}`)}
          onPersonClick={(pid) => navigate(`/person/${pid}`)}
          standings={standings}
          manifestData={manifestData}
        />
      )}
    </div>
  );
}

// --- Internal Sub-Components ---

function DashboardHeader({ election }: { election: Election }) {
  return (
    <header style={styles.header}>
      <h2 style={styles.title}>{election.name}</h2>
      <StatusBadge status={election.status} />
      <span style={styles.year}>{election.year}</span>
      <div style={{ marginLeft: 'auto' }}>
        <ShareButtons text={`${election.name} - Election Tracker`} />
      </div>
    </header>
  );
}

const styles: Record<string, CSSProperties> = {
  layout: { display: 'flex', flexDirection: 'column', height: '100%', padding: '6px 8px', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexShrink: 0 },
  title: { fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 },
  year: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' },
  mapContainer: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }
};
