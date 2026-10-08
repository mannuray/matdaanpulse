import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { ChevronDown, Search } from 'lucide-react';
import { useElection } from '../../context/ElectionContext';
import { confirmDiscardEdits, useUnsavedEdits } from '../../context/UnsavedEditsContext';
import type { Election } from '../../types';
import { cn } from '../ui/cn';
import { Kbd } from '../ui/Kbd';
import { electionGroup, groupElections, matchesElection, pinnedElections } from './electionGrid';

/** Short label for the top bar: "Bihar VS 2025". */
export function shortElectionName(name: string, type: string, year: number): string {
  const base = name.replace(/\b(Vidhan Sabha|Lok Sabha|Assembly|General)\b.*$/i, '').trim();
  // National Lok Sabha names reduce to nothing: "Lok Sabha 2029", not "…Election 2029 LS 2029".
  if (!base) return `Lok Sabha ${year}`;
  return `${base} ${type} ${year}`.trim();
}

const STATUS_DOT: Record<Election['status'], string> = {
  Live: 'bg-ok',
  Upcoming: 'bg-warn',
  Finalized: 'bg-muted',
};

/** "Lok Sabha 2029" / "Bihar · Vidhan Sabha 2025". */
function pinnedLabel(e: Election) {
  return e.type === 'LS' ? `Lok Sabha ${e.year}` : `${electionGroup(e)} · Vidhan Sabha ${e.year}`;
}

/**
 * Open layers the E shortcut must not open over: any dialog or panel prompt, a Radix menu (its typeahead
 * uses letter keys, e.g. E for "Edit"), and any Radix popper (popover, select, dropdown). Not `listbox`: the
 * Live Console seat list is one, permanently.
 */
const BLOCKING_LAYERS = '[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]';

/** True when a keystroke is typed into a field (the E shortcut must not fire there). */
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/**
 * Top-bar election switcher: a state × year grid with search. E opens it anywhere; type to filter
 * ("bih 20", "wb", "ls"), ↑↓ move, Enter picks, Esc closes.
 */
export function ElectionPicker() {
  const { elections, electionId, setElectionId } = useElection();
  const { editorDirty } = useUnsavedEdits();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.key || e.key.toLowerCase() !== 'e' || e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      if (document.querySelector(BLOCKING_LAYERS)) return; // never over another dialog, menu or popover
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const matches = useMemo(() => elections.filter((e) => matchesElection(e, query)), [elections, query]);
  const pinned = useMemo(() => pinnedElections(matches), [matches]);
  const rows = useMemo(() => groupElections(matches), [matches]);
  // Keyboard order: pinned first, then the grid row by row.
  const order = useMemo(() => [...pinned, ...rows.flatMap((r) => r.elections)], [pinned, rows]);

  // Highlight the current election when opened (Enter alone keeps it); the first match while searching.
  useEffect(() => {
    setActive(query ? 0 : Math.max(0, order.findIndex((e) => e.id === electionId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) setQuery('');
  };

  const pick = (id: string) => {
    if (id !== electionId && !confirmDiscardEdits(editorDirty)) return;
    if (id !== electionId) setElectionId(id);
    setOpen(false);
  };

  const onInputKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, order.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = order[active];
      if (target) pick(target.id);
    }
  };

  if (elections.length === 0) return null;
  const current = elections.find((e) => e.id === electionId) ?? null;
  let idx = 0; // running index into `order` while rendering

  const chip = (e: Election) => {
    const i = idx++;
    const selected = e.id === electionId;
    return (
      <button
        key={`${i}-${e.id}`}
        type="button"
        role="option"
        aria-selected={selected}
        data-active={i === active}
        title={`${e.name} · ${e.status}`}
        onMouseEnter={() => setActive(i)}
        onClick={() => pick(e.id)}
        className={cn(
          'inline-flex h-7 items-center gap-1.5 rounded-control border px-2.5 text-xs font-medium tabular-nums',
          selected ? 'border-accent bg-accent text-white' : 'border-line bg-card text-ink hover:border-accent/50',
          i === active && !selected && 'border-accent ring-2 ring-accent/20',
          i === active && selected && 'ring-2 ring-accent/30',
        )}
      >
        {e.status !== 'Finalized' && <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[e.status])} aria-hidden />}
        {e.year}
      </button>
    );
  };

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger
        aria-label="Election"
        className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-subtle px-3 text-xs text-ink whitespace-nowrap hover:bg-line/50"
      >
        <span className={cn('h-2 w-2 rounded-full', current ? STATUS_DOT[current.status] : 'bg-muted')} aria-hidden />
        {current ? (
          <span>
            <span className="font-semibold">{electionGroup(current)}</span>
            <span className="text-ink-2"> · {current.type === 'LS' ? '' : 'Vidhan Sabha '}{current.year}</span>
            <span className="text-muted"> · {current.status}</span>
          </span>
        ) : <span className="text-muted">Choose election</span>}
        <ChevronDown size={14} className="text-muted" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          aria-label="Choose election"
          onOpenAutoFocus={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector('input')?.focus(); }}
          className="z-50 w-[440px] overflow-hidden rounded-card border border-line bg-card shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-line px-3">
            <Search size={14} className="text-muted" aria-hidden />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Search state, year or type…"
              aria-label="Search elections"
              aria-controls="election-picker-list"
              className="h-10 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted"
            />
            <Kbd>E</Kbd>
          </div>

          <div id="election-picker-list" ref={listRef} role="listbox" aria-label="Elections" className="max-h-[420px] overflow-y-auto p-2">
            {order.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted">No election matches “{query}”.</p>
            )}

            {pinned.length > 0 && (
              <section className="mb-2 border-b border-line pb-2">
                <h3 className="px-2 pb-1 text-[11px] font-medium text-muted">Live &amp; upcoming</h3>
                {pinned.map((e) => {
                  const i = idx++;
                  return (
                    <button
                      key={`p-${e.id}`}
                      type="button"
                      role="option"
                      aria-selected={e.id === electionId}
                      data-active={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => pick(e.id)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-control px-2 py-1.5 text-left text-xs',
                        i === active ? 'bg-accent-soft' : 'hover:bg-subtle',
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[e.status])} aria-hidden />
                      <span className="flex-1 font-medium text-ink">{pinnedLabel(e)}</span>
                      <span className={e.status === 'Live' ? 'font-medium text-ok-text' : 'text-warn-text'}>{e.status}</span>
                    </button>
                  );
                })}
              </section>
            )}

            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-3 rounded-control px-2 py-1">
                <span className="w-24 shrink-0 text-xs text-ink-2">{row.label}</span>
                <div className="flex flex-wrap gap-1.5">{row.elections.map(chip)}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 border-t border-line bg-subtle px-3 py-1.5 text-[11px] text-muted">
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden />Live</span>
            <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-warn" aria-hidden />Upcoming</span>
            <span className="ml-auto">↑↓ move · Enter select · Esc close</span>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
