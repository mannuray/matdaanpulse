import { FieldError, FormErrorsContext } from '../components/common/FieldError';
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useElectionManager } from '../hooks/useElectionManager';
import Spinner from '../components/atoms/Spinner';
import type { Election, State } from '../types';

/**
 * PAGE: Election Manager (MVC: View)
 * Integrated registry for managing national and state election cycles.
 */
export default function ElectionManager() {
  const { hasRole } = useAuth();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');
  const canFinalize = hasRole('SUPER_ADMIN'); // backend finalize endpoint is SUPER_ADMIN-only
  const manager = useElectionManager();

  const { items: elections, loading, states, confirmFinalize, setConfirmFinalize } = manager;

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <ElectionHeader 
        canWrite={canWrite} 
        onAddClick={manager.startCreate} 
      />
      <ElectionFilterBar 
        search={manager.search} 
        handleSearch={manager.handleSearch} 
        filters={manager.filters} 
        updateFilters={manager.updateFilters} 
      />

      <div style={{ padding: 'var(--space-6)' }}>
        {manager.showForm && (
          <FormErrorsContext.Provider value={manager.fieldErrors}>
          <ElectionForm 
            form={manager.form} 
            setForm={manager.setForm} 
            states={states} 
            saving={manager.saving} 
            editId={manager.editId} 
            onCancel={manager.resetForm} 
            onSubmit={manager.handleSave} 
          />
          </FormErrorsContext.Provider>
        )}

        {loading && elections.length === 0 ? (
          <Spinner label="Accessing election registry..." />
        ) : (
          <div className="card-elevated" style={{ padding: 0 }}>
            <ElectionTable 
              elections={elections} 
              states={states} 
              canWrite={canWrite} 
              onEdit={manager.startEdit} 
              onGoLive={manager.goLive} 
              onFinalize={canFinalize ? (id: string) => setConfirmFinalize(id) : undefined} 
            />
          </div>
        )}
      </div>

      {confirmFinalize && (
        <FinalizeDialog 
          onConfirm={() => { manager.handleFinalize(confirmFinalize); setConfirmFinalize(null); }} 
          onCancel={() => setConfirmFinalize(null)} 
        />
      )}
    </div>
  );
}

// --- Internal Sub-Components ---

interface HeaderProps {
  canWrite: boolean;
  onAddClick: () => void;
}

function ElectionHeader({ canWrite, onAddClick }: HeaderProps) {
  return (
    <div style={styles.headerRoot}>
      <div style={styles.headerTop}>
        <div>
          <h1 style={styles.title}>Election Registry</h1>
          <div style={styles.subtitle}>Manage national and state assembly cycles</div>
        </div>
        {canWrite && (
          <button onClick={onAddClick} className="btn btn-primary" style={styles.addBtn}>
            + REGISTER NEW ELECTION
          </button>
        )}
      </div>
    </div>
  );
}

interface FilterBarProps {
  search: string;
  handleSearch: (val: string) => void;
  filters: { status: string; type: string };
  updateFilters: (f: any) => void;
}

function ElectionFilterBar({ search, handleSearch, filters, updateFilters }: FilterBarProps) {
  return (
    <div style={styles.filterBarRoot}>
      <div style={styles.filterContainer}>
        <input 
          className="form-input" 
          placeholder="SEARCH BY NAME..." 
          value={search} 
          onChange={e => handleSearch(e.target.value)} 
          style={styles.searchInput} 
        />
        <div style={styles.vDivider} />
        
        <div className="map-tabs" style={styles.tabsReset}>
          {([['', 'ALL'], ['LS', 'LOK SABHA'], ['VS', 'VIDHAN SABHA']] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => updateFilters({ type: val as any, stateId: null })}
              className={`map-tab ${filters.type === val ? 'active' : ''}`}
              style={styles.tabBtn}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={styles.vDivider} />
        
        <select 
          className="form-select" 
          value={filters.status} 
          onChange={e => updateFilters({ status: e.target.value })} 
          style={styles.statusSelect}
        >
          <option value="">ALL STATUS</option>
          <option value="Upcoming">UPCOMING</option>
          <option value="Live">LIVE</option>
          <option value="Finalized">FINALIZED</option>
        </select>
      </div>
    </div>
  );
}

interface FormProps {
  form: any;
  setForm: (f: any) => void;
  states: State[];
  saving: boolean;
  editId: string | null;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

function ElectionForm({ form, setForm, states, saving, editId, onCancel, onSubmit }: FormProps) {
  return (
    <div className="card-elevated" style={styles.formCard}>
      <div style={styles.formHeader}>
        <h3 style={styles.formTitle}>{editId ? 'MODIFY ELECTION' : 'NEW ELECTION REGISTRATION'}</h3>
        <button onClick={onCancel} style={styles.closeBtn}>&times;</button>
      </div>
      <form onSubmit={onSubmit} style={{ padding: '24px' }}>
        <div className="form-grid form-grid-3">
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>OFFICIAL NAME *</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required style={{ height: 34 }} />
            <FieldError name="name" />
          </div>
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>TYPE</label>
            <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value as any })} style={{ height: 34 }}>
              <option value="LS">Lok Sabha</option>
              <option value="VS">Vidhan Sabha</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>YEAR</label>
            <input type="number" className="form-input" value={form.year} onChange={e => setForm({ ...form, year: parseInt(e.target.value) || 0 })} style={{ height: 34 }} />
            <FieldError name="year" />
          </div>
        </div>
        <div className="form-grid form-grid-2" style={{ marginTop: 'var(--space-4)' }}>
          {form.type === 'VS' && (
            <div className="form-group">
              <label className="form-label" style={styles.labelSmall}>JURISDICTION (STATE)</label>
              <select className="form-select" value={form.state_id} onChange={e => setForm({ ...form, state_id: e.target.value })} style={{ height: 34 }}>
                <option value="">Select State</option>
                {states.map((s: State) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label" style={styles.labelSmall}>TENTATIVE NEXT DATE</label>
            <input type="date" className="form-input" value={form.tentative_next_date} onChange={e => setForm({ ...form, tentative_next_date: e.target.value })} style={{ height: 34 }} />
            <FieldError name="tentative_next_date" />
          </div>
        </div>
        <div className="form-actions" style={styles.formActions}>
          <button type="submit" disabled={saving} className="btn btn-primary" style={styles.submitBtn}>
            {saving ? 'PROCESSING...' : editId ? 'UPDATE ELECTION' : 'CREATE ELECTION'}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-outline" style={{ height: 36, fontSize: '11px' }}>CANCEL</button>
        </div>
      </form>
    </div>
  );
}

interface TableProps {
  elections: Election[];
  states: State[];
  canWrite: boolean;
  onEdit: (el: Election) => void;
  onGoLive: (id: string) => void;
  onFinalize?: (id: string) => void;
}

function ElectionTable({ elections, states, canWrite, onEdit, onGoLive, onFinalize }: TableProps) {
  const statusBadgeClass: Record<string, string> = {
    Upcoming: 'badge-upcoming', Live: 'badge-live', Finalized: 'badge-finalized',
  };

  return (
    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={styles.tableHeadRow}>
          <th style={styles.thLeft}>Election Cycle</th>
          <th style={styles.thLeft}>Type</th>
          <th style={styles.thLeft}>State</th>
          <th style={styles.thCenter}>Status</th>
          <th style={styles.thRight}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {elections.map((el: Election) => (
          <tr key={el.id} className="row-hover" style={styles.dataRow}>
            <td style={styles.td}>
              <div style={{ fontWeight: 800, fontSize: '14px' }}>{el.name}</div>
              <div style={styles.yearSub}>YEAR: {el.year}</div>
            </td>
            <td style={{ ...styles.td, fontSize: '12px', fontWeight: 600 }}>
              {el.type === 'LS' ? 'Lok Sabha' : 'Vidhan Sabha'}
            </td>
            <td style={{ ...styles.td, fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {el.state_id != null ? states.find((s: State) => s.id === el.state_id)?.name || '-' : 'National'}
            </td>
            <td style={styles.tdCenter}>
              <span className={`badge ${statusBadgeClass[el.status] || ''}`} style={styles.statusBadge}>
                {el.status.toUpperCase()}
              </span>
            </td>
            <td style={styles.tdRight}>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => onEdit(el)} className="btn btn-sm btn-outline" style={styles.actionBtn}>EDIT</button>
                {canWrite && el.status === 'Upcoming' && (
                  <button onClick={() => onGoLive(el.id)} className="btn btn-sm" style={styles.goLiveBtn}>GO LIVE</button>
                )}
                {canWrite && onFinalize && el.status === 'Live' && (
                  <button onClick={() => onFinalize(el.id)} className="btn btn-sm" style={styles.goLiveBtn}>FINALIZE</button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FinalizeDialog({ onConfirm, onCancel }: { onConfirm: () => void, onCancel: () => void }) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog card-elevated" onClick={(e) => e.stopPropagation()} style={styles.dialogRoot}>
        <h3 style={styles.dialogTitle}>Finalize Election?</h3>
        <p style={styles.dialogText}>This will archive live data, disable scraping and manual overrides. This action cannot be undone.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button onClick={onConfirm} className="btn btn-danger" style={{ fontWeight: 800 }}>YES, FINALIZE</button>
          <button onClick={onCancel} className="btn btn-outline">CANCEL</button>
        </div>
      </div>
    </div>
  );
}

// --- Styles ---

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '60px' },
  headerRoot: { 
    background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', 
    padding: 'var(--space-4) var(--space-6)', position: 'sticky' as const, top: 0, zIndex: 100 
  },
  headerTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' },
  title: { fontSize: 'var(--text-xl)', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' },
  subtitle: { fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em' },
  addBtn: { height: 34, padding: '0 20px', fontSize: '11px', fontWeight: 800 },
  filterBarRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '0 var(--space-6) var(--space-4) var(--space-6)' },
  filterContainer: { 
    flex: 1, display: 'flex', gap: '8px', background: 'var(--bg-secondary)', 
    padding: '4px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' 
  },
  searchInput: { flex: 1, height: 28, background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 600 },
  vDivider: { width: 1, height: 20, background: 'var(--border)', margin: '4px 0' },
  tabsReset: { padding: 0, background: 'none' },
  tabBtn: { fontSize: '10px', height: '24px', padding: '0 12px', fontWeight: 800 },
  statusSelect: { width: 140, height: 28, background: 'transparent', border: 'none', fontSize: '11px', fontWeight: 700 },
  formCard: { marginBottom: 'var(--space-6)', borderLeft: '4px solid var(--accent)' },
  formHeader: { padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  formTitle: { fontSize: '12px', fontWeight: 900, margin: 0 },
  closeBtn: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' },
  labelSmall: { fontSize: '9px' },
  formActions: { marginTop: 'var(--space-6)', borderTop: '1px solid var(--border)', paddingTop: 'var(--space-4)' },
  submitBtn: { padding: '0 32px', height: 36, fontSize: '11px', fontWeight: 800 },
  tableHeadRow: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  thLeft: { padding: '12px 16px', textAlign: 'left' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  thCenter: { padding: '12px 16px', textAlign: 'center' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  thRight: { padding: '12px 16px', textAlign: 'right' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, color: 'var(--text-muted)' },
  dataRow: { borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' },
  td: { padding: '12px 16px' },
  tdCenter: { padding: '12px 16px', textAlign: 'center' as const },
  tdRight: { padding: '12px 16px', textAlign: 'right' as const },
  yearSub: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 },
  statusBadge: { padding: '3px 10px', fontSize: '9px', fontWeight: 800, borderRadius: '4px' },
  actionBtn: { fontSize: '10px', padding: '2px 8px' },
  goLiveBtn: { background: 'var(--danger)', color: '#fff', fontSize: '10px', fontWeight: 800 },
  finalizeBtn: { background: 'var(--success)', color: '#fff', fontSize: '10px', fontWeight: 800 },
  dialogRoot: { maxWidth: 400, padding: '24px' },
  dialogTitle: { fontSize: 'var(--text-lg)', fontWeight: 800, margin: '0 0 12px' },
  dialogText: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 },
};
