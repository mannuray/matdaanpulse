import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from './cn';

export function PillToggle<T extends string>({ value, options, onChange, ariaLabel, size = 'md' }: {
  value: T; options: { value: T; label: string }[]; onChange(v: T): void; ariaLabel: string; size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <ToggleGroup.Root type="single" value={value} onValueChange={v => { if (v) onChange(v as T); }} aria-label={ariaLabel}
      className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full border border-line bg-page/60 p-0.5 [scrollbar-width:none]">
      {options.map(o => (
        <ToggleGroup.Item key={o.value} value={o.value}
          className={cn('shrink-0 rounded-full font-medium text-muted transition-colors hover:text-ink data-[state=on]:bg-accent data-[state=on]:text-page',
            size === 'sm' ? 'px-2.5 py-1 text-xs' : size === 'lg' ? 'min-h-11 px-4 text-sm' : 'px-3 py-1.5 text-sm')}>
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
