import type { ReactNode } from 'react';
import { cn } from './cn';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  /** Exactly one control: the label wraps it (implicit association). */
  children: ReactNode;
}

/** Label + one control, with the field's error underneath. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
        {children}
      </label>
      {hint && !error && <p className="text-[11px] text-muted">{hint}</p>}
      {error && <p role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
}

/** A titled group of fields inside a panel. */
export function FormSection({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn('space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0', className)}>
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}
