import { useState } from 'react';
import { useParams, useNavigate, NavigateFunction } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConstituencyEditor } from '../hooks/useConstituencyEditor';
import { bulkUpdateAiStatus } from '../services/ai.service';
import { useToast } from '../context/ToastContext';
import Spinner from '../components/atoms/Spinner';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import type { Constituency } from '../types';

const TAG_PALETTE = [
  'yadav_dominated', 'bhumihar_dominated', 'rajput_dominated', 'kurmi_belt', 'ebc_majority', 'dalit_stronghold',
  'muslim_majority', 'muslim_significant', 'mixed_religious',
  'urban', 'semi_urban', 'rural', 'border', 'flood_prone', 'naxal_affected',
];

const AI_STATUS_CONFIG: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: 'Pending', bg: 'var(--bg-secondary)', color: 'var(--text-muted)' },
  pre_poll: { label: 'Pre-Poll', bg: '#ede9fe', color: '#5b21b6' },
  generated: { label: 'Generated', bg: 'var(--warning-soft)', color: 'var(--warning-text)' },
  reviewed: { label: 'Reviewed', bg: 'var(--accent-soft)', color: 'var(--accent)' },
  published: { label: 'Published', bg: 'var(--success-soft)', color: 'var(--success-text)' },
};

/**
 * PAGE: Constituency Editor (MVC: View)
 * Integrated workspace for AI profiling and demographic management.
 */
export default function ConstituencyEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { toast } = useToast();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');

  const editor = useConstituencyEditor(id);
  const { loading, constituency } = editor;

  if (loading) return <Spinner label="Loading constituency dossier..." />;
  if (!constituency) return <div style={{ padding: 40, textAlign: 'center' }}>Constituency not found.</div>;

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <ErrorBoundary>
        <EditorHeader editor={editor} navigate={navigate} toast={toast} />
      </ErrorBoundary>

      <div style={styles.mainGrid}>
        {/* Main Content: Logic Workspace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <ErrorBoundary>
            <BriefingWorkspace 
              editBriefing={editor.editBriefing}
              setEditBriefing={editor.setEditBriefing}
              editIssues={editor.editIssues}
              setEditIssues={editor.setEditIssues}
              markDirty={editor.markDirty}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <DemographicsForm 
              editDemographics={editor.editDemographics}
              setEditDemographics={editor.setEditDemographics}
              markDirty={editor.markDirty}
            />
          </ErrorBoundary>
        </div>

        {/* Sidebar: Admin & Metadata */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          <ErrorBoundary>
            <AdminContextCard 
              adminInfo={editor.adminInfo}
              setAdminInfo={editor.setAdminInfo}
              districts={editor.districts}
              regions={editor.regions}
              markDirty={editor.markDirty}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <TagsCard 
              constituency={constituency}
              addTag={editor.addTag}
              removeTag={editor.removeTag}
              canWrite={canWrite} 
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <HistoryCard constituency={constituency} />
          </ErrorBoundary>
        </aside>
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

interface EditorHeaderProps {
  editor: ReturnType<typeof useConstituencyEditor>;
  navigate: NavigateFunction;
  toast: (msg: string, type?: 'success' | 'error') => void;
}

function EditorHeader({ editor, navigate, toast }: EditorHeaderProps) {
  const { constituency, election, isDirty, saving, handleSave } = editor;
  if (!constituency) return null;
  
  const aiStatus = constituency.analysis?.ai_status || 'pending';

  const onStatusChange = async (status: string) => {
    try {
      await bulkUpdateAiStatus([constituency.analysis!.id], status);
      toast(`Status changed to ${status}`);
      editor.refresh();
    } catch { toast('Status update failed', 'error'); }
  };

  return (
    <div style={styles.headerRoot}>
      <div style={styles.headerContent}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button onClick={() => navigate(`/constituencies/${constituency.id}`)} className="btn btn-sm btn-outline" style={styles.backBtn}>&larr; BACK</button>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={styles.headerLabel}>{election?.name} / {election?.year}</span>
            <h1 style={styles.headerTitle}>{constituency.name}</h1>
          </div>
          <span className={`badge badge-${constituency.type.toLowerCase()}`} style={{ fontSize: '10px' }}>{constituency.type}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={styles.statusPickerBox}>
            <span style={styles.statusPickerLabel}>AI STATUS</span>
            <select 
              className="form-select" 
              value={aiStatus} 
              onChange={(e) => onStatusChange(e.target.value)}
              style={styles.statusSelect}
            >
              {Object.keys(AI_STATUS_CONFIG).map(s => (
                <option key={s} value={s}>{AI_STATUS_CONFIG[s].label.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <button 
            onClick={handleSave} 
            disabled={!isDirty || saving} 
            className="btn btn-primary" 
            style={styles.saveBtn}
          >
            {saving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface BriefingProps {
  editBriefing: string;
  setEditBriefing: (v: string) => void;
  editIssues: string[];
  setEditIssues: (v: string[]) => void;
  markDirty: () => void;
}

function BriefingWorkspace({ editBriefing, setEditBriefing, editIssues, setEditIssues, markDirty }: BriefingProps) {
  const [newIssue, setNewIssue] = useState('');

  return (
    <div className="card-elevated" style={styles.cardPadding}>
      <h3 className="card-title-tiny" style={{ color: 'var(--accent)' }}>AI Strategic Briefing</h3>
      <textarea
        className="form-textarea"
        value={editBriefing}
        onChange={(e) => { setEditBriefing(e.target.value); markDirty(); }}
        rows={10}
        style={styles.briefingTextarea}
        placeholder="Strategic outlook and constituency narrative..."
      />

      <div style={{ marginTop: 'var(--space-6)' }}>
        <h3 className="card-title-tiny">Key Battleground Issues</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {editIssues.map((issue, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input 
                className="form-input" 
                value={issue} 
                onChange={(e) => {
                  const next = [...editIssues]; next[i] = e.target.value; 
                  setEditIssues(next); markDirty();
                }} 
                style={styles.issueInput} 
              />
              <button 
                className="btn btn-sm btn-danger" 
                onClick={() => { setEditIssues(editIssues.filter((_, j) => j !== i)); markDirty(); }}
              >
                &times;
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <input 
              className="form-input" 
              placeholder="New battleground issue..." 
              value={newIssue} 
              onChange={e => setNewIssue(e.target.value)} 
              style={styles.issueInput} 
            />
            <button 
              className="btn btn-sm btn-outline" 
              onClick={() => { if (newIssue.trim()) { setEditIssues([...editIssues, newIssue.trim()]); setNewIssue(''); markDirty(); } }}
            >
              ADD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DemographicsProps {
  editDemographics: any;
  setEditDemographics: (v: any) => void;
  markDirty: () => void;
}

function DemographicsForm({ editDemographics, setEditDemographics, markDirty }: DemographicsProps) {
  const updateDemo = (patch: any) => {
    setEditDemographics({ ...editDemographics, ...patch });
    markDirty();
  };

  return (
    <div className="card-elevated" style={styles.cardPadding}>
      <h3 className="card-title-tiny">Hard Demographics</h3>
      <div style={styles.demoGrid}>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>POPULATION</label>
          <input className="form-input" type="number" value={editDemographics.population} onChange={e => updateDemo({ population: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>LITERACY %</label>
          <input className="form-input" type="number" step="0.1" value={editDemographics.literacy_pct} onChange={e => updateDemo({ literacy_pct: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>URBAN %</label>
          <input className="form-input" type="number" step="0.1" value={editDemographics.urban_pct} onChange={e => updateDemo({ urban_pct: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>SC/ST %</label>
          <input className="form-input" type="number" step="0.1" value={editDemographics.sc_st_pct} onChange={e => updateDemo({ sc_st_pct: e.target.value })} />
        </div>
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>DOMINANT CASTES</label>
          <input className="form-input" value={editDemographics.dominant_castes} onChange={e => updateDemo({ dominant_castes: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>RELIGIOUS BREAKDOWN</label>
          <input className="form-input" value={editDemographics.religions} onChange={e => updateDemo({ religions: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

interface AdminContextProps {
  adminInfo: any;
  setAdminInfo: (v: any) => void;
  districts: any[];
  regions: any[];
  markDirty: () => void;
}

function AdminContextCard({ adminInfo, setAdminInfo, districts, regions, markDirty }: AdminContextProps) {
  const updateAdmin = (patch: any) => {
    setAdminInfo({ ...adminInfo, ...patch });
    markDirty();
  };

  return (
    <div className="card-elevated" style={styles.sideCardPadding}>
      <h3 className="card-title-tiny">Administrative Context</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>DISTRICT</label>
          <select className="form-select" value={adminInfo.district_id} onChange={e => updateAdmin({ district_id: e.target.value })}>
            <option value="">Select District</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>REGION</label>
          <select className="form-select" value={adminInfo.region_id} onChange={e => updateAdmin({ region_id: e.target.value })}>
            <option value="">Select Region</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>CONST #</label>
            <input className="form-input" value={adminInfo.const_no} onChange={e => updateAdmin({ const_no: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>PHASE</label>
            <input className="form-input" value={adminInfo.phase} onChange={e => updateAdmin({ phase: e.target.value })} />
          </div>
        </div>
      </div>
    </div>
  );
}

interface TagsCardProps {
  constituency: Constituency;
  addTag: (t: string) => void;
  removeTag: (t: string) => void;
  canWrite: boolean;
}

function TagsCard({ constituency, addTag, removeTag, canWrite }: TagsCardProps) {
  const [tagInput, setTagInput] = useState('');
  const tags = (constituency.metadata?.tags as string[]) || [];

  return (
    <div className="card-elevated" style={styles.sideCardPadding}>
      <h3 className="card-title-tiny">Dossier Tags</h3>
      <div style={styles.tagCloud}>
        {tags.map(tag => (
          <span key={tag} className="badge badge-neutral" style={styles.tagBadge}>
            {tag.toUpperCase().replace(/_/g, ' ')}
            {canWrite && <button onClick={() => removeTag(tag)} style={styles.tagX}>&times;</button>}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input 
          className="form-input" 
          list="tags-list" 
          placeholder="Quick add..." 
          value={tagInput} 
          onChange={e => setTagInput(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && (addTag(tagInput), setTagInput(''))} 
          style={{ fontSize: '11px', height: 32 }} 
        />
        <datalist id="tags-list">
          {TAG_PALETTE.map(t => <option key={t} value={t} />)}
        </datalist>
        <button className="btn btn-sm btn-primary" onClick={() => { addTag(tagInput); setTagInput(''); }}>ADD</button>
      </div>
    </div>
  );
}

function HistoryCard({ constituency }: { constituency: Constituency }) {
  const inc = (constituency.analysis?.incumbency || {}) as { seat_history?: any[] };
  if (!inc.seat_history) return null;

  return (
    <div className="card-elevated" style={styles.sideCardPadding}>
      <h3 className="card-title-tiny">Historical Records</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {inc.seat_history.map((h, i) => (
          <div key={i} style={{ ...styles.historyRow, borderBottom: i < inc.seat_history!.length - 1 ? '1px solid var(--bg-secondary)' : 'none' }}>
            <div style={styles.historyYear}>{String(h.year).slice(-2)}</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 800 }}>{h.party}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{h.candidate}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 80 },
  headerRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: 'var(--space-4) var(--space-6)', position: 'sticky' as const, top: 0, zIndex: 100 },
  headerContent: { maxWidth: '1400px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const },
  headerTitle: { fontSize: 'var(--text-xl)', fontWeight: 900, margin: 0, lineHeight: 1 },
  backBtn: { height: 32, fontSize: '10px', fontWeight: 800 },
  statusPickerBox: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' },
  statusPickerLabel: { fontSize: '9px', fontWeight: 800, color: 'var(--text-muted)' },
  statusSelect: { height: 24, fontSize: 10, padding: '0 4px', fontWeight: 700 },
  saveBtn: { height: 34, padding: '0 24px', fontSize: '11px', fontWeight: 800 },
  mainGrid: { maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 380px', gap: 'var(--space-6)' },
  cardPadding: { padding: 'var(--space-6)' },
  sideCardPadding: { padding: 'var(--space-5)' },
  briefingTextarea: { width: '100%', fontSize: '14px', lineHeight: 1.7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' },
  issueInput: { flex: 1, height: 34, fontSize: '13px' },
  demoGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' },
  labelSmall: { fontSize: '9px' },
  tagCloud: { display: 'flex', gap: 6, flexWrap: 'wrap' as const, marginBottom: 16 },
  tagBadge: { fontSize: '10px', fontWeight: 700, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 6 },
  tagX: { border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 },
  historyRow: { display: 'flex', gap: 12, alignItems: 'center', paddingBottom: 8 },
  historyYear: { width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 900, color: 'var(--text-muted)' },
};
