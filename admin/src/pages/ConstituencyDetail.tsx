import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConstituencyEditor } from '../hooks/useConstituencyEditor';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';

/**
 * PAGE: Constituency Detail (MVC: View)
 * Read-only summary of constituency data with edit access.
 */
export default function ConstituencyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');

  const { loading, constituency, election } = useConstituencyEditor(id);

  if (loading) return <Spinner label="Loading constituency dossier..." />;
  if (!constituency) return <div style={{ padding: 40, textAlign: 'center' }}>Constituency not found.</div>;

  const a = constituency.analysis;
  const inc = (a?.incumbency || {}) as { seat_history?: Array<{ year: number; party: string; candidate: string }> };
  const tags = (constituency.metadata?.tags as string[]) || [];
  const meta = constituency.metadata || {};

  return (
    <div className="fade-in" style={styles.pageRoot}>
      {/* 1. Header */}
      <div style={styles.headerRoot}>
        <div style={styles.headerContent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <button onClick={() => navigate('/constituencies')} className="btn btn-sm btn-outline" style={styles.backBtn}>&larr; BACK</button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={styles.breadcrumb}>{election?.name} / {election?.year}</span>
              <h1 style={styles.pageTitle}>{constituency.name}</h1>
            </div>
            <span className={`badge badge-${constituency.type.toLowerCase()}`} style={{ fontSize: '10px' }}>{constituency.type}</span>
          </div>
          {canWrite && (
            <button onClick={() => navigate(`/constituencies/${id}/edit`)} className="btn btn-primary" style={styles.editBtn}>
              EDIT DOSSIER
            </button>
          )}
        </div>
      </div>

      <div style={styles.mainContainer}>
        {/* Main Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          {/* Briefing */}
          <ErrorBoundary>
            <div className="card-elevated" style={styles.cardPadding}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                <h3 className="card-title-tiny" style={{ color: 'var(--accent)', margin: 0 }}>AI Strategic Briefing</h3>
                {a?.ai_status && (
                  <span className="badge badge-neutral" style={{ fontSize: '9px', fontWeight: 800 }}>
                    STATUS: {a.ai_status.toUpperCase()}
                  </span>
                )}
              </div>
              <div style={styles.briefingBox}>
                {a?.ai_briefing || "No narrative analysis recorded for this constituency."}
              </div>

              {a?.ai_key_issues && a.ai_key_issues.length > 0 && (
                <div style={{ marginTop: 'var(--space-6)' }}>
                  <h3 className="card-title-tiny">Key Battleground Issues</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {a.ai_key_issues.map((issue, i) => (
                      <span key={i} className="badge badge-neutral" style={styles.issueBadge}>{issue}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ErrorBoundary>

          {/* Demographics */}
          <ErrorBoundary>
            <div className="card-elevated" style={styles.cardPadding}>
              <h3 className="card-title-tiny">Constituency Demographics</h3>
              <div style={styles.demoGrid}>
                <StatItem label="Population" value={meta.population?.toLocaleString()} />
                <StatItem label="Literacy %" value={meta.literacy_pct ? `${meta.literacy_pct}%` : '-'} />
                <StatItem label="Urban %" value={meta.urban_pct ? `${meta.urban_pct}%` : '-'} />
                <StatItem label="SC/ST %" value={meta.sc_st_pct ? `${meta.sc_st_pct}%` : '-'} />
              </div>
              <div style={{ marginTop: 'var(--space-4)', display: 'grid', gap: 'var(--space-4)' }}>
                <div style={styles.demoRow}>
                  <span style={styles.demoLabel}>Dominant Castes</span>
                  <span style={styles.demoValue}>{(meta.dominant_castes as string) || 'Not recorded'}</span>
                </div>
                <div style={styles.demoRow}>
                  <span style={styles.demoLabel}>Religions</span>
                  <span style={styles.demoValue}>{(meta.religions as string) || 'Not recorded'}</span>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <ErrorBoundary>
            <div className="card-elevated" style={styles.sideCardPadding}>
              <h3 className="card-title-tiny">Administrative</h3>
              <div style={styles.infoList}>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>DISTRICT</span>
                  <span style={styles.infoValue}>{constituency.district?.name || '-'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>REGION</span>
                  <span style={styles.infoValue}>{constituency.region?.name || '-'}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>CONST #</span>
                  <span style={styles.infoValue}>{constituency.const_no}</span>
                </div>
                <div style={styles.infoItem}>
                  <span style={styles.infoLabel}>PHASE</span>
                  <span style={styles.infoValue}>{(meta.phase as string) || '-'}</span>
                </div>
              </div>
            </div>
          </ErrorBoundary>

          <ErrorBoundary>
            <div className="card-elevated" style={styles.sideCardPadding}>
              <h3 className="card-title-tiny">Classification Tags</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {tags.length > 0 ? tags.map(tag => (
                  <span key={tag} className="badge badge-neutral" style={styles.tagBadge}>
                    {tag.toUpperCase().replace(/_/g, ' ')}
                  </span>
                )) : <span style={styles.emptyText}>No tags applied.</span>}
              </div>
            </div>
          </ErrorBoundary>

          {inc.seat_history && (
            <ErrorBoundary>
              <div className="card-elevated" style={styles.sideCardPadding}>
                <h3 className="card-title-tiny">Historical Records</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {inc.seat_history.map((h, i) => (
                    <div key={i} style={styles.historyRow}>
                      <div style={styles.historyYear}>{String(h.year).slice(-2)}</div>
                      <div>
                        <div style={styles.historyParty}>{h.party}</div>
                        <div style={styles.historyCandidate}>{h.candidate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </ErrorBoundary>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string, value: any }) {
  return (
    <div style={styles.statItem}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value || '-'}</div>
    </div>
  );
}

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 80 },
  headerRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: 'var(--space-4) var(--space-6)', position: 'sticky' as const, top: 0, zIndex: 100 },
  headerContent: { maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { height: 32, fontSize: '10px', fontWeight: 800 },
  breadcrumb: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const },
  pageTitle: { fontSize: 'var(--text-xl)', fontWeight: 900, margin: 0, lineHeight: 1 },
  editBtn: { height: 34, padding: '0 24px', fontSize: '11px', fontWeight: 800 },
  mainContainer: { maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-6)' },
  cardPadding: { padding: 'var(--space-6)' },
  sideCardPadding: { padding: 'var(--space-5)' },
  briefingBox: { fontSize: '15px', lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' as const, background: 'var(--bg-secondary)', padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  issueBadge: { fontSize: '11px', fontWeight: 700, padding: '6px 12px' },
  demoGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-4)' },
  statItem: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  statLabel: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const },
  statValue: { fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' },
  demoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  demoLabel: { fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const },
  demoValue: { fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' },
  infoList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  infoItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-secondary)', paddingBottom: 8 },
  infoLabel: { fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' },
  infoValue: { fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' },
  tagBadge: { fontSize: '10px', fontWeight: 700, padding: '4px 8px' },
  emptyText: { fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' as const },
  historyRow: { display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--bg-secondary)', paddingBottom: 8 },
  historyYear: { width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)' },
  historyParty: { fontSize: '12px', fontWeight: 800 },
  historyCandidate: { fontSize: '11px', color: 'var(--text-secondary)' },
};
