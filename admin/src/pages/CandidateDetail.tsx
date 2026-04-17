import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCandidateEdit } from '../hooks/useCandidateEdit';
import AdminPageHeader from '../components/common/AdminPageHeader';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';

/**
 * PAGE: Candidate Detail (MVC: View)
 * Read-only summary of a candidate's profile and election context.
 */
export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');

  const { candidate, loading, form, parties } = useCandidateEdit(id);

  if (loading) return <Spinner label="Loading candidate profile..." />;
  if (!candidate) return <div style={{ padding: 40, textAlign: 'center' }}>Candidate not found.</div>;

  const party = parties.find(p => p.id === form.party_id);
  const meta = (candidate.metadata || {}) as any;

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader 
        title={candidate.name}
        breadcrumb="Candidate Dossier"
        onBack={() => navigate('/candidates')}
        actions={canWrite && (
          <button onClick={() => navigate(`/candidates/${id}/edit`)} className="btn btn-primary" style={styles.editBtn}>
            EDIT PROFILE
          </button>
        )}
      />

      <div style={styles.mainContainer}>
        {/* Main Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <ErrorBoundary>
            <div className="card-elevated" style={styles.heroCard}>
              <div style={{ ...styles.heroGlow, background: party?.color || 'var(--accent)' }} />
              <div style={styles.heroContent}>
                <div style={{ position: 'relative' }}>
                  {form.photo_url ? (
                    <img src={form.photo_url} alt="" style={styles.heroImg} />
                  ) : (
                    <div style={styles.heroPlaceholder}>{candidate.name.charAt(0)}</div>
                  )}
                  {candidate.is_incumbent && <div style={styles.incumbentBadge}>INCUMBENT</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.partyRow}>
                    <span style={{ ...styles.partyDot, background: party?.color || '#6b7280' }} />
                    {party?.name || 'Independent'}
                  </div>
                  <h2 style={styles.heroName}>{candidate.name}</h2>
                  <div style={styles.heroMeta}>
                    <span>{candidate.election?.year} {candidate.election?.type}</span>
                    <span>&bull;</span>
                    <span>{candidate.constituency?.name}</span>
                  </div>
                </div>
              </div>
            </div>
          </ErrorBoundary>

          {/* Affidavit Summary */}
          <ErrorBoundary>
            <div className="card-elevated" style={styles.cardPadding}>
              <h3 className="card-title-tiny">Affidavit Summary</h3>
              <div style={styles.detailsGrid}>
                <DetailItem label="Age" value={meta.age} />
                <DetailItem label="Gender" value={meta.gender} />
                <DetailItem label="Education" value={meta.education} />
                <DetailItem label="Criminal Cases" value={meta.criminal_cases} />
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <div style={styles.detailLabel}>Declared Assets</div>
                <div style={styles.detailValue}>{meta.assets || 'Not specified'}</div>
              </div>
            </div>
          </ErrorBoundary>
        </div>

        {/* Sidebar: Registry Link */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <ErrorBoundary>
            <div className="card-elevated" style={styles.registryCard}>
              <h3 className="card-title-tiny" style={{ color: 'var(--accent)' }}>Master Registry</h3>
              {candidate.person ? (
                <div style={styles.linkedBox}>
                  <div style={styles.linkedHeader}>
                    <div style={styles.linkedAvatar}>
                      {candidate.person.photo_url ? (
                        <img src={candidate.person.photo_url} style={styles.avatarImg} alt="" />
                      ) : candidate.person.name.charAt(0)}
                    </div>
                    <div>
                      <div style={styles.linkedName}>{candidate.person.name}</div>
                      <div style={styles.linkedLabel}>LINKED MASTER RECORD</div>
                    </div>
                  </div>
                  <Link to={`/persons/${candidate.person_id}`} className="btn btn-sm btn-outline" style={{ width: '100%', fontSize: '10px', fontWeight: 700 }}>
                    VIEW MASTER PROFILE
                  </Link>
                </div>
              ) : (
                <div style={styles.unlinkedBox}>
                  <div style={styles.unlinkedText}>This candidate record is not yet linked to a master person profile.</div>
                  {canWrite && (
                    <button onClick={() => navigate(`/candidates/${id}/edit`)} className="btn btn-sm btn-outline" style={{ marginTop: 8, fontSize: '10px' }}>
                      RESOLVE LINKING
                    </button>
                  )}
                </div>
              )}
            </div>
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string, value: any }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={styles.detailLabel}>{label}</div>
      <div style={styles.detailValue}>{value || '-'}</div>
    </div>
  );
}

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 80 },
  editBtn: { height: 34, padding: '0 24px', fontSize: '11px', fontWeight: 800 },
  mainContainer: { maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-6)' },
  heroCard: { padding: '32px', background: 'var(--bg-sidebar)', color: '#fff', position: 'relative' as const, overflow: 'hidden' },
  heroGlow: { position: 'absolute' as const, right: '-10%', top: '-20%', width: '40%', height: '140%', opacity: 0.15, filter: 'blur(80px)', borderRadius: '50%' },
  heroContent: { display: 'flex', gap: '24px', alignItems: 'center', position: 'relative' as const, zIndex: 1 },
  heroImg: { width: 100, height: 100, borderRadius: 'var(--radius-lg)', objectFit: 'cover' as const, border: '3px solid rgba(255,255,255,0.1)' },
  heroPlaceholder: { width: 100, height: 100, borderRadius: 'var(--radius-lg)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: 'rgba(255,255,255,0.2)' },
  incumbentBadge: { position: 'absolute' as const, bottom: -8, left: '50%', transform: 'translateX(-50%)', background: 'var(--warning)', color: '#000', padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '9px', fontWeight: 900, whiteSpace: 'nowrap' as const },
  partyRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  partyDot: { width: 8, height: 8, borderRadius: '50%' },
  heroName: { fontSize: '28px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' },
  heroMeta: { display: 'flex', alignItems: 'center', gap: 8, fontSize: '13px', color: 'rgba(255,255,255,0.5)', fontWeight: 600 },
  cardPadding: { padding: 'var(--space-6)' },
  detailsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-4)' },
  detailLabel: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const },
  detailValue: { fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' },
  registryCard: { padding: 'var(--space-5)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft)' },
  linkedBox: { background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  linkedHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  linkedAvatar: { width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, border: '1px solid var(--border)', overflow: 'hidden' as const },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
  linkedName: { fontWeight: 800, color: 'var(--text-primary)', fontSize: '13px' },
  linkedLabel: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 },
  unlinkedBox: { padding: '12px', textAlign: 'center' as const },
  unlinkedText: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, lineHeight: 1.5 },
};
