import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePersonEdit } from '../hooks/usePersonEdit';
import Spinner from '../components/atoms/Spinner';
import type { PersonCandidate } from '../types';

/**
 * PAGE: Person Detail (MVC: View)
 * Read-only summary of a master record with administrative actions.
 */
export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');

  const { person, loading, form } = usePersonEdit(id);

  if (loading) return <Spinner label="Accessing master registry..." />;
  if (!person) return <div style={{ padding: 40, textAlign: 'center' }}>Record not found.</div>;

  const meta = (person.metadata || {}) as Record<string, any>;

  return (
    <div className="fade-in" style={styles.pageRoot}>
      {/* 1. Header */}
      <div style={styles.headerRoot}>
        <div style={styles.headerContent}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <button onClick={() => navigate('/persons')} className="btn btn-sm btn-outline" style={styles.backBtn}>&larr; BACK</button>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={styles.breadcrumb}>Master Registry / ID: {person.id.split('-')[0]}</span>
              <h1 style={styles.pageTitle}>{person.name}</h1>
            </div>
          </div>
          {canWrite && (
            <button onClick={() => navigate(`/persons/${id}/edit`)} className="btn btn-primary" style={styles.editBtn}>
              EDIT PROFILE
            </button>
          )}
        </div>
      </div>

      <div style={styles.mainContainer}>
        {/* Main Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          
          <div className="card-elevated" style={{ padding: 'var(--space-6)', display: 'flex', gap: 24, alignItems: 'center' }}>
            {form.photo_url ? (
              <img src={form.photo_url} alt="" style={styles.avatarImg} />
            ) : (
              <div style={styles.avatarPlaceholder}>{person.name.charAt(0)}</div>
            )}
            <div>
              <div style={styles.identityLabel}>Master Identity</div>
              <h2 style={styles.displayName}>{person.name}</h2>
              <div style={styles.quickInfo}>
                <span>{form.gender || 'GENDER UNSPECIFIED'}</span>
                <span>&bull;</span>
                <span>{form.education || 'EDUCATION NOT RECORDED'}</span>
                <span>&bull;</span>
                <span>{person.candidates?.length || 0} APPEARANCES</span>
              </div>
            </div>
          </div>

          {/* Dossier / Bio */}
          <div className="card-elevated" style={styles.cardPadding}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 className="card-title-tiny" style={{ color: 'var(--accent)', margin: 0 }}>Administrative Dossier</h3>
              {meta.ai_generated_at && <span style={styles.verifiedDate}>VERIFIED: {new Date(meta.ai_generated_at as string).toLocaleDateString()}</span>}
            </div>
            
            <div style={styles.bioBox}>
              {form.bio || "No biography or strategic profiling recorded for this individual."}
            </div>

            {form.wikipedia_url && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <a href={form.wikipedia_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline" style={{ fontSize: '10px', fontWeight: 700 }}>
                  OPEN WIKIPEDIA ↗
                </a>
              </div>
            )}
          </div>

          {/* Personal Metadata */}
          <div className="card-elevated" style={styles.cardPadding}>
            <h3 className="card-title-tiny">Record Details</h3>
            <div style={styles.detailsGrid}>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Full Name</span>
                <span style={styles.detailValue}>{form.name}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Date of Birth</span>
                <span style={styles.detailValue}>{form.date_of_birth || 'Not recorded'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Caste/Community</span>
                <span style={styles.detailValue}>{(meta.caste as string) || 'Not recorded'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Religion</span>
                <span style={styles.detailValue}>{(meta.religion as string) || 'Not recorded'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar: Election History */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <div className="card-elevated" style={styles.sideCardPadding}>
            <h3 className="card-title-tiny">Election History</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {person.candidates?.map((c: PersonCandidate) => {
                const constName = c.constituency_name || c.const_id;
                const electionName = c.election_name || c.election_id;
                const partyId = c.party_id || 'IND';
                const year = c.election_year;
                return (
                  <div key={c.id} style={styles.historyRow}>
                    <div style={styles.historyMeta}>
                      <div style={styles.historyConst}>{constName}</div>
                      <div style={styles.historyContext}>
                        {electionName}{year ? ` (${year})` : ''} &middot; {partyId}
                      </div>
                    </div>
                    {c.is_incumbent && <span className="badge badge-editor" style={{ fontSize: '8px' }}>INC</span>}
                  </div>
                );
              })}
              {(!person.candidates || person.candidates.length === 0) && (
                <div style={styles.emptyText}>No participation records found.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
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
  mainContainer: { maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 400px', gap: 'var(--space-6)' },
  cardPadding: { padding: 'var(--space-6)' },
  sideCardPadding: { padding: 'var(--space-5)' },
  avatarImg: { width: 100, height: 100, borderRadius: 'var(--radius-lg)', objectFit: 'cover' as const, border: '1px solid var(--border)' },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 800, color: 'var(--text-muted)' },
  identityLabel: { fontSize: '11px', fontWeight: 800, color: 'var(--accent)', textTransform: 'uppercase' as const, marginBottom: 4 },
  displayName: { fontSize: '24px', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' },
  quickInfo: { display: 'flex', gap: 12, marginTop: 8, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' },
  verifiedDate: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 },
  bioBox: { fontSize: '14px', lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' as const, background: 'var(--bg-secondary)', padding: '20px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  detailsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' },
  detailItem: { display: 'flex', flexDirection: 'column' as const, gap: 4 },
  detailLabel: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const },
  detailValue: { fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' },
  historyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-secondary)', paddingBottom: 8 },
  historyMeta: { display: 'flex', flexDirection: 'column' as const },
  historyConst: { fontSize: '12px', fontWeight: 800 },
  historyContext: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 },
  emptyText: { fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' as const },
};
