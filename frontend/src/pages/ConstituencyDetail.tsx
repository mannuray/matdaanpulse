import { useEffect, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useConstituencyDetail } from '../hooks/useConstituencyDetail';
import { useElection } from '../hooks/useElection';
import { useApi } from '../hooks/useApi';
import { getElection, getAlliances, getManifest, ElectionService } from '../services/election.service';
import Spinner from '../components/atoms/Spinner';
import ShareButtons from '../components/atoms/ShareButtons';
import CandidateTable from '../components/organisms/CandidateTable';
import ErrorBoundary from '../components/ErrorBoundary';
import { 
  ConstituencyModalStats, 
  ConstituencyModalInsights 
} from '../components/organisms/ConstituencyModalSubComponents';
import type { Constituency, IncumbencyEntry, StandingsData } from '../types';

/**
 * PAGE: Constituency Detail (MVC: View)
 * Highly optimized ultra-focused dashboard layout.
 */
export default function ConstituencyDetail() {
  const { electionId, constId } = useParams<{ electionId: string; constId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { election, setElection, setElectionType, setSelectedStateId } = useElection();

  // On direct load the context has no election: fetch it from the route param.
  const needsElection = !!electionId && election?.id !== electionId;
  const { data: routeElection } = useApi(
    () => (needsElection ? getElection(electionId!) : Promise.resolve(null)),
    [electionId, needsElection],
    { key: needsElection ? ElectionService.getCacheKey(electionId!) : undefined }
  );
  useEffect(() => {
    if (routeElection && routeElection.id === electionId && election?.id !== electionId) {
      setElection(routeElection);
      setElectionType(routeElection.type);
      if (routeElection.type === 'VS' && routeElection.state_id) setSelectedStateId(routeElection.state_id);
    }
  }, [routeElection, electionId, election?.id, setElection, setElectionType, setSelectedStateId]);

  // Only what this page needs: party names/colours and the manifest (spoiler + VIP data).
  const { data: partySeats } = useApi(
    () => (electionId ? getAlliances(electionId) : Promise.resolve([])),
    [electionId],
    { key: electionId ? ElectionService.getCacheKey(electionId, 'alliances') : undefined }
  );
  const { data: manifest } = useApi(
    () => (electionId ? getManifest(electionId) : Promise.resolve(null)),
    [electionId],
    { key: electionId ? ElectionService.getCacheKey(electionId, 'manifest') : undefined }
  );
  const manifestData = manifest?.draft || null;
  const standings = useMemo((): StandingsData => ({
    groups: [],
    independents: (partySeats || []).map(p => ({
      id: p.party_id, name: p.party_name, color: p.color,
      won: Number(p.won) || 0, leading: Number(p.leading) || 0, isManifest: false,
    })),
  }), [partySeats]);

  const { 
    constituency, 
    analysis, 
    stats, 
    badges, 
    formattedDemographics, 
    loading, 
    error 
  } = useConstituencyDetail(electionId!, constId!, standings, manifestData);
  const hasCommunityData = (formattedDemographics?.length ?? 0) > 0;

  if (loading) return <Spinner label={t('loading')} />;

  if (error || !constituency) {
    return (
      <div className="empty-state">
        <h3>{t('error_occurred')}</h3>
        <p>{error || t('constituency_not_found')}</p>
        <button onClick={() => navigate(-1)} className="btn btn-primary">← {t('back')}</button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <DetailHeader constituency={constituency} navigate={navigate} />

      <div className="page-container" style={styles.container}>
        {/* Left column only when there is community data; otherwise the stats column takes the full width. */}
        <div className="constituency-grid" style={hasCommunityData ? styles.grid : styles.gridSingle}>
          {hasCommunityData && (
            <aside style={styles.leftCol}>
              <div style={styles.twoColGrid}>
                <ErrorBoundary>
                  <DemographicsCard data={formattedDemographics ?? []} />
                </ErrorBoundary>
              </div>
            </aside>
          )}

          <div style={hasCommunityData ? styles.rightCol : styles.rightColFull}>
            <ErrorBoundary>
              <div className="card-elevated" style={styles.statsCard}>
                <ConstituencyModalStats
                  totalElectors={constituency.total_electors || undefined}
                  totalVotesPolled={stats?.totalVotesPolled || 0}
                  voterTurnout={constituency.voter_turnout ? Number(constituency.voter_turnout) : null}
                  winMargin={stats?.winner?.margin}
                  t={t}
                />
                <div style={styles.statsDivider}>
                  <ConstituencyModalInsights
                    badges={badges || {}}
                    seatType={typeof analysis?.incumbency?.seat_type === 'string' ? analysis.incumbency.seat_type : undefined}
                    incumbencyEntry={toIncumbencyEntry(analysis?.incumbency, constId!)}
                    totalVotesPolled={stats?.totalVotesPolled || 0}
                  />
                </div>
              </div>
            </ErrorBoundary>

            <ErrorBoundary>
              <div className="card-elevated">
                <div style={styles.tableHeader}>
                  <h3 style={styles.tableTitle}>{t('candidate_standings')}</h3>
                  <span style={styles.tableCount}>{stats?.candidatesWithShare?.length}</span>
                </div>
                <div style={{ padding: '0' }}>
                  {stats?.candidatesWithShare && (
                    <CandidateTable 
                      candidates={stats.candidatesWithShare} 
                      onPersonClick={(pid) => navigate(`/person/${pid}`)}
                    />
                  )}
                </div>
              </div>
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

/** Map the analysis `incumbency` JSON blob to the typed entry the insights row expects. */
function toIncumbencyEntry(inc: Record<string, unknown> | undefined, constId: string): IncumbencyEntry | undefined {
  if (!inc || typeof inc.incumbent_name !== 'string') return undefined;
  return {
    constId,
    incumbentName: inc.incumbent_name,
    incumbentParty: typeof inc.incumbent_party === 'string' ? inc.incumbent_party : '',
    won: !!inc.won,
    currentMargin: typeof inc.margin === 'number' ? inc.margin : 0,
  };
}

function DetailHeader({ constituency, navigate }: { constituency: Constituency; navigate: NavigateFunction }) {
  const { t } = useTranslation();
  return (
    <div style={styles.headerRoot}>
      <div style={styles.headerContent}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate(-1)} style={styles.backButton}>← {t('back')}</button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={styles.breadcrumb}>
              {[constituency.state?.name, constituency.district?.name].filter(Boolean).join(' / ')}
            </span>
            <h1 style={styles.pageTitle}>{constituency.name}</h1>
          </div>
          <span className={`badge badge-${constituency.type?.toLowerCase()}`} style={styles.typeBadge}>
            {constituency.type}
          </span>
        </div>
        <ShareButtons text={t('share_constituency_results', { name: constituency.name })} />
      </div>
    </div>
  );
}

function DemographicsCard({ data }: { data: { label: string; value: string }[] }) {
  const { t } = useTranslation();
  return (
    <div className="card-elevated" style={styles.cardPadding}>
      <h3 className="card-title-tiny" style={{ marginBottom: 'var(--space-4)' }}>{t('community_data')}</h3>
      <div style={{ display: 'grid', gap: '10px' }}>
        {data.map((item) => (
          <div key={item.label} style={styles.demographicRow}>
            <span style={styles.demographicLabel}>{item.label}</span>
            <span style={styles.demographicValue}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Styles ---

const styles: Record<string, CSSProperties> = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100%' },
  headerRoot: { 
    background: 'var(--bg-primary)', 
    borderBottom: '1px solid var(--border)', 
    padding: 'var(--space-2) var(--space-6)', 
    position: 'sticky' as const, 
    top: 0, 
    zIndex: 100 
  },
  headerContent: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 'var(--space-4)' },
  backButton: { 
    background: 'var(--bg-secondary)', border: '1px solid var(--border)', 
    borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '10px', 
    fontWeight: 800, cursor: 'pointer', color: 'var(--text-secondary)' 
  },
  breadcrumb: { 
    fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', 
    textTransform: 'uppercase' as const, letterSpacing: '0.08em' 
  },
  pageTitle: { fontSize: '18px', fontWeight: 900, margin: 0, lineHeight: 1, color: 'var(--text-primary)' },
  typeBadge: { fontSize: '9px', padding: '1px 6px' },
  container: { padding: 'var(--space-6)', height: 'auto', overflow: 'visible', maxWidth: 'none' },
  grid: { 
    display: 'grid', 
    gridTemplateColumns: '1fr 500px', 
    gap: 'var(--space-6)', 
    alignItems: 'start' 
  },
  gridSingle: { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 'var(--space-6)', alignItems: 'start' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', width: '500px', flexShrink: 0 },
  rightColFull: { display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 },
  cardPadding: { padding: 'var(--space-6)' },
  twoColGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 'var(--space-6)' },
  demographicRow: { 
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', 
    fontSize: '13px', borderBottom: '1px solid var(--bg-secondary)', paddingBottom: '10px', gap: '16px' 
  },
  demographicLabel: { 
    color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' as const, 
    whiteSpace: 'nowrap' as const, fontSize: '10px', letterSpacing: '0.04em' 
  },
  demographicValue: { fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' as const },
  statsCard: { padding: 'var(--space-5)' },
  statsDivider: { marginTop: 'var(--space-4)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' },
  tableHeader: { 
    padding: '12px 16px', borderBottom: '1px solid var(--border)', 
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' 
  },
  tableTitle: { 
    fontSize: '11px', fontWeight: 900, margin: 0, 
    textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--text-secondary)' 
  },
  tableCount: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 800 },
};
