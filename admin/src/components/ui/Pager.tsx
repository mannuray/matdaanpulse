import { Button } from './Button';

interface PagerProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Plural noun for the range text, e.g. "parties". */
  noun: string;
  onPage: (page: number) => void;
  /** Extra text after the range, e.g. "district filter applies to this page". */
  note?: string;
}

export function Pager({ page, totalPages, total, pageSize, noun, onPage, note }: PagerProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const fmt = (n: number) => n.toLocaleString('en-IN');
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-ink-2">
      <span className="tabular-nums">Showing {fmt(from)}–{fmt(to)} of {fmt(total)} {noun}{note ? ` · ${note}` : ''}</span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="px-1 tabular-nums">Page {page} of {totalPages}</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
