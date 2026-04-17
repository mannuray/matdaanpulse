import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useElection } from '../hooks/useElection';
import { useSSE } from '../hooks/useSSE';
import { useDashboardData } from '../hooks/useDashboardData';
import { useHistoryAnalysis } from '../hooks/useHistoryAnalysis';
import { useAnalysis } from '../hooks/useAnalysis';

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

import type { SSEEvent, ToastMessage, Election } from '../types';

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
    constCandidates, currentWinnerMap, partyColorMap, mapPartyList,
    mapRegions, spoilerData,
    modalConstId, setModalConstId,
    mapTab, setMapTab,
    userTracked, setUserTracked,
    spoilerFilter, setSpoilerFilter,
    refreshAll
  } = controller;

  const [recentChanges, setRecentChanges] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [battleSelectedIds, setBattleSelectedIds] = useState<Set<string>>(new Set());
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  // 1. Domain Logic Delegation
  const ha = useHistoryAnalysis({
    results, currentWinnerMap,
    allHistResults: null,
    prevResults: null,
    allConstIds: [...constCandidates.keys()],
    historyYears: manifestData?.history_years || [],
    currentYear: election?.year || 0,
  });

  const ba = useAnalysis(election?.status === 'Finalized' ? election.id : undefined);

  // 2. Real-time Events
  const handleSSE = useCallback((event: SSEEvent) => {
    if (event.type === 'tally-update' || event.type === 'result-update' || event.type === 'batch-update') {
      refreshAll();
      if (event.type === 'result-update' && event.data?.const_id) {
        setRecentChanges(prev => new Set(prev).add(event.data!.const_id!));
      }
    }
  }, [refreshAll]);

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

  const declaredCount = useDeclaredCount(mapRegions);
  const totalSeats = election?.type === 'LS' ? 543 : (election?.state?.total_assembly_seats || mapRegions.length);
  const majorityMark = Math.floor(totalSeats / 2) + 1;

  if (!election) return <div className="empty-state"><h3>{t('select_election_prompt')}</h3></div>;
  if (loading && mapRegions.length === 0) return <Spinner label={t('loading')} />;
  if (error && mapRegions.length === 0) return (
    <div className="empty-state" style={{ padding: 40 }}>
      <p style={{ color: 'var(--danger)', fontWeight: 600 }}>Failed to load election data</p>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>{error}</p>
      <button className="btn btn-outline" onClick={refreshAll} style={{ marginTop: 12 }}>Retry</button>
    </div>
  );

  return (
    <div className="fade-in dashboard-layout" style={styles.layout}>
      <DashboardHeader election={election} />
      <KeyBattlesTicker battles={battles} onSelect={setModalConstId} />

      <div className="grid-map" style={{ marginTop: 'var(--space-2)' }}>
        <div style={styles.mapContainer}>
          <InteractiveMap
            regions={mapRegions.map(r => ({ ...r, recentChange: recentChanges.has(r.id) }))}
            onRegionClick={setModalConstId}
            alliances={manifestData?.alliances || []}
            partyList={mapPartyList}
            geoConfig={manifestData?.geo}
            mapTab={mapTab}
            onMapTabChange={setMapTab}
            selectedIds={battleSelectedIds}
            onSelectedIdsChange={setBattleSelectedIds}
            swingMap={ba.swingMap || new Map()}
            constCandidates={constCandidates}
            dominanceMap={ba.dominanceMap.size > 0 ? ba.dominanceMap : ha.dominanceMap}
            spoilerData={spoilerData}
            electionType={election.type}
            voteSplits={manifestData?.vote_splits}
            spoilerFilter={spoilerFilter}
          />
        </div>

        <aside className="sidebar-card">
          <CollapsibleCard 
            title={t('party_standings')} 
            badge={<AllianceTallyBadge majorityMark={majorityMark} totalSeats={totalSeats} showAdd={showAddDropdown} onToggleAdd={() => setShowAddDropdown(!showAddDropdown)} />}
            defaultOpen
          >
            <AllianceTally
              standings={standings}
              totalSeats={totalSeats}
              majorityMark={majorityMark}
              addableItems={[]}
              manifestIds={new Set()}
              onAdd={(id) => setUserTracked([...userTracked, id])}
              onRemove={(id) => setUserTracked(userTracked.filter(x => x !== id))}
              showAddDropdown={showAddDropdown}
              onToggleAdd={() => setShowAddDropdown(!showAddDropdown)}
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
              allConstituencies={mapRegions.map(r => r.id)}
              onConstituencyClick={setModalConstId}
            />
          </CollapsibleCard>

          <CollapsibleCard 
            title={t('election_summary')}
            badge={declaredCount > 0 ? <span style={{ fontSize: 'var(--text-xs)' }}>{declaredCount} declared</span> : undefined}
          >
            <ElectionSummary
              regions={mapRegions}
              standings={standings}
              alliances={manifestData?.alliances || []}
              dominanceMap={ba.dominanceMap.size > 0 ? ba.dominanceMap : ha.dominanceMap}
              electionType={election.type}
              mapTab={mapTab}
              voteSplits={manifestData?.vote_splits}
              constCandidates={constCandidates}
              spoilerFilter={spoilerFilter}
              onSpoilerFilterChange={setSpoilerFilter}
              onRegionClick={setModalConstId}
            />
          </CollapsibleCard>
        </aside>
      </div>

      <LiveToast toasts={toasts} onDismiss={(id) => setToasts(t => t.filter(x => x.id !== id))} />
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

const styles = {
  layout: { display: 'flex', flexDirection: 'column' as const, height: '100%', padding: '6px 8px', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexShrink: 0 },
  title: { fontSize: 'var(--text-xl)', fontWeight: 'var(--weight-bold)', margin: 0 },
  year: { color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' },
  mapContainer: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }
};
