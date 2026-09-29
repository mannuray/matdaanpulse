import { getAuditLogs } from '../services/audit.service';
import { useResourceList } from '../hooks/useResourceList';
import AdminPageHeader from '../components/common/AdminPageHeader';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import type { AuditLog } from '../types';

const ACTIONS = ['RESULT_OVERRIDE', 'MANIFEST_PUBLISH', 'MANIFEST_DRAFT', 'ELECTION_FINALIZE', 'ELECTION_CREATE', 'ELECTION_UPDATE', 'USER_CREATED', 'USER_UPDATED', 'CANDIDATE_IMPORT'];
const ENTITIES = ['result', 'manifest', 'election', 'candidate', 'alliance', 'user', 'party'];

/**
 * PAGE: Audit Logs (MVC: View)
 * High-fidelity security trail for all administrative operations.
 */
export default function AuditLogs() {
  const list = useResourceList<{ action: string; entity_type: string; from: string; to: string }>({
    key: 'audit_logs',
    initialFilters: { action: '', entity_type: '', from: '', to: '' },
    onLoad: async (_page, _search, filters) => {
      const f: Record<string, string> = {};
      if (filters.action) f.action = filters.action;
      if (filters.entity_type) f.entity_type = filters.entity_type;
      if (filters.from) f.from = filters.from;
      if (filters.to) f.to = filters.to;
      const data = await getAuditLogs(f);
      return { data, total: data.length };
    }
  });

  const { items: logs, loading, refresh } = list;

  const exportCsv = () => {
    const header = 'Timestamp,User,Action,Entity Type,Entity ID\n';
    const rows = logs.map((l: AuditLog) =>
      `${l.timestamp},${l.user?.name || l.user_id},${l.action},${l.entity_type},${l.entity_id}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader 
        title="Security & Audit Logs"
        subtitle="Real-time administrative trail"
        actions={
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={exportCsv} disabled={logs.length === 0} className="btn btn-outline" style={styles.headerBtn}>DOWNLOAD CSV</button>
            <button onClick={refresh} className="btn btn-primary" style={styles.headerBtn}>REFRESH</button>
          </div>
        }
      />

      <ErrorBoundary>
        <AuditFilterBar list={list} />
      </ErrorBoundary>

      <div style={{ padding: 'var(--space-6)' }}>
        {loading ? (
          <div style={styles.spinnerWrapper}><div className="spinner" style={styles.spinner}></div></div>
        ) : (
          <ErrorBoundary>
            <div className="card-elevated" style={{ padding: 0 }}>
              <LogsTable logs={logs} />
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

// --- Internal Sub-Components ---

function AuditFilterBar({ list }: { list: any }) {
  const { filters, updateFilters } = list;
  const clearFilters = () => updateFilters({ action: '', entity_type: '', from: '', to: '' });

  return (
    <div style={styles.filterBarRoot}>
      <div style={styles.filterContainer}>
        <select 
          className="form-select" 
          value={filters.action} 
          onChange={(e) => updateFilters({ action: e.target.value })} 
          style={styles.selectAction}
        >
          <option value="">ALL ACTIONS</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
        </select>
        <select 
          className="form-select" 
          value={filters.entity_type} 
          onChange={(e) => updateFilters({ entity_type: e.target.value })} 
          style={styles.selectEntity}
        >
          <option value="">ALL ENTITIES</option>
          {ENTITIES.map((e) => <option key={e} value={e}>{e.toUpperCase()}</option>)}
        </select>
        
        <div style={styles.dateGroup}>
          <span style={styles.dateLabel}>FROM</span>
          <input type="date" className="form-input" value={filters.from} onChange={(e) => updateFilters({ from: e.target.value })} style={styles.dateInput} />
        </div>
        
        <div style={styles.dateGroup}>
          <span style={styles.dateLabel}>TO</span>
          <input type="date" className="form-input" value={filters.to} onChange={(e) => updateFilters({ to: e.target.value })} style={styles.dateInput} />
        </div>

        {(filters.action || filters.entity_type || filters.from || filters.to) && (
          <button onClick={clearFilters} style={styles.clearBtn}>Clear All</button>
        )}
        
        <div style={styles.recordCount}>{list.items.length} RECORDS FOUND</div>
      </div>
    </div>
  );
}

function LogsTable({ logs }: { logs: AuditLog[] }) {
  return (
    <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={styles.tableHeadRow}>
          <th style={styles.thLeft}>Timestamp</th>
          <th style={styles.thLeft}>Administrator</th>
          <th style={styles.thLeft}>Operation</th>
          <th style={styles.thLeft}>Resource</th>
          <th style={styles.thLeft}>System ID</th>
          <th style={styles.thCenter}>Delta</th>
        </tr>
      </thead>
      <tbody>
        {logs.map((log) => <LogRow key={log.id} log={log} />)}
        {logs.length === 0 && (
          <tr><td colSpan={6} style={styles.emptyCell}>No administrative logs found.</td></tr>
        )}
      </tbody>
    </table>
  );
}

function LogRow({ log }: { log: AuditLog }) {
  const actionStyle = getActionStyle(log.action);
  return (
    <tr className="row-hover" style={styles.dataRow}>
      <td style={styles.tdTime}>
        {new Date(log.timestamp).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
      </td>
      <td style={styles.tdUser}>
        {log.user?.name || log.user_id?.split('-')[0] || '-'}
      </td>
      <td style={styles.td}>
        <span style={{ ...actionStyle, ...styles.actionTag }}>{log.action}</span>
      </td>
      <td style={styles.tdResource}>{log.entity_type}</td>
      <td style={styles.tdId}>{log.entity_id}</td>
      <td style={styles.td}>
        <div style={styles.deltaBox}>
          {log.old_value != null && (
            <span title={JSON.stringify(log.old_value, null, 2)} style={styles.deltaPre}>PRE</span>
          )}
          {(log.old_value != null || log.new_value != null) && <span style={styles.deltaArrow}>→</span>}
          {log.new_value != null && (
            <span title={JSON.stringify(log.new_value, null, 2)} style={styles.deltaPost}>POST</span>
          )}
          {log.old_value == null && log.new_value == null && <span style={styles.deltaArrow}>-</span>}
        </div>
      </td>
    </tr>
  );
}

// --- Helpers & Styles ---

const getActionStyle = (action: string) => {
  switch (action) {
    case 'RESULT_OVERRIDE': return { background: 'var(--danger-soft)', color: 'var(--danger-text)', border: '1px solid #fecaca' };
    case 'MANIFEST_PUBLISH': return { background: 'var(--success-soft)', color: 'var(--success-text)', border: '1px solid #bbf7d0' };
    case 'ELECTION_FINALIZE': return { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-soft)' };
    default: return { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' };
  }
};

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '40px' },
  headerBtn: { padding: '6px 16px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-sm)' },
  filterBarRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '0 var(--space-6) var(--space-4) var(--space-6)' },
  filterContainer: { display: 'flex', gap: '10px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  selectAction: { height: '30px', minWidth: 160, fontSize: '11px', fontWeight: 600, background: 'var(--bg-primary)' },
  selectEntity: { height: '30px', minWidth: 140, fontSize: '11px', fontWeight: 600, background: 'var(--bg-primary)' },
  dateGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
  dateLabel: { fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' },
  dateInput: { height: '30px', fontSize: '11px', padding: '0 8px', width: '130px' },
  clearBtn: { background: 'none', border: 'none', color: 'var(--accent)', fontSize: '10px', fontWeight: 800, cursor: 'pointer', textTransform: 'uppercase' as const },
  recordCount: { marginLeft: 'auto', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' },
  spinnerWrapper: { display: 'flex', justifyContent: 'center', padding: '100px' },
  spinner: { width: '24px', height: '24px' },
  tableHeadRow: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  thLeft: { padding: '12px 16px', textAlign: 'left' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text-muted)' },
  thCenter: { padding: '12px 16px', textAlign: 'center' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text-muted)' },
  dataRow: { borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' },
  td: { padding: '10px 16px' },
  tdTime: { padding: '10px 16px', fontSize: '12px', whiteSpace: 'nowrap' as const, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' },
  tdUser: { padding: '10px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' },
  tdResource: { padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const },
  tdId: { padding: '10px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' },
  actionTag: { padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, display: 'inline-block' as const },
  deltaBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  deltaPre: { padding: '2px 6px', borderRadius: '4px', background: 'var(--danger-soft)', color: 'var(--danger-text)', fontSize: '9px', fontWeight: 800, cursor: 'help', border: '1px solid #fecaca' },
  deltaPost: { padding: '2px 6px', borderRadius: '4px', background: 'var(--success-soft)', color: 'var(--success-text)', fontSize: '9px', fontWeight: 800, cursor: 'help', border: '1px solid #bbf7d0' },
  deltaArrow: { color: 'var(--text-muted)', fontSize: '10px' },
  emptyCell: { padding: '60px', textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 },
};
