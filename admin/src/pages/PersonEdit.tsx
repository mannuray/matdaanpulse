import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePersonEdit } from '../hooks/usePersonEdit';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import type { PersonWithCandidates, PersonWithStats } from '../types';

/**
 * PAGE: Person Editor (MVC: View)
 * Master registry workspace for managing candidate reconciliation.
 */
export default function PersonEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('SUPER_ADMIN');

  const editor = usePersonEdit(id);
  const { person, loading, saving, form, setForm } = editor;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await editor.handleSave();
    if (success) navigate(`/persons/${id}`);
  };

  if (loading) return <Spinner label="Accessing master registry..." />;
  if (!person) return <div style={{ padding: 40, textAlign: 'center' }}>Record not found.</div>;

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <ErrorBoundary>
        <Header 
          name={person.name} 
          isDirty={false} // Hook doesn't expose dirty yet, but placeholder for pattern
          saving={saving} 
          onSubmit={onSubmit}
          navigate={navigate}
          id={person.id}
        />
      </ErrorBoundary>

      <div style={styles.mainGrid}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <ErrorBoundary>
            <ProfileForm form={form} setForm={setForm} />
          </ErrorBoundary>
        </div>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <ErrorBoundary>
            <HistoryCard person={person} />
          </ErrorBoundary>

          <ErrorBoundary>
            <MergeSidebar 
              mergeSearch={editor.mergeSearch}
              setMergeSearch={editor.setMergeSearch}
              mergeResults={editor.mergeResults}
              merging={editor.merging}
              onMerge={editor.handleMerge}
              isSuperAdmin={isSuperAdmin}
            />
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

interface HeaderProps {
  name: string;
  isDirty: boolean;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  navigate: (path: string) => void;
  id: string;
}

function Header({ name, saving, onSubmit, navigate, id }: HeaderProps) {
  return (
    <div style={styles.headerRoot}>
      <div style={styles.headerContent}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button onClick={() => navigate(`/persons/${id}`)} className="btn btn-sm btn-outline" style={styles.backBtn}>&larr; BACK</button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={styles.headerLabel}>Master Registry Editor</span>
            <h1 style={styles.headerTitle}>{name}</h1>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onSubmit} disabled={saving} className="btn btn-primary" style={styles.saveBtn}>
            {saving ? 'SAVING...' : 'SAVE MASTER RECORD'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface FormProps {
  form: any;
  setForm: (f: any) => void;
}

function ProfileForm({ form, setForm }: FormProps) {
  const update = (patch: any) => setForm({ ...form, ...patch });

  return (
    <div className="card-elevated" style={styles.cardPadding}>
      <h3 className="card-title-tiny">Profile Information</h3>
      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>FULL LEGAL NAME *</label>
          <input className="form-input" value={form.name} onChange={e => update({ name: e.target.value })} required style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>DATE OF BIRTH</label>
          <input type="date" className="form-input" value={form.date_of_birth} onChange={e => update({ date_of_birth: e.target.value })} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>EDUCATION QUALIFICATION</label>
          <input className="form-input" value={form.education} onChange={e => update({ education: e.target.value })} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>GENDER IDENTITY</label>
          <select className="form-select" value={form.gender} onChange={e => update({ gender: e.target.value })} style={styles.inputHeight}>
            <option value="">Not Specified</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
        <label className="form-label" style={styles.labelSmall}>WIKIPEDIA URL</label>
        <input className="form-input" value={form.wikipedia_url} onChange={e => update({ wikipedia_url: e.target.value })} placeholder="https://en.wikipedia.org/wiki/..." style={styles.inputHeight} />
      </div>
      <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
        <label className="form-label" style={styles.labelSmall}>MASTER PHOTO URL</label>
        <input className="form-input" value={form.photo_url} onChange={e => update({ photo_url: e.target.value })} placeholder="https://..." style={styles.inputHeight} />
      </div>
      <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
        <label className="form-label" style={styles.labelSmall}>BIOGRAPHY</label>
        <textarea className="form-textarea" value={form.bio} onChange={e => update({ bio: e.target.value })} rows={6} style={{ ...styles.bioText, width: '100%' }} />
      </div>
    </div>
  );
}

function HistoryCard({ person }: { person: PersonWithCandidates }) {
  return (
    <div className="card-elevated" style={{ padding: 'var(--space-5)' }}>
      <h3 className="card-title-tiny">Election History</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {person.candidates?.map((c: any) => {
          const constName = c.constituency_name || c.constituency?.name || c.const_id;
          const electionName = c.election_name || c.election?.name || c.election_id;
          const partyId = c.party_id || c.party?.id || 'IND';
          const year = c.election_year || c.election?.year;
          return (
            <div key={c.id} style={styles.historyRow}>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 800 }}>{constName}</div>
                <div style={styles.historyMetaText}>{electionName}{year ? ` (${year})` : ''} &middot; {partyId}</div>
              </div>
              {c.is_incumbent && <span className="badge badge-editor" style={{ fontSize: '8px' }}>INC</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface MergeProps {
  mergeSearch: string;
  setMergeSearch: (q: string) => void;
  mergeResults: PersonWithStats[];
  merging: boolean;
  onMerge: (id: string, name: string) => void;
  isSuperAdmin: boolean;
}

function MergeSidebar({ mergeSearch, setMergeSearch, mergeResults, merging, onMerge, isSuperAdmin }: MergeProps) {
  if (!isSuperAdmin) return null;

  return (
    <div className="card-elevated" style={{ padding: 'var(--space-5)', borderLeft: '4px solid var(--danger)' }}>
      <h3 className="card-title-tiny" style={{ color: 'var(--danger)' }}>Registry Deduplication</h3>
      <p style={styles.mergeText}>Search for a duplicate record to merge into this one. This action permanently transfers all candidates and deletes the source.</p>
      <input 
        className="form-input" 
        placeholder="Search duplicates..." 
        value={mergeSearch} 
        onChange={e => setMergeSearch(e.target.value)} 
        style={styles.mergeInput}
      />
      {mergeResults.length > 0 && (
        <div style={styles.mergeResultsBox}>
          {mergeResults.map(p => (
            <div key={p.id} style={styles.mergeItem}>
              <div style={{ fontSize: '11px' }}>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                <div style={{ color: 'var(--text-muted)' }}>{p.candidate_count} APPEARANCES</div>
              </div>
              <button disabled={merging} onClick={() => onMerge(p.id, p.name)} className="btn btn-xs" style={styles.mergeBtn}>MERGE</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '80px' },
  headerRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: 'var(--space-4) var(--space-6)', position: 'sticky' as const, top: 0, zIndex: 100 },
  headerContent: { maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const },
  headerTitle: { fontSize: 'var(--text-xl)', fontWeight: 900, margin: 0, lineHeight: 1 },
  backBtn: { height: 32, fontSize: '10px', fontWeight: 800 },
  saveBtn: { height: 34, padding: '0 24px', fontSize: '11px', fontWeight: 800 },
  mainGrid: { maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 400px', gap: 'var(--space-6)' },
  cardPadding: { padding: 'var(--space-6)' },
  labelSmall: { fontSize: '9px' },
  inputHeight: { height: 36 },
  bioText: { fontSize: '14px', lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' as const },
  historyRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-secondary)', paddingBottom: 8 },
  historyMetaText: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 },
  mergeText: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 },
  mergeInput: { height: 34, fontSize: '11px', fontWeight: 600 },
  mergeResultsBox: { marginTop: 12, display: 'flex', flexDirection: 'column' as const, gap: 8 },
  mergeItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8, background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' },
  mergeBtn: { color: 'var(--danger)', borderColor: 'var(--danger)', fontSize: '10px', fontWeight: 800 }
};
