import React from 'react';
import { useResultOverride } from '../hooks/useResultOverride';
import AdminPageHeader from '../components/common/AdminPageHeader';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import type { Election } from '../types';

/**
 * PAGE: Result Override Console (MVC: View)
 * Command center for manual result corrections during live events.
 */
export default function ResultOverride() {
  const manager = useResultOverride();
  const { liveElections, loading, form, setForm, applyOverride } = manager;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await applyOverride();
  };

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader 
        title="Result Override Console"
        subtitle="Manual intervention for live counting inaccuracies"
      />

      <div className="page-container" style={styles.container}>
        <div className="card-elevated" style={{ padding: 0 }}>
          <div style={styles.formHeader}>
            <h3 style={styles.formTitle}>EMERGENCY OVERRIDE FORM</h3>
          </div>
          <ErrorBoundary>
            <OverrideForm 
              form={form} 
              setForm={setForm} 
              liveElections={liveElections} 
              loading={loading} 
              onSubmit={onSubmit} 
            />
          </ErrorBoundary>
        </div>

        <ErrorBoundary>
          <ProtocolSidebar liveElections={liveElections} />
        </ErrorBoundary>
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

interface FormProps {
  form: any;
  setForm: (f: any) => void;
  liveElections: Election[];
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

function OverrideForm({ form, setForm, liveElections, loading, onSubmit }: FormProps) {
  const updateField = (patch: any) => setForm({ ...form, ...patch });

  return (
    <form onSubmit={onSubmit} style={{ padding: '24px' }}>
      <div className="form-group">
        <label className="form-label" style={styles.labelSmall}>SELECT LIVE ELECTION CYCLE *</label>
        <select 
          className="form-select" 
          value={form.election_id} 
          onChange={(e) => updateField({ election_id: e.target.value })} 
          required 
          style={styles.inputHeight}
        >
          <option value="">Select Election</option>
          {liveElections.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.year})</option>)}
        </select>
      </div>

      <div className="form-grid form-grid-2" style={{ marginTop: 'var(--space-4)' }}>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>CONSTITUENCY ID (SLUG)</label>
          <input className="form-input" value={form.const_id} onChange={(e) => updateField({ const_id: e.target.value })} required placeholder="e.g. VARANASI" style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>CANDIDATE / RESULT UUID</label>
          <input className="form-input" value={form.candidate_id} onChange={(e) => updateField({ candidate_id: e.target.value })} required placeholder="Enter UUID" style={{ ...styles.inputHeight, fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      <div className="form-grid form-grid-3" style={{ marginTop: 'var(--space-4)' }}>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>VOTES POLLED</label>
          <input type="number" className="form-input" value={form.votes} onChange={(e) => updateField({ votes: parseInt(e.target.value) || 0 })} min={0} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>WIN MARGIN</label>
          <input type="number" className="form-input" value={form.margin} onChange={(e) => updateField({ margin: parseInt(e.target.value) || 0 })} min={0} style={styles.inputHeight} />
        </div>
        <div className="form-group">
          <label className="form-label" style={styles.labelSmall}>LIVE STATUS</label>
          <select className="form-select" value={form.status} onChange={(e) => updateField({ status: e.target.value })} style={styles.inputHeight}>
            <option value="LEADING">LEADING</option>
            <option value="WON">WON</option>
            <option value="TRAILING">TRAILING</option>
            <option value="LOST">LOST</option>
          </select>
        </div>
      </div>

      <div className="form-group" style={{ marginTop: 'var(--space-4)' }}>
        <label className="form-label" style={styles.labelSmall}>AUDIT REASON *</label>
        <textarea
          className="form-textarea"
          value={form.reason}
          onChange={(e) => updateField({ reason: e.target.value })}
          required
          rows={3}
          placeholder="Briefly explain why this override is being applied..."
          style={styles.textarea}
        />
      </div>

      <div className="form-actions" style={styles.formActions}>
        <button type="submit" disabled={loading} className="btn btn-primary" style={styles.submitBtn}>
          {loading ? 'BROADCASTING...' : 'APPLY & BROADCAST OVERRIDE'}
        </button>
      </div>
    </form>
  );
}

function ProtocolSidebar({ liveElections }: { liveElections: Election[] }) {
  return (
    <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div className="card-elevated" style={styles.sideCardPadding}>
        <h3 className="card-title-tiny">Override Protocol</h3>
        <div style={styles.protocolText}>
          <p>Manual overrides take immediate precedence over automated scrapers and API integrations.</p>
          <ul style={styles.protocolList}>
            <li>Update is committed to database</li>
            <li><strong>Redis cache is purged</strong></li>
            <li>Updates pushed to <strong>Live SSE Stream</strong></li>
            <li>Immutable <strong>Audit Entry</strong> is created</li>
          </ul>
        </div>
      </div>

      {liveElections.length === 0 && (
        <div className="card-elevated" style={styles.warningCard}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⚠️</div>
          <h4 style={styles.warningTitle}>NO LIVE ELECTIONS</h4>
          <p style={{ fontSize: 12, margin: 0 }}>Overrides are disabled when no active counting cycle is detected.</p>
        </div>
      )}
    </aside>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '60px' },
  container: { padding: 'var(--space-6)', display: 'grid', gridTemplateColumns: '1fr 400px', gap: 'var(--space-6)', maxWidth: '1400px', margin: '0 auto' },
  formHeader: { padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' },
  formTitle: { fontSize: '12px', fontWeight: 900, margin: 0 },
  labelSmall: { fontSize: '9px' },
  inputHeight: { height: 36 },
  textarea: { fontSize: '13px', lineHeight: 1.6, padding: '12px' },
  formActions: { marginTop: 'var(--space-6)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' },
  submitBtn: { height: 40, padding: '0 32px', background: 'var(--danger)', color: '#fff', fontSize: '11px', fontWeight: 800, borderColor: 'var(--danger)' },
  sideCardPadding: { padding: 'var(--space-5)' },
  protocolText: { fontSize: '13px', lineHeight: 1.7, color: 'var(--text-secondary)' },
  protocolList: { paddingLeft: 20, marginTop: 12, display: 'grid', gap: 8 },
  warningCard: { padding: '32px', textAlign: 'center' as const, background: 'var(--warning-soft)', border: '1px dashed var(--warning-text)', color: 'var(--warning-text)' },
  warningTitle: { fontSize: 14, fontWeight: 800, margin: 0 },
};
