import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getFeedback, updateFeedbackStatus } from '../services/feedback.service';
import { useResourceList } from '../hooks/useResourceList';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { useToast } from '../context/ToastContext';
import { EntityPage } from '../components/entity/EntityPage';
import { FeedbackPanel, STATUS_ACTIONS } from '../components/entity/feedback/FeedbackPanel';
import { FeedbackKindBadge } from '../components/feedback/FeedbackKindBadge';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_TONE, isFeedbackStatus, notifyFeedbackChanged } from '../utils/feedback';
import { formatIst } from '../utils/time';
import type { Feedback as FeedbackItem, FeedbackStatus } from '../types';

const PAGE_SIZE = 50;
type StatusFilter = '' | FeedbackStatus;

const CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'resolved', label: 'Resolved' },
];

/**
 * PAGE: Feedback — inbox for the public feedback form: triage reports as new → read → resolved.
 * Table + panel at /feedback/:id (no GET-by-id endpoint: the panel reads the loaded page).
 */
export default function Feedback() {
  const route = useEntityRoute('/feedback');
  const { toast, toastError } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The record last changed here: the panel keeps showing it after it leaves the filtered list. */
  const [changed, setChanged] = useState<FeedbackItem | null>(null);

  const list = useResourceList<{ status: StatusFilter }>({
    key: 'feedback',
    pageSize: PAGE_SIZE,
    initialFilters: { status: '' },
    sanitizeFilters: (f) => ({ status: isFeedbackStatus(f.status) ? f.status : '' }),
    onLoad: async (page, _search, filters) => {
      const res = await getFeedback(page, PAGE_SIZE, filters.status || undefined);
      return { data: res.data || [], total: res.pagination?.total || 0 };
    },
  });
  const rows = list.items as FeedbackItem[];

  const setStatus = async (item: FeedbackItem, status: FeedbackStatus) => {
    setBusyId(item.id);
    try {
      const updated = await updateFeedbackStatus(item.id, status);
      setChanged(updated?.id ? updated : { ...item, status });
      notifyFeedbackChanged();
      toast(`Marked ${FEEDBACK_STATUS_LABEL[status].toLowerCase()}`);
      void list.refresh();
    } catch (err) {
      toastError(err, 'Status update failed');
    } finally {
      setBusyId(null);
    }
  };

  const selected = !route.id ? null : changed?.id === route.id ? changed : rows.find((f) => f.id === route.id) ?? null;

  const columns: Column<FeedbackItem>[] = [
    { key: 'received', header: 'Received', className: 'whitespace-nowrap text-xs text-ink-2', cell: (f) => formatIst(f.createdAt) },
    { key: 'kind', header: 'Kind', cell: (f) => <FeedbackKindBadge kind={f.kind} /> },
    {
      key: 'message', header: 'Message', className: 'max-w-md',
      cell: (f) => <span className="line-clamp-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{f.message}</span>,
    },
    {
      key: 'email', header: 'Email', className: 'text-xs',
      cell: (f) => (f.email ? <a href={`mailto:${f.email}`} className="break-all text-accent hover:underline">{f.email}</a> : <span className="text-muted">—</span>),
    },
    {
      // Plain text on purpose: the path is user input and must never become a link.
      key: 'page', header: 'Page', className: 'max-w-[220px] font-mono text-[11px] text-ink-2 [overflow-wrap:anywhere]',
      cell: (f) => f.page || <span className="font-sans text-muted">—</span>,
    },
    { key: 'status', header: 'Status', cell: (f) => <Badge tone={FEEDBACK_STATUS_TONE[f.status]}>{FEEDBACK_STATUS_LABEL[f.status]}</Badge> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, className: 'whitespace-nowrap',
      cell: (f) => (
        <div className="flex justify-end gap-1.5">
          {STATUS_ACTIONS.filter((a) => a.status !== f.status).map((a) => (
            <Button key={a.status} size="sm" variant="outline" disabled={busyId === f.id} onClick={() => { void setStatus(f, a.status); }}>{a.label}</Button>
          ))}
        </div>
      ),
    },
  ];

  const filterLabel = CHIPS.find((c) => c.value === list.filters.status)?.label.toLowerCase();

  return (
    <EntityPage
      header={
        <PageHeader
          title="Feedback"
          count={list.total}
          subtitle="Reports from the public site"
          actions={<Button variant="outline" disabled={list.loading} onClick={() => { void list.refresh(); }}><RefreshCw size={14} aria-hidden />Refresh</Button>}
        />
      }
      toolbar={
        <Toolbar>
          <ChipGroup<StatusFilter> label="Status" value={list.filters.status} onChange={(status) => list.updateFilters({ status })} options={CHIPS} />
        </Toolbar>
      }
      table={
        <>
          {list.error && rows.length > 0 && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/30 bg-bad-soft px-4 py-2.5 text-sm text-bad-text">
              {list.error}
              <Button size="sm" variant="outline" onClick={() => { void list.refresh(); }}>Try again</Button>
            </div>
          )}
          <DataTable
            label="Feedback"
            columns={columns}
            rows={rows}
            rowKey={(f) => f.id}
            selectedKey={route.id}
            onRowClick={(f) => route.open(f.id)}
            loading={list.loading}
            empty={list.error
              ? <EmptyState title="Could not load feedback" description={list.error} action={<Button variant="outline" size="sm" onClick={() => { void list.refresh(); }}>Try again</Button>} />
              : <EmptyState title="No feedback found" description={list.filters.status ? `There is no ${filterLabel} feedback.` : 'Reports from the public feedback form appear here.'} />}
            footer={<Pager page={list.page} totalPages={list.totalPages} total={list.total} pageSize={PAGE_SIZE} noun="reports" onPage={list.loadPage} />}
          />
        </>
      }
      panel={route.id ? (
        <FeedbackPanel
          key={route.id}
          item={selected}
          listLoading={list.loading}
          listError={list.error}
          busy={busyId === route.id}
          onSetStatus={(f, status) => { void setStatus(f, status); }}
          onRetry={() => { void list.refresh(); }}
          onClose={() => route.close()}
        />
      ) : null}
    />
  );
}
