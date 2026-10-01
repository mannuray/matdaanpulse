import { useState, type ReactNode } from 'react';
import { formatIst } from '../../utils/time';
import type { LastEdit } from '../../types';
import { cn } from '../ui/cn';

interface RecordCardProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

/** A section of a record page: white card, 1px line border, sentence-case title with an optional muted subtitle. */
export function RecordCard({ title, subtitle, action, children }: RecordCardProps) {
  return (
    <section className="rounded-card border border-line bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // clipboard blocked (insecure context or permission): the id stays selectable
  }
}

interface RecordMetaProps {
  id: string;
  updatedAt?: string;
  lastEdit?: LastEdit | null;
}

/** Key/value list for the "Record" card: id (with copy), last updated, last edited by. All times IST. */
export function RecordMeta({ id, updatedAt, lastEdit }: RecordMetaProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!(await copyText(id))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  const edited = lastEdit
    ? [lastEdit.by, formatIst(lastEdit.at)].filter(Boolean).join(' · ')
    : 'No edits recorded';
  const updated = updatedAt ? formatIst(updatedAt) : '';
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-xs">
      <dt className="text-muted">Id</dt>
      <dd className="flex min-w-0 items-center justify-end gap-2">
        <span className="truncate font-mono text-ink">{id}</span>
        <button type="button" aria-label="Copy id" onClick={copy} className={cn('text-[11px] font-medium', copied ? 'text-ok-text' : 'text-accent hover:underline')}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </dd>
      <dt className="text-muted">Last updated</dt>
      <dd className="text-right text-ink">{updated || '—'}</dd>
      <dt className="text-muted">Last edited by</dt>
      <dd className="text-right text-ink">{edited}</dd>
    </dl>
  );
}
