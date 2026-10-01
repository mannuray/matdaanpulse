import type { ReactNode } from 'react';

interface EntityPageProps {
  header: ReactNode;
  toolbar?: ReactNode;
  table: ReactNode;
  /** The record Sheet (or null). A `full` Sheet covers the body, which is `relative`. */
  panel?: ReactNode;
}

/**
 * Entity page layout: header, then a body with the list column (toolbar + table) and the panel column.
 * `tw-ui` sits on the header and list column only — Sheets carry their own, and a `legacyBody` Sheet
 * (manifest editor) must not inherit it. The list column is a bounded flex column (min-h-0) so the
 * DataTable's sticky header and inner scroll work.
 */
export function EntityPage({ header, toolbar, table, panel }: EntityPageProps) {
  return (
    <div className="flex h-full flex-col gap-4 bg-page p-6 font-sans text-ink">
      <div className="tw-ui">{header}</div>
      <div className="relative flex min-h-0 flex-1 gap-4">
        <div className="tw-ui flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {toolbar}
          {table}
        </div>
        {panel}
      </div>
    </div>
  );
}
