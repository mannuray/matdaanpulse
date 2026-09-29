import { useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useConstituencyDetail } from '../../hooks/useConstituencyDetail';
import CandidateTable from './CandidateTable';
import Spinner from '../atoms/Spinner';
import type { StandingsData, ManifestData } from '../../types';

interface ConstituencyModalProps {
  electionId: string;
  constituencyId: string;
  onClose: () => void;
  onOpenFullPage?: () => void;
  onPersonClick?: (id: string) => void;
  standings?: StandingsData;
  manifestData?: ManifestData | null;
}

/**
 * ORGANISM: Constituency Modal (MVC: View)
 * High-density detail view for quick constituency analysis.
 */
const ConstituencyModal = memo(function ConstituencyModal({
  electionId,
  constituencyId,
  onClose,
  onOpenFullPage,
  onPersonClick,
  standings,
  manifestData
}: ConstituencyModalProps) {
  const { t } = useTranslation();
  const { 
    constituency, stats, spoilerInfo, 
    badges, loading, error 
  } = useConstituencyDetail(electionId, constituencyId, standings, manifestData);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!constituencyId) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={styles.overlay}>
      <div 
        className="modal-container card-elevated" 
        onClick={(e) => e.stopPropagation()}
        style={styles.container}
      >
        {/* Header */}
        <header style={styles.header}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={styles.breadcrumb}>
              {constituency?.state?.name} / {constituency?.district?.name}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={styles.title}>{constituency?.name || constituencyId.replace(/_/g, ' ')}</h2>
              {constituency?.type && (
                <span className={`badge badge-${constituency.type.toLowerCase()}`} style={styles.typeBadge}>
                  {constituency.type}
                </span>
              )}
              {spoilerInfo?.isAffected && (
                <span className="badge badge-danger" style={styles.spoilerBadge}>
                  ⚠️ SPOILER AFFECTED
                </span>
              )}
              {badges?.isThreeWay && (
                <span className="badge badge-warning" style={styles.threeWayBadge}>
                  ⚔️ 3-WAY CONTEST
                </span>
              )}
            </div>
            {/* Tags Cloud */}
            {badges?.manualTags && badges.manualTags.length > 0 && (
              <div style={styles.tagCloud}>
                {badges.manualTags.map((tag: string) => (
                  <span key={tag} className="badge badge-neutral" style={styles.tagItem}>
                    {tag.toUpperCase().replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {onOpenFullPage && (
              <button onClick={onOpenFullPage} className="btn btn-sm btn-outline">
                {t('view_full_page')} ↗
              </button>
            )}
            <button onClick={onClose} style={styles.closeBtn}>&times;</button>
          </div>
        </header>

        {loading ? (
          <div style={styles.loadingBox}><Spinner label={t('loading_details')} /></div>
        ) : error ? (
          <div style={styles.errorBox}>{error}</div>
        ) : (
          <>
            {/* Quick Stats Grid */}
            <div style={styles.statsGrid}>
              <StatItem label="Turnout" value={constituency?.voter_turnout ? `${constituency.voter_turnout}%` : '—'} />
              <StatItem label="Total Votes" value={stats?.totalVotesPolled?.toLocaleString()} />
              <StatItem 
                label="Win Margin" 
                value={stats?.winner?.margin ? `+${stats.winner.margin.toLocaleString()}` : '—'} 
                color="var(--success)"
              />
              <StatItem label="Phase" value={constituency?.phase} />
            </div>

            {/* Spoiler Insight Note */}
            {spoilerInfo?.isAffected && (
              <div style={styles.spoilerNote}>
                <div style={{ fontWeight: 800, marginBottom: 2 }}>POTENTIAL VOTE SPLIT DETECTED</div>
                Cumulative split votes from <strong>{spoilerInfo.splitters.join(', ')}</strong> ({spoilerInfo.splitVotes.toLocaleString()}) 
                exceeded the winner's margin of {spoilerInfo.margin.toLocaleString()}. 
                The result for {spoilerInfo.beneficiary} was potentially flipped.
              </div>
            )}

            {/* Candidates Table */}
            <div style={styles.tableBox}>
              {stats?.candidatesWithShare && (
                <CandidateTable 
                  candidates={stats.candidatesWithShare} 
                  onPersonClick={onPersonClick}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
});

function StatItem({ label, value, color }: { label: string, value: string | number | null | undefined, color?: string }) {
  return (
    <div style={styles.statItem}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: color || 'var(--text-primary)' }}>{value || '—'}</div>
    </div>
  );
}

const styles = {
  overlay: { zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' },
  container: { width: '100%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' as const, position: 'relative' as const, padding: 0 },
  header: { padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', sticky: 'top', background: 'var(--bg-card)', zIndex: 10 },
  breadcrumb: { fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 4 },
  title: { margin: 0, fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' },
  typeBadge: { fontSize: '10px', padding: '2px 8px' },
  spoilerBadge: { fontSize: '10px', padding: '2px 8px', background: 'var(--danger)', color: '#fff' },
  threeWayBadge: { fontSize: '10px', padding: '2px 8px', background: 'var(--warning)', color: '#000', fontWeight: 800 },
  tagCloud: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginTop: 8 },
  tagItem: { fontSize: '8px', padding: '1px 6px', fontWeight: 800 },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', lineHeight: 1, padding: '0 4px', color: 'var(--text-muted)' },
  loadingBox: { padding: '60px', display: 'flex', justifyContent: 'center' },
  errorBox: { padding: '40px', textAlign: 'center' as const, color: 'var(--danger)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--border)', borderBottom: '1px solid var(--border)' },
  statItem: { padding: '16px', background: 'var(--bg-card)', textAlign: 'center' as const },
  statLabel: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: 4 },
  statValue: { fontSize: '15px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  spoilerNote: { padding: '12px 24px', background: 'var(--danger-soft)', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--danger-text)', lineHeight: 1.5 },
  tableBox: { padding: '0' },
};

export default ConstituencyModal;
