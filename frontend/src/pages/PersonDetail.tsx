import type { CSSProperties } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePersonProfile } from '../hooks/usePersonProfile';
import { PersonService } from '../services/person.service';
import Spinner from '../components/atoms/Spinner';
import StatusBadge from '../components/atoms/StatusBadge';
import type { PersonDetail as PersonDetailData, PersonCandidate } from '../types';

/**
 * PAGE: Person Detail (MVC: View)
 * Master profile view showing historical performance and personal dossier.
 */
export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { person, loading, error } = usePersonProfile(id!);

  if (loading) return <Spinner label={t('loading')} />;

  if (error || !person) {
    return (
      <div className="empty-state">
        <h3>{t('error_occurred')}</h3>
        <p>{error || 'Person not found'}</p>
        <button onClick={() => navigate(-1)} className="btn btn-primary">← {t('back')}</button>
      </div>
    );
  }

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <ProfileHeader person={person} navigate={navigate} />

      <div className="page-container" style={styles.container}>
        <div className="constituency-grid" style={styles.grid}>
          <DossierColumn person={person} />
          <PerformanceColumn sortedCandidates={person.sortedCandidates} />
        </div>
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

function ProfileHeader({ person, navigate }: { person: PersonDetailData; navigate: NavigateFunction }) {
  return (
    <div style={styles.headerRoot}>
      <div style={styles.headerContent}>
        <div style={styles.headerLeft}>
          <button onClick={() => navigate(-1)} style={styles.backBtn}>← BACK</button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={styles.breadcrumb}>
              Person Profile / {PersonService.formatGender(person.gender ?? undefined)}
            </span>
            <h1 style={styles.pageTitle}>{person.name}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {person.education && (
            <span style={styles.educationBadge}>{person.education}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function DossierColumn({ person }: { person: PersonDetailData }) {
  const bio = PersonService.formatBiography(person);
  const wikiUrl = typeof person.metadata?.wikipedia_url === 'string' ? person.metadata.wikipedia_url : undefined;

  return (
    <aside style={styles.leftCol}>
      {/* Biography Card: hidden when there is no bio (kept for the Wikipedia link alone) */}
      {(bio || wikiUrl) && (
        <div className="card-elevated" style={styles.cardPadding}>
          <h3 className="card-title-tiny" style={styles.bioTitle}>BIOGRAPHY & PROFILE</h3>
          {bio && <p className="bio-text" style={styles.bioText}>{bio}</p>}
          {wikiUrl && (
            <a href={wikiUrl} target="_blank" rel="noopener noreferrer" className="link-wiki" style={styles.wikiLink}>
              Read full profile on Wikipedia ↗
            </a>
          )}
        </div>
      )}

      {/* Personal Details Card */}
      <div className="card-elevated" style={styles.cardPadding}>
        <h3 className="card-title-tiny" style={{ marginBottom: 'var(--space-4)' }}>PERSONAL DATA</h3>
        <div className="details-list" style={styles.detailsList}>
          {person.date_of_birth && (
            <DetailItem label="Date of Birth" value={PersonService.formatBirthDate(person.date_of_birth)} />
          )}
          {person.education && (
            <DetailItem label="Education Qualification" value={person.education} />
          )}
          {person.gender && (
            <DetailItem label="Gender Identity" value={PersonService.formatGender(person.gender ?? undefined)} />
          )}
        </div>
      </div>
    </aside>
  );
}

function DetailItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="detail-item" style={styles.detailItem}>
      <span className="detail-label">{label}</span>
      <span className="detail-value" style={{ fontSize: '14px' }}>{value}</span>
    </div>
  );
}

function PerformanceColumn({ sortedCandidates }: { sortedCandidates: PersonCandidate[] }) {
  return (
    <div style={styles.rightCol}>
      <div className="card-elevated">
        <div style={styles.tableHeader}>
          <h3 style={styles.tableTitle}>Performance History</h3>
          <span style={styles.tableCount}>{sortedCandidates.length} CONTESTS</span>
        </div>
        
        <div style={{ width: '100%', overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Election / Year</th>
                <th>Constituency</th>
                <th style={{ textAlign: 'right' }}>Votes</th>
                <th style={{ textAlign: 'center' }}>Result</th>
                <th style={{ textAlign: 'right' }}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {sortedCandidates.map((c) => (
                <PerformanceRow key={c.id} c={c} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={styles.hintBox}>
        Performance data is cross-referenced from official ECI records.
      </div>
    </div>
  );
}

function PerformanceRow({ c }: { c: PersonCandidate }) {
  const isWinner = c.status === 'WON' || c.status === 'LEADING';
  return (
    <tr className={isWinner ? 'winner-row' : ''} style={{ transition: 'background 0.2s' }}>
      <td>
        <div style={styles.yearText}>{c.election_year || '—'}</div>
        <div style={styles.electionName}>{c.election_name}</div>
      </td>
      <td>
        <Link to={`/election/${c.election_id}/constituency/${c.const_id}`} style={styles.constLink}>
          {c.constituency_name || c.const_id.replace(/_/g, ' ')}
        </Link>
        <div style={styles.partyCell}>
          <span style={{ ...styles.partyDot, background: c.party_color || '#6b7280' }} />
          {c.party_id}
        </div>
      </td>
      <td style={styles.voteCell}>{c.votes?.toLocaleString() || '—'}</td>
      <td style={{ textAlign: 'center' }}><StatusBadge status={c.status || 'TRAILING'} /></td>
      <td style={{ ...styles.marginCell, color: isWinner ? 'var(--success)' : 'inherit' }}>
        {(c.margin ?? 0) > 0 ? `+${c.margin?.toLocaleString()}` : (c.margin ?? 0) < 0 ? c.margin?.toLocaleString() : '—'}
      </td>
    </tr>
  );
}

// --- Styles ---

const styles: Record<string, CSSProperties> = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh' },
  container: { padding: 'var(--space-6)', height: 'auto', overflow: 'visible', maxWidth: 'none' },
  headerRoot: { 
    background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', 
    padding: 'var(--space-2) var(--space-6)', position: 'sticky' as const, top: 0, zIndex: 100 
  },
  headerContent: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 'var(--space-4)' },
  backBtn: { 
    background: 'var(--bg-secondary)', border: '1px solid var(--border)', 
    borderRadius: 'var(--radius-sm)', padding: '4px 10px', fontSize: '11px', 
    fontWeight: 700, cursor: 'pointer', color: 'var(--text-secondary)' 
  },
  breadcrumb: { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  pageTitle: { fontSize: 'var(--text-xl)', fontWeight: 800, margin: 0, lineHeight: 1 },
  educationBadge: { 
    fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', 
    background: 'var(--bg-secondary)', padding: '4px 10px', 
    borderRadius: 'var(--radius-full)', border: '1px solid var(--border)' 
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 700px', gap: 'var(--space-6)', alignItems: 'start' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', minWidth: 0 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 'var(--space-6)', width: '700px', flexShrink: 0 },
  cardPadding: { padding: 'var(--space-6)' },
  bioTitle: { color: 'var(--accent)', marginBottom: 'var(--space-4)' },
  bioText: { fontSize: '15px', lineHeight: 1.8, color: 'var(--text-primary)', margin: 0, maxWidth: '900px' },
  wikiLink: { marginTop: 'var(--space-4)', display: 'inline-flex' },
  detailsList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-6)' },
  detailItem: { borderBottom: '1px solid var(--bg-secondary)', paddingBottom: '10px' },
  tableHeader: { 
    padding: '16px 20px', borderBottom: '1px solid var(--border)', 
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' 
  },
  tableTitle: { 
    fontSize: '13px', fontWeight: 900, margin: 0, 
    textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: 'var(--text-secondary)' 
  },
  tableCount: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800 },
  yearText: { fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)' },
  electionName: { fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.02em' },
  constLink: { fontWeight: 700, color: 'var(--accent)', fontSize: '12px', display: 'block' },
  partyCell: { display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' },
  partyDot: { width: 6, height: 6, borderRadius: '50%' },
  voteCell: { textAlign: 'right' as const, fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '12px' },
  marginCell: { textAlign: 'right' as const, fontWeight: 800, fontFamily: 'var(--font-mono)', fontSize: '12px' },
  hintBox: { textAlign: 'center' as const, padding: 'var(--space-4)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-muted)', fontSize: '11px', fontWeight: 600 },
};
