import type { ReactNode } from 'react';

export function PageHeader({ title, count, subtitle, actions }: { title: string; count?: number; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {count !== undefined && (
          <span className="rounded-full border border-line bg-subtle px-2.5 py-0.5 text-xs font-medium tabular-nums text-ink-2">{count.toLocaleString('en-IN')}</span>
        )}
        {subtitle && <p className="truncate text-xs text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
