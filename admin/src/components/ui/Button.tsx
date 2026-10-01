import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'success' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
  success: 'bg-ok text-white hover:brightness-95 shadow-sm',
  outline: 'border border-line-strong bg-card text-ink hover:bg-subtle',
  ghost: 'text-ink-2 hover:bg-subtle hover:text-ink',
  danger: 'border border-bad/40 bg-card text-bad-text hover:bg-bad-soft',
};
const SIZES: Record<Size, string> = { sm: 'h-7 px-2.5 text-xs', md: 'h-9 px-4 text-sm' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...props}
    />
  );
});
