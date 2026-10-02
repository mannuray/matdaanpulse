import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { cn } from './cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectedKey?: string | null;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
}

/** One table style for every entity page: sticky header, hover, selected row, empty state. Scrolls inside its card. */
export function DataTable<T>({ label, columns, rows, rowKey, selectedKey, onRowClick, loading, empty, footer }: DataTableProps<T>) {
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onRowClick?.(row); }
  };
  const onClick = (e: MouseEvent<HTMLTableRowElement>, row: T) => {
    // React bubbles clicks out of portals (menus, dialogs opened from a cell); those are not row clicks.
    if (!e.currentTarget.contains(e.target as Node)) return;
    const inner = (e.target as Element).closest('button,a,input,select,textarea,label,[data-row-ignore]');
    if (inner && inner !== e.currentTarget && e.currentTarget.contains(inner)) return;
    onRowClick?.(row);
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-card shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto">
        <table aria-label={label} aria-busy={loading || undefined} className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-subtle">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('px-4 py-2.5 text-xs font-medium text-ink-2 shadow-[inset_0_-1px_0_var(--color-line)]', c.headerClassName)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const k = rowKey(row);
              const selected = k === selectedKey;
              return (
                <tr
                  key={k}
                  aria-selected={selected}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? (e) => onClick(e, row) : undefined}
                  onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                    selected && 'bg-accent-soft hover:bg-accent-soft',
                  )}
                >
                  {columns.map((c, i) => <td key={c.key} className={cn('px-4 py-2.5 text-ink', selected && i === 0 && 'shadow-[inset_4px_0_0_var(--color-accent)]', c.className)}>{c.cell(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="p-6">{empty ?? <p className="text-center text-sm text-muted">Nothing to show.</p>}</div>}
        {loading && rows.length === 0 && <p role="status" className="p-10 text-center text-sm text-muted">Loading…</p>}
      </div>
      {footer && <div className="border-t border-line">{footer}</div>}
    </div>
  );
}
