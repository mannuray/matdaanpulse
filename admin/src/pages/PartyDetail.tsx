import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePartyEdit } from '../hooks/usePartyEdit';
import AdminPageHeader from '../components/common/AdminPageHeader';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';

/**
 * PAGE: Party Detail (MVC: View)
 * Read-only summary of a political party master record.
 */
export default function PartyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');

  const { party, loading, form } = usePartyEdit(id);

  if (loading) return <Spinner label="Accessing party registry..." />;
  if (!party) return <div style={{ padding: 40, textAlign: 'center' }}>Party not found.</div>;

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader 
        title={party.name}
        breadcrumb="Party Registry"
        onBack={() => navigate('/parties')}
        actions={canWrite && (
          <button onClick={() => navigate(`/parties/${id}/edit`)} className="btn btn-primary" style={styles.editBtn}>
            EDIT PROFILE
          </button>
        )}
      />

      <div style={styles.mainContainer}>
        
        {/* HERO SECTION */}
        <ErrorBoundary>
          <div className="card-elevated" style={styles.heroCard}>
            <div style={{ ...styles.heroGlow, background: form.color || 'var(--accent)' }} />
            <div style={styles.heroInner}>
              <div style={styles.symbolBox}>
                {(form.symbol_url || form.eci_symbol_url) ? (
                  <img src={form.symbol_url || form.eci_symbol_url} style={styles.symbolImg} alt="" />
                ) : (
                  <span style={{ fontWeight: 800, fontSize: 32, color: form.color }}>{form.abbreviation || id?.slice(0, 2)}</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={styles.heroInfo}>
                  <h2 style={styles.heroName}>{form.name}</h2>
                  {form.abbreviation && <span style={styles.heroAbbr}>{form.abbreviation}</span>}
                </div>
                <div style={styles.heroLinks}>
                  {form.website && (
                    <a href={form.website} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={styles.heroLinkBtn}>🌐 WEBSITE</a>
                  )}
                  {form.wikipedia_url && (
                    <a href={form.wikipedia_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={styles.heroLinkBtn}>📖 WIKIPEDIA</a>
                  )}
                </div>
              </div>
            </div>
            
            {form.description && (
              <div style={styles.heroDescBox}>
                <div style={{ ...styles.descAccent, background: form.color }} />
                <div style={styles.descText}>{form.description}</div>
              </div>
            )}
          </div>
        </ErrorBoundary>

        <div style={styles.grid}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <ErrorBoundary>
              <div className="card-elevated" style={styles.cardPadding}>
                <h3 className="card-title-tiny">Organizational Profile</h3>
                <div style={styles.infoGrid}>
                  <InfoItem label="Leader" value={form.leader_name} />
                  <InfoItem label="Founded" value={form.founded_year} />
                  <InfoItem label="Headquarters" value={form.headquarters} />
                  <InfoItem label="Brand Color" value={form.color} />
                </div>
              </div>
            </ErrorBoundary>
          </div>

          <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
            <ErrorBoundary>
              <div className="card-elevated" style={styles.assetCard}>
                <h3 className="card-title-tiny">Visual Identity</h3>
                <div style={{ display: 'grid', gap: 16 }}>
                  <AssetRow label="Brand Logo" url={form.symbol_url} />
                  <AssetRow label="ECI Symbol" url={form.eci_symbol_url} />
                </div>
              </div>
            </ErrorBoundary>
          </aside>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: any }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value || 'Not recorded'}</span>
    </div>
  );
}

function AssetRow({ label, url }: { label: string, url: string }) {
  return (
    <div style={styles.assetRow}>
      <div style={styles.assetPreview}>
        {url ? <img src={url} style={styles.assetImg} alt="" /> : '?'}
      </div>
      <div style={{ fontSize: '11px', fontWeight: 700 }}>{label}</div>
    </div>
  );
}

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 80 },
  editBtn: { height: 34, padding: '0 24px', fontSize: '11px', fontWeight: 800 },
  mainContainer: { maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)' },
  heroCard: { marginBottom: 32, padding: 0, border: 'none', background: 'var(--bg-sidebar)', overflow: 'hidden' as const, position: 'relative' as const },
  heroGlow: { position: 'absolute' as const, right: '-10%', top: '-20%', width: '40%', height: '140%', opacity: 0.15, filter: 'blur(100px)', borderRadius: '50%' },
  heroInner: { padding: '32px 40px', display: 'flex', alignItems: 'center', gap: 32, position: 'relative' as const, zIndex: 1 },
  symbolBox: { width: 100, height: 100, borderRadius: 'var(--radius-lg)', background: '#fff', border: '4px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 12 },
  symbolImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const },
  heroInfo: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 },
  heroName: { fontSize: 32, fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' },
  heroAbbr: { background: 'rgba(255,255,255,0.1)', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 14, fontWeight: 800 },
  heroLinks: { display: 'flex', gap: 12, marginTop: 16 },
  heroLinkBtn: { background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', fontSize: 11, fontWeight: 700 },
  heroDescBox: { padding: '20px 40px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative' as const },
  descAccent: { position: 'absolute' as const, left: 0, top: 20, bottom: 20, width: 4, borderRadius: '0 4px 4px 0' },
  descText: { fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.8)', fontWeight: 400 },
  grid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-6)', alignItems: 'start' },
  cardPadding: { padding: 'var(--space-6)' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)' },
  infoItem: { borderBottom: '1px solid var(--bg-secondary)', paddingBottom: 10 },
  infoLabel: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, display: 'block', marginBottom: 4 },
  infoValue: { fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' },
  assetCard: { padding: 'var(--space-5)' },
  assetRow: { display: 'flex', alignItems: 'center', gap: 12, padding: 8, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' },
  assetPreview: { width: 40, height: 40, background: '#fff', border: '1px solid var(--border)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' as const },
  assetImg: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' as const },
};
