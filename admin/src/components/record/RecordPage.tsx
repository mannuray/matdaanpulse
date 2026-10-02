import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

interface RecordPageProps {
  backLabel: string;
  onBack: () => void;
  leading?: ReactNode;
  title: ReactNode;
  tags?: ReactNode;
  meta?: ReactNode;
  dirty: boolean;
  saving: boolean;
  canSave?: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  /** Rendered before Cancel (e.g. Merge). */
  headerActions?: ReactNode;
  main: ReactNode;
  aside: ReactNode;
  loading?: boolean;
  error?: ReactNode;
}

/**
 * Shared layout of the Party, Person, Candidate and Constituency record pages: back link, header (leading visual,
 * title, tags, meta; dirty status, Cancel, Save), then a 2fr/1fr grid of form cards and related cards. It scrolls itself.
 * Enter in a text input of `main` saves when the form is dirty.
 */
export function RecordPage({
  backLabel, onBack, leading, title, tags, meta, dirty, saving, canSave = true, onCancel, onSave, saveLabel,
  headerActions, main, aside, loading, error,
}: RecordPageProps) {
  const submit = () => {
    if (dirty && canSave && !saving) onSave();
  };
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    const t = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.defaultPrevented || t.tagName !== 'INPUT') return;
    if (['checkbox', 'radio', 'button', 'submit'].includes((t as HTMLInputElement).type)) return;
    e.preventDefault();
    submit();
  };

  return (
    <div className="h-full overflow-y-auto bg-page p-6 font-sans text-ink">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-ink-2 hover:text-ink">
        <ArrowLeft size={14} aria-hidden />{backLabel}
      </button>
      {error ? (
        <div role="alert" className="rounded-card border border-bad/40 bg-bad-soft p-4 text-sm text-bad-text">{error}</div>
      ) : loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (
        <>
          <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
            <div className="flex min-w-0 items-center gap-4">
              {leading}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <h1 className="text-2xl font-semibold break-words text-ink">{title}</h1>
                  {tags}
                </div>
                {meta && <div className="mt-1 text-sm text-ink-2">{meta}</div>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-control px-2.5 py-1 text-xs font-medium',
                  dirty ? 'border border-warn/40 bg-warn-soft text-warn-text' : 'text-muted',
                )}
              >
                {dirty && <span className="h-2 w-2 rounded-full bg-warn" aria-hidden />}
                {dirty ? 'Unsaved changes' : 'No changes'}
              </span>
              {headerActions}
              <Button variant="outline" disabled={!dirty || saving} onClick={onCancel}>Cancel</Button>
              <Button variant="primary" disabled={!dirty || !canSave || saving} onClick={onSave}>{saving ? 'Saving…' : saveLabel ?? 'Save changes'}</Button>
            </div>
          </header>
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[2fr_1fr]">
            <form className="flex min-w-0 flex-col gap-6" onSubmit={(e) => { e.preventDefault(); submit(); }} onKeyDown={onKeyDown}>
              {main}
            </form>
            <div className="flex min-w-0 flex-col gap-6">{aside}</div>
          </div>
        </>
      )}
    </div>
  );
}
