import { useId, type ReactNode } from 'react';
import { Badge } from '../ui/Badge';

/**
 * One manifest editor section. Always open (no collapse toggle — core content is never hidden behind a click):
 * title, count, optional badge and a one-line description, then the body.
 */
export function ManifestSection({
  title,
  description,
  count,
  badge,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-card border border-line bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-4 py-3">
        <h3 id={headingId} className="text-sm font-semibold text-ink">{title}</h3>
        {count !== undefined && count > 0 && <Badge tone="accent" className="tabular-nums">{count.toLocaleString('en-IN')}</Badge>}
        {badge}
        {description && <p className="w-full text-xs text-ink-2">{description}</p>}
      </header>
      <div className="space-y-2 p-4">{children}</div>
    </section>
  );
}
