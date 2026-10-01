import { useState } from 'react';
import { getFeedback, updateFeedbackStatus } from '../services/feedback.service';
import { useResourceList } from '../hooks/useResourceList';
import { useToast } from '../context/ToastContext';
import AdminPageHeader from '../components/common/AdminPageHeader';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import type { Feedback as FeedbackItem, FeedbackKind, FeedbackStatus } from '../types';

const PAGE_SIZE = 50;

const STATUS_FILTERS: { value: '' | FeedbackStatus; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'resolved', label: 'Resolved' },
];

const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: 'Bug',
  data_error: 'Data error',
  suggestion: 'Suggestion',
  other: 'Other',
};

/** Row actions: every status except the current one. */
const ACTIONS: { status: FeedbackStatus; label: string }[] = [
  { status: 'read', label: 'MARK READ' },
  { status: 'resolved', label: 'RESOLVE' },
  { status: 'new', label: 'MARK NEW' },
];

/**
 * PAGE: Feedback (MVC: View)
 * Inbox for the public feedback form: triage reports as new → read → resolved.
 */
export default function Feedback() {
  const { toast, toastError } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useResourceList<{ status: '' | FeedbackStatus }>({
    key: 'feedback',
    pageSize: PAGE_SIZE,
    initialFilters: { status: '' },
    onLoad: async (page, _search, filters) => {
      const res = await getFeedback(page, PAGE_SIZE, filters.status || undefined);
      return { data: res.data || [], total: res.pagination?.total || 0 };
    },
  });

  const { items, loading, error, refresh, filters, updateFilters, page, setPage, totalPages, total } = list;

  const setStatus = async (item: FeedbackItem, status: FeedbackStatus) => {
    setBusyId(item.id);
    try {
      await updateFeedbackStatus(item.id, status);
      toast(`Marked ${status}`);
      refresh();
    } catch (err) {
      toastError(err, 'Status update failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader
        title="Feedback"
        subtitle="Reports from the public site"
        actions={<button onClick={refresh} className="btn btn-primary" style={styles.headerBtn}>REFRESH</button>}
      />

      <div style={styles.filterBarRoot}>
        <div style={styles.filterContainer}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              onClick={() => updateFilters({ status: f.value })}
              className={`btn btn-sm ${filters.status === f.value ? 'btn-primary' : 'btn-outline'}`}
              aria-pressed={filters.status === f.value}
            >
              {f.label.toUpperCase()}
            </button>
          ))}
          <div style={styles.recordCount}>{total} RECORDS FOUND</div>
        </div>
      </div>

      <div style={{ padding: 'var(--space-6)' }}>
        {error && <div style={styles.error}>{error}</div>}
        {loading && items.length === 0 ? (
          <div style={styles.spinnerWrapper}><div className="spinner" style={styles.spinner}></div></div>
        ) : (
          <ErrorBoundary>
            <div className="card-elevated" style={{ padding: 0 }}>
              <div style={{ overflowX: 'auto' }}>
              <table className="admin-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={styles.tableHeadRow}>
                    <th style={styles.th}>Date</th>
                    <th style={styles.th}>Type</th>
                    <th style={styles.th}>Message</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Page</th>
                    <th style={styles.th}>Status</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(items as FeedbackItem[]).map((f) => (
                    <FeedbackRow key={f.id} item={f} busy={busyId === f.id} onSetStatus={setStatus} />
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={7} style={styles.emptyCell}>No feedback found.</td></tr>
                  )}
                </tbody>
              </table>
              </div>
              <div style={styles.pager}>
                <div style={styles.pagerLabel}>PAGE {page} OF {totalPages}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-sm btn-outline">PREV</button>
                  <button disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn btn-sm btn-outline">NEXT</button>
                </div>
              </div>
            </div>
          </ErrorBoundary>
        )}
      </div>
    </div>
  );
}

function FeedbackRow({ item, busy, onSetStatus }: {
  item: FeedbackItem;
  busy: boolean;
  onSetStatus: (item: FeedbackItem, status: FeedbackStatus) => void;
}) {
  return (
    <tr className="row-hover" style={styles.dataRow}>
      <td style={styles.tdTime}>
        {new Date(item.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
      </td>
      <td style={styles.td}><span style={styles.kindTag}>{KIND_LABELS[item.kind] ?? item.kind}</span></td>
      <td style={styles.tdMessage}>{item.message}</td>
      <td style={styles.tdSmall}>
        {item.email ? <a href={`mailto:${item.email}`}>{item.email}</a> : <span style={styles.muted}>-</span>}
      </td>
      {/* Plain text on purpose: the path is user input and must never become an href. */}
      <td style={styles.tdPage}>{item.page || <span style={styles.muted}>-</span>}</td>
      <td style={styles.td}><span style={{ ...styles.statusTag, ...statusStyle(item.status) }}>{item.status.toUpperCase()}</span></td>
      <td style={styles.td}>
        <div style={styles.actions}>
          {ACTIONS.filter((a) => a.status !== item.status).map((a) => (
            <button key={a.status} disabled={busy} onClick={() => onSetStatus(item, a.status)} className="btn btn-sm btn-outline">
              {a.label}
            </button>
          ))}
        </div>
      </td>
    </tr>
  );
}

// --- Helpers & Styles ---

const statusStyle = (status: FeedbackStatus) => {
  switch (status) {
    case 'new': return { background: 'var(--accent-soft)', color: 'var(--accent)', border: '1px solid var(--accent-soft)' };
    case 'resolved': return { background: 'var(--success-soft)', color: 'var(--success-text)', border: '1px solid #bbf7d0' };
    default: return { background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' };
  }
};

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '40px' },
  headerBtn: { padding: '6px 16px', fontSize: '11px', fontWeight: 700, borderRadius: 'var(--radius-sm)' },
  filterBarRoot: { background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '0 var(--space-6) var(--space-4) var(--space-6)' },
  filterContainer: { display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  recordCount: { marginLeft: 'auto', fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' },
  error: { marginBottom: 'var(--space-4)', padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--danger-soft)', color: 'var(--danger-text)', fontSize: '12px', fontWeight: 600 },
  spinnerWrapper: { display: 'flex', justifyContent: 'center', padding: '100px' },
  spinner: { width: '24px', height: '24px' },
  tableHeadRow: { background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' },
  th: { padding: '12px 16px', textAlign: 'left' as const, fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: 'var(--text-muted)' },
  dataRow: { borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', verticalAlign: 'top' as const },
  td: { padding: '10px 16px' },
  tdTime: { padding: '10px 16px', fontSize: '12px', whiteSpace: 'nowrap' as const, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' },
  tdMessage: { padding: '10px 16px', fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' as const, wordBreak: 'break-word' as const, overflowWrap: 'anywhere' as const, minWidth: 200 },
  tdSmall: { padding: '10px 16px', fontSize: '12px', wordBreak: 'break-all' as const },
  tdPage: { padding: '10px 16px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflowWrap: 'anywhere' as const, minWidth: 140, maxWidth: 220 },
  muted: { color: 'var(--text-muted)' },
  kindTag: { padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, whiteSpace: 'nowrap' as const, background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
  statusTag: { padding: '3px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 800, display: 'inline-block' as const },
  actions: { display: 'flex', flexDirection: 'column' as const, gap: 4, whiteSpace: 'nowrap' as const },
  emptyCell: { padding: '60px', textAlign: 'center' as const, color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 },
  pager: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border)' },
  pagerLabel: { fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' },
};
