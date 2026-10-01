import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './Input';
import { cn } from './cn';

interface PasswordInputProps extends Omit<InputProps, 'type'> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Password field with its own label and a show/hide toggle. Not wrapped in <Field>: Field's label wraps exactly
 * one control, and the toggle is a second one.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const uid = useId();
  const inputId = id ?? `${uid}-input`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const [shown, setShown] = useState(false);
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-ink-2">{label}</label>
      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          type={shown ? 'text' : 'password'}
          invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className="pr-10"
          {...props}
        />
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-control p-1.5 text-muted hover:text-ink"
        >
          {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
      {hint && !error && <p id={hintId} className="text-[11px] text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
});
