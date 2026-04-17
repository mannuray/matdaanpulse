import { useState, useMemo, type ReactNode } from 'react';
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

export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="mf-empty">
      <span>{text}</span>
      {action}
    </div>
  );
}

export function ItemRow({ index, onRemove, onMoveUp, onMoveDown, showOrder, children }: {
  index: number; onRemove: () => void; onMoveUp?: () => void; onMoveDown?: () => void; showOrder?: boolean; children: ReactNode;
}) {
  return (
    <div className="mf-item">
      {showOrder && (
        <div className="mf-item-order">
          <button className="mf-order-btn" onClick={onMoveUp} title="Move up">&#9650;</button>
          <span className="mf-order-num">{index + 1}</span>
          <button className="mf-order-btn" onClick={onMoveDown} title="Move down">&#9660;</button>
        </div>
      )}
      <div className="mf-item-content">{children}</div>
      <button className="mf-remove-btn" onClick={onRemove} title="Remove">&times;</button>
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="mf-add-btn" onClick={onClick}>+ {label}</button>;
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
  maxWidth
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
}) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState(false);

  const selectedItem = useMemo(() => {
    if (!value || !options) return null;
    return options.find(o => o && getValue(o) === value);
  }, [options, value, getValue]);
  
  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    const opts = options || [];
    if (!q) return opts.filter(o => o != null).slice(0, 50);
    return opts.filter(o => o && filter(o, q)).slice(0, 50);
  }, [options, query, filter]);

  const displayValue = show ? query : (selectedItem ? getLabel(selectedItem) : '');

  return (
    <div className="mf-searchable-select" style={{ position: 'relative', width: '100%', maxWidth }}>
      <input
        className="form-input mf-input-sm"
        style={{ width: '100%' }}
        placeholder={placeholder}
        value={displayValue}
        onFocus={() => { setShow(true); setQuery(''); }}
        onBlur={() => setTimeout(() => setShow(false), 200)}
        onChange={e => setQuery(e.target.value)}
      />
      {show && (
        <div className="mf-dropdown" style={{ zIndex: 1000, position: 'absolute', top: '100%', left: 0, right: 0 }}>
          {(filtered ?? []).map(item => (
            <div 
              key={getValue(item)} 
              className="mf-dropdown-item" 
              onMouseDown={() => { 
                onSelect(getValue(item)); 
                setQuery(''); 
                setShow(false); 
              }}
            >
              {renderItem(item)}
            </div>
          ))}
          {(filtered ?? []).length === 0 && <div className="mf-dropdown-empty">No results found</div>}
        </div>
      )}
    </div>
  );
}

export function PartySearch({ parties, onSelect, placeholder = "+ Add Party..." }: { 
  parties: Party[]; 
  onSelect: (p: Party) => void;
  placeholder?: string;
}) {
  return (
    <SearchableSelect
      options={parties ?? []}
      onSelect={val => {
        const p = (parties ?? []).find(x => x && x.id === val);
        if (p) onSelect(p);
      }}
      placeholder={placeholder}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {p.color && <span className="mf-chip-dot" style={{ background: p.color }} />}
          <span style={{ fontWeight: 600 }}>{p.abbreviation || p.id}</span>
          <span className="mf-item-sub">{p.name}</span>
        </div>
      )}
      maxWidth={240}
    />
  );
}

// ── Chip Select ──

export function ChipSelect({ selected, options, onAdd, onRemove, renderChip }: {
  selected: string[];
  options: { value: string; label: string; color?: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  renderChip?: (id: string) => ReactNode;
}) {
  const [query, setQuery] = useState('');
  const [show, setShow] = useState(false);

  const opts = options ?? [];
  const sel = selected ?? [];

  const filtered = opts.filter(o =>
    o && !sel.includes(o.value) &&
    ((o.label || '').toLowerCase().includes((query || '').toLowerCase()) || (o.value || '').toLowerCase().includes((query || '').toLowerCase()))
  ).slice(0, 10);

  return (
    <div className="mf-chip-select">
      <div className="mf-chips">
        {sel.map(id => renderChip ? renderChip(id) : (
          <span key={id} className="mf-chip">
            {opts.find(o => o && o.value === id)?.label || id}
            <span className="mf-chip-x" onClick={() => onRemove(id)}>&times;</span>
          </span>
        ))}
      </div>
      <div className="mf-searchable-select" style={{ maxWidth: 200 }}>
        <input
          className="form-input mf-input-sm"
          placeholder="+ Search to add..."
          value={query}
          onFocus={() => setShow(true)}
          onBlur={() => setTimeout(() => setShow(false), 200)}
          onChange={e => setQuery(e.target.value)}
        />
        {show && query && (
          <div className="mf-dropdown" style={{ zIndex: 1000 }}>
            {(filtered ?? []).map(o => (
              <div key={o.value} className="mf-dropdown-item" onMouseDown={() => { onAdd(o.value); setQuery(''); setShow(false); }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {o.color && <span className="mf-chip-dot" style={{ background: o.color }} />}
                  {o.label}
                </div>
                <span className="mf-item-sub">{o.value}</span>
              </div>
            ))}
            {(filtered ?? []).length === 0 && <div className="mf-dropdown-empty">No matches</div>}
          </div>
        )}
      </div>
    </div>
  );
}
