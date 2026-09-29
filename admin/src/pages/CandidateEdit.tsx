import React from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCandidateEdit } from '../hooks/useCandidateEdit';
import { useAuth } from '../context/AuthContext';
import AdminPageHeader from '../components/common/AdminPageHeader';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import type { Candidate, Party, PersonWithStats } from '../types';

/**
 * PAGE: Candidate Editor (MVC: View)
 * Detailed profile management and master registry linking.
 */
export default function CandidateEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editor = useCandidateEdit(id);
  const { hasRole } = useAuth();
  const canEnrich = hasRole('SUPER_ADMIN'); // backend enrich endpoint is SUPER_ADMIN-only
  const { candidate, loading, saving, handleSave, form } = editor;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await handleSave();
    if (success) navigate(`/candidates/${id}`);
  };

  if (loading) return <Spinner label="Loading profile..." />;
  if (!candidate) return <div style={styles.notFound}>Not found.</div>;

  return (
    <form onSubmit={onSubmit} className="fade-in" style={styles.pageRoot}>
      <ErrorBoundary>
        <AdminPageHeader 
          title={candidate.name}
          breadcrumb="Candidate Editor"
          onBack={() => navigate(`/candidates/${id}`)}
          actions={
            <div style={{ display: 'flex', gap: 12 }}>
              {canEnrich && <button type="button" onClick={editor.runEnrichment} disabled={editor.enriching} className="btn" style={styles.enrichBtn}>AI ENRICH</button>}
              <button type="submit" disabled={saving} className="btn btn-primary" style={styles.saveBtn}>SAVE CHANGES</button>
            </div>
          }
        />
      </ErrorBoundary>

      <div style={styles.mainGrid}>
        <div style={styles.leftCol}>
          <ErrorBoundary>
            <AffidavitForm 
              form={form} 
              setForm={editor.setForm} 
              parties={editor.parties} 
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <MediaForm form={form} setForm={editor.setForm} />
          </ErrorBoundary>
        </div>

        <div style={styles.rightCol}>
          <ErrorBoundary>
            <RegistryLinking 
              candidate={candidate}
              personSearch={editor.personSearch}
              setPersonSearch={editor.setPersonSearch}
              personResults={editor.personResults}
              isLinking={editor.isLinking}
              linkToPerson={editor.linkToPerson}
              createMasterRecord={editor.createMasterRecord}
              unlink={editor.unlink}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <ContextCard candidate={candidate} />
          </ErrorBoundary>
        </div>
      </div>
    </form>
  );
}

// --- Internal Sub-Components ---

// HeroHeader removed as redundant with AdminPageHeader, but we keep the visual elements needed elsewhere if any

interface AffidavitFormProps {
  form: any;
  setForm: (f: any) => void;
  parties: Party[];
}

function AffidavitForm({ form, setForm, parties }: AffidavitFormProps) {
  return (
    <div className="card-elevated" style={styles.cardPadding}>
      <h3 className="card-title-tiny">Affidavit Data</h3>
      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label className="form-label">Full Name *</label>
          <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label">Party Affiliation</label>
          <select className="form-input" value={form.party_id} onChange={e => setForm({...form, party_id: e.target.value})} style={styles.inputHeight}>
            <option value="">Independent</option>
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Age</label>
          <input className="form-input" type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label">Gender</label>
          <select className="form-input" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} style={styles.inputHeight}>
            <option value="">Not Specified</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Education</label>
          <input className="form-input" value={form.education} onChange={e => setForm({...form, education: e.target.value})} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label">Criminal Cases</label>
          <input className="form-input" type="number" value={form.criminal_cases} onChange={e => setForm({...form, criminal_cases: e.target.value})} style={styles.inputHeight} />
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
        <label className="form-label">Declared Assets</label>
        <input className="form-input" value={form.assets} onChange={e => setForm({...form, assets: e.target.value})} style={styles.inputHeight} />
      </div>
    </div>
  );
}

interface MediaFormProps {
  form: any;
  setForm: (f: any) => void;
}

function MediaForm({ form, setForm }: MediaFormProps) {
  return (
    <div className="card-elevated" style={styles.cardPadding}>
      <h3 className="card-title-tiny">Visual & Media</h3>
      <div className="form-group">
        <label className="form-label">Profile Image URL</label>
        <input className="form-input" value={form.photo_url} onChange={e => setForm({...form, photo_url: e.target.value})} placeholder="https://..." style={styles.inputHeight} />
      </div>
    </div>
  );
}

interface LinkingProps {
  candidate: Candidate;
  personSearch: string;
  setPersonSearch: (q: string) => void;
  personResults: PersonWithStats[];
  isLinking: boolean;
  linkToPerson: (id: string) => void;
  createMasterRecord: () => void;
  unlink: () => void;
}

function RegistryLinking({ 
  candidate, personSearch, setPersonSearch, personResults, isLinking, 
  linkToPerson, createMasterRecord, unlink 
}: LinkingProps) {
  return (
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to={`/persons/${candidate.person_id}`} className="btn btn-sm btn-outline" style={styles.wideBtn}>VIEW MASTER PROFILE</Link>
            <button type="button" onClick={unlink} style={styles.unlinkBtn}>UNLINK CANDIDATE</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={styles.unlinkedText}>Not linked to a master record.</div>
          <input className="form-input" style={styles.registrySearch} placeholder="SEARCH MASTER REGISTRY..." value={personSearch} onChange={(e) => setPersonSearch(e.target.value)} />
          {personResults.length > 0 && (
            <div style={styles.searchResults}>
              {personResults.map((p) => (
                <div key={p.id} style={styles.searchItem}>
                  <div style={{ fontSize: '11px' }}>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{p.candidate_count} RECORDS</div>
                  </div>
                  <button type="button" disabled={isLinking} onClick={() => linkToPerson(p.id)} className="btn btn-xs btn-primary">LINK</button>
                </div>
              ))}
            </div>
          )}
          <button type="button" onClick={createMasterRecord} disabled={isLinking} className="btn btn-sm btn-outline" style={styles.createBtn}>CREATE NEW MASTER RECORD</button>
        </div>
      )}
    </div>
  );
}

function ContextCard({ candidate }: { candidate: Candidate }) {
  return (
    <div className="card-elevated" style={styles.cardPaddingCompact}>
      <h3 className="card-title-tiny">Election Context</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', fontSize: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>ELECTION</span>
          <span style={{ fontWeight: 800 }}>{candidate.election?.year} {candidate.election?.type}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>CONSTITUENCY</span>
          <span style={{ fontWeight: 800 }}>{candidate.constituency?.name}</span>
        </div>
      </div>
    </div>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '60px' },
  notFound: { padding: 40, textAlign: 'center' as const },
  enrichBtn: { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, padding: '4px 12px' },
  saveBtn: { padding: '8px 24px', fontSize: '11px', fontWeight: 800 },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-6)', maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)' },
  leftCol: { display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-6)' },
  rightCol: { display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-6)' },
  cardPadding: { padding: 'var(--space-6)' },
  cardPaddingCompact: { padding: 'var(--space-5)' },
  inputHeight: { height: '36px', fontSize: '13px' },
  registryCard: { padding: 'var(--space-5)', background: 'var(--accent-soft)', border: '1px solid var(--accent-soft)' },
  linkedBox: { background: 'var(--bg-card)', padding: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  linkedHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  linkedAvatar: { width: 44, height: 44, borderRadius: '50%', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, border: '1px solid var(--border)', overflow: 'hidden' as const },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' as const },
  linkedName: { fontWeight: 800, color: 'var(--text-primary)', fontSize: '13px' },
  linkedLabel: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 },
  wideBtn: { width: '100%', fontSize: '10px', fontWeight: 700 },
  unlinkBtn: { color: 'var(--danger)', fontSize: '10px', fontWeight: 800, border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' },
  unlinkedText: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 },
  registrySearch: { fontSize: '11px', height: '32px', fontWeight: 600 },
  searchResults: { background: 'var(--bg-card)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' as const },
  searchItem: { padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  createBtn: { width: '100%', fontSize: '10px', fontWeight: 800, borderColor: 'var(--accent)', color: 'var(--accent)' },
};
