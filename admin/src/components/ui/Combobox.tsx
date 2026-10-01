import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface ComboOption { value: string; label: string; hint?: string }

interface ComboboxProps {
  label: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

const MAX_SHOWN = 100;

/** Searchable single select (no portal): type to filter, ↑/↓ to move, Enter to pick, Esc to close the list. */
export function Combobox({ label, options, value, onChange, placeholder, emptyText = 'No matches', className }: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, MAX_SHOWN);
  }, [options, query]);

  const close = () => { setOpen(false); setQuery(''); };
  const pick = (o: ComboOption) => { onChange(o.value); close(); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
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
        value={open ? query : selected?.label ?? ''}
        placeholder={open ? selected?.label ?? placeholder : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
        onBlur={close}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-control border border-line bg-card pl-3 pr-8 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-card border border-line bg-card p-1 shadow-lg">
          {matches.length === 0 && <li className="px-2.5 py-1.5 text-xs text-muted">{emptyText}</li>}
          {matches.map((o, i) => (
            <li
              key={o.value}
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
      )}
    </div>
  );
}
