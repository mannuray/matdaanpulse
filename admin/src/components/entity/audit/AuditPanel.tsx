import { Sheet } from '../../ui/Sheet';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { actionLabel, actionTone, auditActor, describeAudit, entityLabel } from '../../../utils/audit';
import { formatIst } from '../../../utils/time';
import type { AuditLog } from '../../../types';

interface AuditPanelProps {
  /** From the loaded list (there is no GET-by-id). */
  log: AuditLog | null;
  listLoading: boolean;
  listError: string | null;
  onRetry: () => void;
  onClose: () => void;
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section aria-label={title} className="space-y-1.5">
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      {value === null || value === undefined
        ? <p className="text-xs text-muted">None</p>
        : <pre className="max-h-72 overflow-auto rounded-control border border-line bg-subtle p-3 font-mono text-xs text-ink">{JSON.stringify(value, null, 2)}</pre>}
    </section>
  );
}

/** One audit entry, read-only, with the full before/after values. The page keys it by id. */
export function AuditPanel({ log, listLoading, listError, onRetry, onClose }: AuditPanelProps) {
  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={log ? actionLabel(log.action) : 'Audit entry'}
      description={log ? `${formatIst(log.timestamp)} (IST)` : undefined}
    >
      {!log ? (
        listLoading ? <p className="py-10 text-center text-sm text-muted">Loading entry…</p>
          : listError
            ? <EmptyState title="Could not load audit logs" description={listError} action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>} />
            : <EmptyState title="Audit entry not found" description="It may be older than the latest 200 or outside the filters. Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5 text-sm">
          <p className="text-ink">{describeAudit(log)}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-xs text-muted">Admin</dt>
            <dd className="text-ink">{auditActor(log)}{log.users?.email && <span className="ml-1 text-muted">({log.users.email})</span>}</dd>
            <dt className="text-xs text-muted">Action</dt>
            <dd><Badge tone={actionTone(log.action)}>{actionLabel(log.action)}</Badge></dd>
            <dt className="text-xs text-muted">Entity</dt>
            <dd className="text-ink">{entityLabel(log.entity_type)}</dd>
            <dt className="text-xs text-muted">Entity ID</dt>
            <dd className="break-all font-mono text-xs text-ink-2">{log.entity_id}</dd>
            <dt className="text-xs text-muted">Time (UTC)</dt>
            <dd className="font-mono text-xs text-ink-2">{log.timestamp}</dd>
          </dl>
          <JsonBlock title="Before" value={log.old_value} />
          <JsonBlock title="After" value={log.new_value} />
        </div>
      )}
    </Sheet>
  );
}
