import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Input, type InputProps } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Party } from '../../types';

// ── Helpers ──

export function updateAt<T>(arr: T[], idx: number, patch: Partial<T>): T[] {
  return arr.map((item, i) => i === idx ? { ...item, ...patch } : item);
}

export function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

// ── Shared UI Components ──

/** Party / alliance colour swatch; a missing colour shows the strong border colour. */
export function ColorDot({ color }: { color?: string | null }) {
  return <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color || 'var(--color-line-strong)' }} />;
}

/** "Nothing here yet" note inside a section (not ui/EmptyState, which is a page-level block). */
export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-dashed border-line-strong bg-subtle px-3 py-2.5 text-xs text-muted">
      <span>{text}</span>
      {action}
    </div>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="shrink-0 rounded-control p-1 text-muted hover:bg-bad-soft hover:text-bad-text"
    >
      <X size={14} aria-hidden />
    </button>
  );
}

export function ItemRow({ index, onRemove, onMoveUp, onMoveDown, showOrder, children }: {
  index: number; onRemove: () => void; onMoveUp?: () => void; onMoveDown?: () => void; showOrder?: boolean; children: ReactNode;
}) {
  const n = index + 1;
  return (
    <div className="flex items-center gap-2 rounded-control border border-line bg-card px-2.5 py-2">
      {showOrder && (
        <div className="flex shrink-0 flex-col items-center">
          <button type="button" aria-label={`Move item ${n} up`} onClick={onMoveUp} className="rounded-control p-0.5 text-muted hover:bg-subtle hover:text-ink">
            <ChevronUp size={14} aria-hidden />
          </button>
          <span className="text-[11px] tabular-nums text-muted">{n}</span>
          <button type="button" aria-label={`Move item ${n} down`} onClick={onMoveDown} className="rounded-control p-0.5 text-muted hover:bg-subtle hover:text-ink">
            <ChevronDown size={14} aria-hidden />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      <RemoveButton label={`Remove item ${n}`} onClick={onRemove} />
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" className="text-accent hover:text-accent-hover" onClick={onClick}>
      <Plus size={14} aria-hidden />{label}
    </Button>
  );
}

/** A party or alliance chip with a labelled remove button. */
export function Chip({ label, color, onRemove, removeLabel }: { label: string; color?: string | null; onRemove: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card py-0.5 pl-2 pr-1 text-xs text-ink" style={color ? { borderColor: color } : undefined}>
      {color && <ColorDot color={color} />}
      {label}
      <button type="button" aria-label={removeLabel ?? `Remove ${label}`} onClick={onRemove} className="rounded-full p-0.5 text-muted hover:bg-subtle hover:text-ink">
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}

/**
 * A text field for values that are parsed as you type (seat lists, map centre). The typed text is kept while it
 * does not parse yet ("1," on the way to "1, 2"); a change from elsewhere (JSON tab, Cancel) replaces it.
 * `onCommit` saves what it can and returns the canonical text it saved, or null when nothing was saved.
 */
export function DraftInput({ value, onCommit, ...props }: Omit<InputProps, 'value' | 'onChange'> & { value: string; onCommit: (text: string) => string | null }) {
  const [text, setText] = useState(value);
  const expected = useRef(value);
  useEffect(() => {
    if (value !== expected.current) {
      expected.current = value;
      setText(value);
    }
  }, [value]);
  return (
    <Input
      {...props}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const saved = onCommit(e.target.value);
        if (saved !== null) expected.current = saved;
      }}
    />
  );
}

// ── Searchable Select Components ──

export function SearchableSelect<T>({
  value,
  options,
  onSelect,
  placeholder,
  getLabel,
  getValue,
  filter,
  renderItem,
  maxWidth,
  label,
}: {
  value?: string;
  options: T[];
  onSelect: (val: string) => void;
  placeholder?: string;
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  filter: (item: T, query: string) => boolean;
  renderItem: (item: T) => ReactNode;
  maxWidth?: number | string;
  /** Accessible name; defaults to the placeholder. */
  label?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [show, setShow] = useState(false);
  const name = label ?? placeholder ?? 'Search';

  const selectedItem = useMemo(() => {
    if (!value || !options) return null;
    return options.find(o => o && getValue(o) === value) ?? null;
  }, [options, value, getValue]);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    const opts = options || [];
    if (!q) return opts.filter(o => o != null).slice(0, 50);
    return opts.filter(o => o && filter(o, q)).slice(0, 50);
  }, [options, query, filter]);

  const close = () => { setShow(false); setQuery(''); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && show) { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown' && !show) { e.preventDefault(); setShow(true); }
  };

  return (
    <div className="relative w-full" style={maxWidth !== undefined ? { maxWidth } : undefined}>
      <Input
        role="combobox"
        aria-label={name}
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        className="h-8 text-xs"
        placeholder={placeholder}
        value={show ? query : (selectedItem ? getLabel(selectedItem) : '')}
        onFocus={() => { setShow(true); setQuery(''); }}
        onBlur={close}
        onChange={e => { setQuery(e.target.value); setShow(true); }}
        onClick={() => setShow(true)}
        onKeyDown={onKeyDown}
      />
      {show && (
        <ul id={listId} role="listbox" aria-label={name} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 list-none overflow-y-auto rounded-card border border-line bg-card p-1 shadow-lg">
          {filtered.map(item => (
            <li
              key={getValue(item)}
              role="option"
              aria-selected={getValue(item) === value}
              // mousedown (not click) runs before the input's blur closes the list
              onMouseDown={(e) => { e.preventDefault(); onSelect(getValue(item)); close(); }}
              className="cursor-pointer rounded-control px-2.5 py-1.5 text-xs text-ink hover:bg-accent-soft"
            >
              {renderItem(item)}
            </li>
          ))}
          {filtered.length === 0 && <li className="px-2.5 py-1.5 text-xs text-muted">No results found</li>}
        </ul>
      )}
    </div>
  );
}

export function PartySearch({ parties, onSelect, placeholder = 'Add party…', label = 'Add party' }: {
  parties: Party[];
  onSelect: (p: Party) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <SearchableSelect
      options={parties ?? []}
      onSelect={val => {
        const p = (parties ?? []).find(x => x && x.id === val);
        if (p) onSelect(p);
      }}
      placeholder={placeholder}
      label={label}
      getLabel={() => ''}
      getValue={p => p?.id || ''}
      filter={(p, q) =>
        p && (
          (p.name || '').toLowerCase().includes(q) ||
          (p.abbreviation || '').toLowerCase().includes(q) ||
          (p.id || '').toLowerCase().includes(q)
        )
      }
      renderItem={p => p && (
        <span className="flex items-center gap-1.5">
          {p.color && <ColorDot color={p.color} />}
          <span className="font-medium">{p.abbreviation || p.id}</span>
          <span className="truncate text-muted">{p.name}</span>
        </span>
      )}
      maxWidth={240}
    />
  );
}

// ── Chip Select ──

export function ChipSelect({ selected, options, onAdd, onRemove, renderChip, label = 'Search to add' }: {
  selected: string[];
  options: { value: string; label: string; color?: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  renderChip?: (id: string) => ReactNode;
  /** Accessible name of the search field. */
  label?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [show, setShow] = useState(false);

  const opts = options ?? [];
  const sel = selected ?? [];
  const q = (query || '').toLowerCase();
  const filtered = opts.filter(o =>
    o && !sel.includes(o.value) &&
    ((o.label || '').toLowerCase().includes(q) || (o.value || '').toLowerCase().includes(q))
  ).slice(0, 10);
  const open = show && !!query;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {sel.map(id => renderChip ? renderChip(id) : (
          <Chip key={id} label={opts.find(o => o && o.value === id)?.label || id} onRemove={() => onRemove(id)} />
        ))}
      </div>
      <div className="relative max-w-[200px]">
        <Input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-8 text-xs"
          placeholder="Search to add…"
          value={query}
          onFocus={() => setShow(true)}
          onBlur={() => setShow(false)}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); setQuery(''); } }}
        />
        {open && (
          <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 top-full z-30 mt-1 max-h-64 w-64 list-none overflow-y-auto rounded-card border border-line bg-card p-1 shadow-lg">
            {filtered.map(o => (
              <li
                key={o.value}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); onAdd(o.value); setQuery(''); }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-1.5 text-xs text-ink hover:bg-accent-soft"
              >
                <span className="flex items-center gap-1.5">{o.color && <ColorDot color={o.color} />}{o.label}</span>
                <span className="text-muted">{o.value}</span>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2.5 py-1.5 text-xs text-muted">No matches</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
