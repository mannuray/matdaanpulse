import { Sheet } from '../../ui/Sheet';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { FeedbackKindBadge } from '../../feedback/FeedbackKindBadge';
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_TONE, kindMeta } from '../../../utils/feedback';
import { formatIst } from '../../../utils/time';
import type { Feedback, FeedbackStatus } from '../../../types';

/** Every status except the current one is offered. */
export const STATUS_ACTIONS: { status: FeedbackStatus; label: string }[] = [
  { status: 'read', label: 'Mark read' },
  { status: 'resolved', label: 'Resolve' },
  { status: 'new', label: 'Mark new' },
];

interface FeedbackPanelProps {
  item: Feedback | null;
  listLoading: boolean;
  listError: string | null;
  busy: boolean;
  onSetStatus: (item: Feedback, status: FeedbackStatus) => void;
  onRetry: () => void;
  onClose: () => void;
}

/** One public report, read-only, with the status actions. The page keys it by id. */
export function FeedbackPanel({ item, listLoading, listError, busy, onSetStatus, onRetry, onClose }: FeedbackPanelProps) {
  return (
    <Sheet
      open
      onRequestClose={onClose}
      title="Feedback"
      description={item ? `${kindMeta(item.kind).label} · received ${formatIst(item.createdAt)} (IST)` : undefined}
      footer={item ? (
        <>
          <Badge tone={FEEDBACK_STATUS_TONE[item.status]}>{FEEDBACK_STATUS_LABEL[item.status]}</Badge>
          <div className="flex items-center gap-2">
            {STATUS_ACTIONS.filter((a) => a.status !== item.status).map((a) => (
              <Button key={a.status} size="sm" variant={a.status === 'resolved' ? 'primary' : 'outline'} disabled={busy} onClick={() => onSetStatus(item, a.status)}>
                {a.label}
              </Button>
            ))}
          </div>
        </>
      ) : undefined}
    >
      {!item ? (
        listLoading ? <p className="py-10 text-center text-sm text-muted">Loading feedback…</p>
          : listError ? (
            <EmptyState
              title="Could not load feedback"
              description={listError}
              action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
            />
          )
            : <EmptyState title="Feedback not found" description="It may be on another page or hidden by the status filter. Close this panel to go back to the list." />
      ) : (
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted">Kind</dt>
            <dd className="mt-1"><FeedbackKindBadge kind={item.kind} /></dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Message</dt>
            <dd className="mt-1 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{item.message}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Email</dt>
            <dd className="mt-1">
              {item.email
                ? <a href={`mailto:${item.email}`} className="break-all text-accent hover:underline">{item.email}</a>
                : <span className="text-muted">Not given</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Page</dt>
            {/* Plain text on purpose: the path is user input and must never become a link. */}
            <dd className="mt-1 font-mono text-xs text-ink-2 [overflow-wrap:anywhere]">{item.page || <span className="font-sans text-muted">Not given</span>}</dd>
          </div>
        </dl>
      )}
    </Sheet>
  );
}
