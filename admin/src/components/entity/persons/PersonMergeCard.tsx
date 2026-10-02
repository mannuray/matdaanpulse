import { RecordCard } from '../../record/RecordCard';
import { SearchInput } from '../../ui/Toolbar';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import type { usePersonEdit } from '../../../hooks/usePersonEdit';

interface PersonMergeCardProps {
  ed: ReturnType<typeof usePersonEdit>;
  onMerge: (duplicateId: string, duplicateName: string) => void;
}

/** Person record, right column (SUPER_ADMIN only): find a duplicate and merge it into this person, after a confirm. */
export function PersonMergeCard({ ed, onMerge }: PersonMergeCardProps) {
  return (
    <RecordCard title="Merge duplicate" action={<Badge tone="warn">Super admin</Badge>}>
      <div className="space-y-3">
        <p className="text-xs text-ink-2">Move every contest from a duplicate record into this person, then delete the duplicate.</p>
        {/* A merge reloads the record, which would silently drop unsaved form edits. */}
        {ed.dirty && <p className="text-xs text-warn-text">Save or cancel your changes first.</p>}
        <SearchInput label="Search duplicates" placeholder="Search by name…" value={ed.mergeSearch} onChange={ed.setMergeSearch} />
        {ed.mergeResults.length > 0 && (
          <ul className="space-y-2">
            {ed.mergeResults.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-control border border-warn/40 bg-warn-soft px-3 py-2.5">
                <div className="min-w-0 text-xs">
                  <div className="truncate font-medium text-ink">{p.name}</div>
                  <div className="text-muted">
                    {p.candidate_count} {p.candidate_count === 1 ? 'contest' : 'contests'} · id <span className="font-mono">{p.id.split('-')[0]}</span>
                  </div>
                </div>
                <Button
                  size="sm" variant="danger" disabled={ed.merging || ed.saving || ed.dirty}
                  aria-label={`Merge ${p.name} into this record`} onClick={() => onMerge(p.id, p.name)}
                >
                  Merge into this
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RecordCard>
  );
}
