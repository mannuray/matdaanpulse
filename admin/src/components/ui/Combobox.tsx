import { useEffect, useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';
import { useDescribedBy } from './Field';

export interface ComboOption { value: string; label: string; hint?: string }

interface ComboboxProps {
  label: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  invalid?: boolean;
  className?: string;
}

const MAX_SHOWN = 100;

/** Options matching `query`, capped at MAX_SHOWN; the selected option is always kept (appended when past the cap). */
function shownOptions(options: ComboOption[], query: string, value: string) {
  const q = query.trim().toLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const shown = filtered.slice(0, MAX_SHOWN);
  const selected = filtered.find((o) => o.value === value);
  if (selected && !shown.includes(selected)) shown.push(selected);
  return { shown, total: filtered.length };
}

/** Searchable single select (no portal): type to filter, ↑/↓ to move, Enter to pick, Esc to close the list. */
export function Combobox({ label, options, value, onChange, placeholder, emptyText = 'No matches', invalid, className }: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rawActive, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);
  const { shown: matches, total } = useMemo(() => shownOptions(options, query, value), [options, query, value]);
  // The options can shrink while the list is open: keep the active option inside the list.
  const active = Math.min(rawActive, Math.max(0, matches.length - 1));
  useEffect(() => { if (rawActive !== active) setActive(active); }, [rawActive, active]);

  const describedBy = useDescribedBy();
  const optionId = (i: number) => `${listId}-${i}`;
  const activeId = open && matches[active] ? optionId(active) : undefined;

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const startIndex = () => {
    const i = shownOptions(options, '', value).shown.findIndex((o) => o.value === value);
    return i >= 0 ? i : 0;
  };
  const openList = () => { setOpen(true); setQuery(''); setActive(startIndex()); };
  const close = () => { setOpen(false); setQuery(''); };
  const pick = (o: ComboOption) => { onChange(o.value); close(); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openList(); else setActive(Math.max(0, Math.min(active + 1, matches.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) openList(); else setActive(Math.max(0, active - 1));
    }
    else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); close(); }
  };

  return (
    <div className={cn('relative', className)}>
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={open ? query : selected?.label ?? ''}
        placeholder={open ? selected?.label ?? placeholder : placeholder}
        onFocus={openList}
        onBlur={close}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKeyDown}
        className={cn('h-9 w-full rounded-control border bg-card pl-3 pr-8 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent', invalid ? 'border-bad' : 'border-line')}
      />
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
      {open && (
        // mousedown on the footer or padding must not blur the input (which closes the list)
        <div onMouseDown={(e) => e.preventDefault()} className="absolute left-0 right-0 top-full z-30 mt-1 rounded-card border border-line bg-card p-1 shadow-lg">
          <ul id={listId} role="listbox" aria-label={label} className="max-h-72 overflow-y-auto">
            {matches.length === 0 && <li className="px-2.5 py-1.5 text-xs text-muted">{emptyText}</li>}
            {matches.map((o, i) => (
              <li
                key={o.value}
                id={optionId(i)}
                role="option"
                aria-selected={o.value === value}
                // mousedown (not click) runs before the input's blur closes the list
                onMouseDown={(e) => { e.preventDefault(); pick(o); }}
                onMouseEnter={() => setActive(i)}
                className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-1.5 text-xs text-ink', i === active && 'bg-accent-soft')}
              >
                <span className="truncate">{o.label}</span>
                {o.hint && <span className="shrink-0 text-muted">{o.hint}</span>}
              </li>
            ))}
          </ul>
          {total > matches.length && (
            <p className="border-t border-line px-2.5 pb-0.5 pt-1.5 text-[11px] text-muted">
              Type to narrow — showing {matches.length.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
