import * as Dialog from '@radix-ui/react-dialog';
import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useElection } from '../../context/ElectionContext';
import { confirmDiscardEdits, useShellStatus } from '../../context/ShellStatusContext';
import { MIN_QUERY, useCommandSearch, type CommandItem } from '../../hooks/useCommandSearch';
import { Kbd } from '../ui/Kbd';
import { cn } from '../ui/cn';

/** ⌘K: jump to a page, seat, candidate, party or person. Opening a record from another election switches it first. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { electionId, elections, setElectionId } = useElection();
  const { editorDirty } = useShellStatus();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const canSee = useCallback((roles: string[]) => roles.length === 0 || roles.some((r) => hasRole(r)), [hasRole]);
  const { items, loading } = useCommandSearch(query, electionId, elections, canSee);

  useEffect(() => { if (!open) setQuery(''); }, [open]);
  useEffect(() => { setActive(0); }, [query]);
  const optionId = (i: number) => `${listId}-opt-${i}`;
  useEffect(() => { document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' }); }, [active, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (item: CommandItem) => {
    // Leaving an editor (record panel or seat) with unsaved edits asks first.
    if (!confirmDiscardEdits(editorDirty)) return;
    onOpenChange(false);
    const eid = item.electionId ?? electionId;
    // Switch first: setElectionId rewrites ?election= on the current URL; the navigation below then
    // carries the new path and the same election, so it is the last word.
    if (item.electionId && item.electionId !== electionId) setElectionId(item.electionId);
    navigate(eid ? `${item.to}?election=${encodeURIComponent(eid)}` : item.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]); }
  };

  const groups = useMemo(() => {
    const out: { group: string; rows: { item: CommandItem; index: number }[] }[] = [];
    items.forEach((item, index) => {
      const g = out.find((x) => x.group === item.group);
      if (g) g.rows.push({ item, index });
      else out.push({ group: item.group, rows: [{ item, index }] });
    });
    return out;
  }, [items]);

  const tooShort = query.trim().length < MIN_QUERY;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-24 z-50 w-[560px] -translate-x-1/2 overflow-hidden rounded-panel border border-line bg-card shadow-lg">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search size={16} aria-hidden className="text-muted" />
            <input
              autoFocus
              role="combobox"
              aria-expanded={items.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={items[active] ? optionId(active) : undefined}
              aria-label="Search seats, candidates, parties, persons and pages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search seats, candidates, parties, persons…"
              className="h-12 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div id={listId} role="listbox" aria-label="Results" className="max-h-96 overflow-y-auto p-2">
            {groups.map(({ group, rows }) => (
              <div key={group} role="group" aria-label={group} className="mb-1">
                <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted">{group}</div>
                {rows.map(({ item, index }) => (
                  <div
                    key={item.key}
                    id={optionId(index)}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-2 text-sm text-ink', index === active && 'bg-accent-soft')}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-xs text-muted">{item.hint}</span>}
                  </div>
                ))}
              </div>
            ))}
            {items.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted">{tooShort ? 'Type at least 2 letters to search.' : loading ? 'Searching…' : 'No results.'}</p>
            )}
            {loading && items.length > 0 && <p className="px-2 py-1 text-xs text-muted">Searching…</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
