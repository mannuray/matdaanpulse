import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from './cn';

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-card p-3 shadow-sm">{children}</div>;
}

interface SearchInputProps { value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string }

export function SearchInput({ value, onChange, label, placeholder, className }: SearchInputProps) {
  return (
    <label className={cn('relative block min-w-56 flex-1', className)}>
      <span className="sr-only">{label}</span>
      <Search size={14} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-control border border-line bg-card pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}

export interface ChipOption<V extends string> { value: V; label: string; count?: number }

export function ChipGroup<V extends string>({ label, options, value, onChange }: { label: string; options: ChipOption<V>[]; value: V; onChange: (v: V) => void }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center rounded-control border border-line bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-control px-3 py-1 text-xs font-medium whitespace-nowrap', o.value === value ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink')}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 tabular-nums opacity-80">{o.count.toLocaleString('en-IN')}</span>}
        </button>
      ))}
    </div>
  );
}
