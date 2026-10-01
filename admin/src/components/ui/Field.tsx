import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from './cn';

/** Lets a control inside a Field point aria-describedby at the field's hint / error. */
export const FieldContext = createContext<{ describedBy?: string }>({});

/** Merge the Field's description ids with any caller-provided aria-describedby. */
export function useDescribedBy(own?: string): string | undefined {
  const { describedBy } = useContext(FieldContext);
  return [own, describedBy].filter(Boolean).join(' ') || undefined;
}

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
  const uid = useId();
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const describedBy = error ? errorId : hint ? hintId : undefined;
  return (
    <FieldContext.Provider value={{ describedBy }}>
      <div className={cn('space-y-1', className)}>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
          {children}
        </label>
        {hint && !error && <p id={hintId} className="text-[11px] text-muted">{hint}</p>}
        {error && <p id={errorId} role="alert" className="text-xs text-bad-text">{error}</p>}
      </div>
    </FieldContext.Provider>
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
