import { RecordCard } from '../../record/RecordCard';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { formatIst } from '../../../utils/time';
import type { PersonMerge } from '../../../types';

interface PersonMergeHistoryCardProps {
  merges: PersonMerge[];
  /** SUPER_ADMIN only: an Undo button on each merge that can still be undone. */
  canUndo: boolean;
  /** Undo reloads the record, which would drop unsaved edits (the Merge duplicate card says so). */
  locked: boolean;
  busy: boolean;
  onUndo: (merge: PersonMerge) => void;
}

/** "Nitish Kr · 1 contest · merged 01 Oct 2026, 13:30 by Priya S" (IST). */
export function mergeLine(m: PersonMerge): string {
  const contests = `${m.candidate_count} ${m.candidate_count === 1 ? 'contest' : 'contests'}`;
  return `${m.duplicate_name} · ${contests} · merged ${formatIst(m.merged_at)} by ${m.merged_by ?? 'a deleted user'}`;
}

/**
 * Person record, right column: every merge into this person, newest first. A merge that can still be undone has an
 * Undo button for a SUPER_ADMIN (the page confirms first); one that can't (already undone, or a contest has moved
 * since) is labelled "Undone".
 */
export function PersonMergeHistoryCard({ merges, canUndo, locked, busy, onUndo }: PersonMergeHistoryCardProps) {
  return (
    <RecordCard title="Merge history">
      {merges.length === 0 ? (
        <p className="text-xs text-muted">No merges into this person.</p>
      ) : (
        <ul className="space-y-2">
          {merges.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 rounded-control border border-line px-3 py-2.5">
              <span className="min-w-0 text-xs text-ink-2">{mergeLine(m)}</span>
              {m.undoable
                ? canUndo && (
                    <Button size="sm" variant="outline" disabled={locked || busy} onClick={() => onUndo(m)}>Undo</Button>
                  )
                : <Badge tone="muted" className="shrink-0">Undone</Badge>}
            </li>
          ))}
        </ul>
      )}
    </RecordCard>
  );
}
