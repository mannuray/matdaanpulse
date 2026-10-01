import { Download, RefreshCw } from 'lucide-react';
import { AUDIT_LIMIT, getAuditLogs } from '../services/audit.service';
import { useResourceList } from '../hooks/useResourceList';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { EntityPage } from '../components/entity/EntityPage';
import { AuditPanel } from '../components/entity/audit/AuditPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { Toolbar } from '../components/ui/Toolbar';
import { Input, Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, actionLabel, actionTone, auditActor, entityLabel, isAuditAction, isAuditEntity } from '../utils/audit';
import { auditCsv, downloadCsv } from '../utils/csv';
import { formatIst, isIsoDay, todayIst } from '../utils/time';
import type { AuditLog } from '../types';

type Filters = { action: string; entity_type: string; from: string; to: string };
const NO_FILTERS: Filters = { action: '', entity_type: '', from: '', to: '' };

export const RANGE_ERROR = 'The From date is after the To date. Pick a From date on or before the To date.';
const rangeError = (f: Filters) => (f.from && f.to && f.from > f.to ? RANGE_ERROR : null);

const COLUMNS: Column<AuditLog>[] = [
  { key: 'time', header: 'Time (IST)', className: 'whitespace-nowrap text-xs text-ink-2', cell: (l) => formatIst(l.timestamp) },
  {
    key: 'admin', header: 'Admin',
    cell: (l) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{auditActor(l)}</div>
        {l.users?.email && <div className="truncate text-xs text-muted">{l.users.email}</div>}
      </div>
    ),
  },
  { key: 'action', header: 'Action', cell: (l) => <Badge tone={actionTone(l.action)}>{actionLabel(l.action)}</Badge> },
  { key: 'entity', header: 'Entity', className: 'text-ink-2', cell: (l) => entityLabel(l.entity_type) },
  { key: 'id', header: 'Entity ID', className: 'max-w-[180px] truncate font-mono text-[11px] text-muted', cell: (l) => <span title={l.entity_id}>{l.entity_id}</span> },
  {
    key: 'change', header: 'Change', className: 'whitespace-nowrap text-xs text-ink-2',
    cell: (l) => {
      const parts = [l.old_value != null ? 'Before' : null, l.new_value != null ? (l.old_value != null ? 'after' : 'After') : null].filter(Boolean);
      return parts.length ? parts.join(' → ') : <span className="text-muted">—</span>;
    },
  },
];

/** PAGE: Audit logs (SUPER_ADMIN) — the latest 200 entries, filterable; panel at /logs/:id. */
export default function AuditLogs() {
  const route = useEntityRoute('/logs');
  const list = useResourceList<Filters>({
    key: 'audit_logs',
    initialFilters: NO_FILTERS,
    // Older builds stored actions the backend never writes; an unknown value would silently return nothing.
    sanitizeFilters: (f) => ({
      action: isAuditAction(f.action) ? f.action : '',
      entity_type: isAuditEntity(f.entity_type) ? f.entity_type : '',
      from: isIsoDay(f.from) ? f.from : '',
      to: isIsoDay(f.to) ? f.to : '',
    }),
    onLoad: async (_page, _search, f) => {
      if (rangeError(f)) return { data: [], total: 0 };
      const data = await getAuditLogs(f);
      return { data, total: data.length };
    },
  });
  const logs = list.items as AuditLog[];
  const f = list.filters;
  const invalidRange = rangeError(f);
  const hasFilters = !!(f.action || f.entity_type || f.from || f.to);
  const selected = route.id ? logs.find((l) => l.id === route.id) ?? null : null;
  const exportCsv = () => downloadCsv(`audit-logs-${todayIst()}.csv`, auditCsv(logs));

  return (
    <EntityPage
      header={
        <PageHeader
          title="Audit logs"
          subtitle="Result overrides, seat saves and lock take-overs · times in IST"
          actions={
            <>
              <Button variant="outline" title="Exports the rows shown (up to 200)" disabled={logs.length === 0} onClick={exportCsv}><Download size={14} aria-hidden />Download CSV</Button>
              <Button variant="outline" disabled={list.loading} onClick={() => { void list.refresh(); }}><RefreshCw size={14} aria-hidden />Refresh</Button>
            </>
          }
        />
      }
      toolbar={
        <Toolbar>
          <Select aria-label="Action" className="w-52" value={f.action} onChange={(e) => list.updateFilters({ action: e.target.value })}>
            <option value="">Any action</option>
            {AUDIT_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
          <Select aria-label="Entity" className="w-40" value={f.entity_type} onChange={(e) => list.updateFilters({ entity_type: e.target.value })}>
            <option value="">Any entity</option>
            {AUDIT_ENTITIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            From (IST)
            <Input type="date" className="w-40" value={f.from} max={f.to || undefined} onChange={(e) => list.updateFilters({ from: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            To (IST)
            <Input type="date" className="w-40" value={f.to} min={f.from || undefined} onChange={(e) => list.updateFilters({ to: e.target.value })} />
          </label>
          {hasFilters && <Button size="sm" variant="ghost" onClick={() => list.updateFilters(NO_FILTERS)}>Clear filters</Button>}
          <span className="ml-auto text-xs text-muted">
            {logs.length >= AUDIT_LIMIT ? `Showing latest ${AUDIT_LIMIT}` : `${logs.length.toLocaleString('en-IN')} ${logs.length === 1 ? 'entry' : 'entries'}`}
          </span>
        </Toolbar>
      }
      table={
        <>
          {invalidRange && <div role="alert" className="rounded-card border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn-text">{invalidRange}</div>}
          {list.error && logs.length > 0 && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/30 bg-bad-soft px-4 py-2.5 text-sm text-bad-text">
              {list.error}
              <Button size="sm" variant="outline" onClick={() => { void list.refresh(); }}>Try again</Button>
            </div>
          )}
          <DataTable
            label="Audit log"
            columns={COLUMNS}
            rows={logs}
            rowKey={(l) => l.id}
            selectedKey={route.id}
            onRowClick={(l) => route.open(l.id)}
            loading={list.loading}
            empty={list.error
              ? <EmptyState title="Could not load audit logs" description={list.error} action={<Button variant="outline" size="sm" onClick={() => { void list.refresh(); }}>Try again</Button>} />
              : invalidRange
                ? <EmptyState title="Fix the dates" description="No entries can match this range." />
                : hasFilters
                  ? <EmptyState title="No entries match" description="Try other filters, or clear them." />
                  : <EmptyState title="No audit entries yet" description="Result overrides, seat saves and lock take-overs appear here." />}
          />
        </>
      }
      panel={route.id ? (
        <AuditPanel
          key={route.id}
          log={selected}
          listLoading={list.loading}
          listError={list.error}
          onRetry={() => { void list.refresh(); }}
          onClose={() => route.close()}
        />
      ) : null}
    />
  );
}
