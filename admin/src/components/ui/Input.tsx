import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const CONTROL =
  'w-full rounded-control border bg-card px-3 text-sm text-ink placeholder:text-muted ' +
  'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-subtle disabled:text-muted';
const edge = (invalid?: boolean) => (invalid ? 'border-bad' : 'border-line');

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { invalid?: boolean }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...props }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(CONTROL, 'h-9', edge(invalid), className)} {...props} />;
});

/** Native <select>: keyboard + screen-reader behaviour for free, and testable with fireEvent.change. */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { invalid?: boolean }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, className, children, ...props }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cn(CONTROL, 'h-9 pr-8', edge(invalid), className)} {...props}>
      {children}
    </select>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { invalid?: boolean }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(CONTROL, 'py-2 leading-relaxed', edge(invalid), className)} {...props} />;
});
