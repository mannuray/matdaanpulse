import * as Select from '@radix-ui/react-select';
import { cn } from './cn';

export function PickerSelect({ value, options, onChange, ariaLabel, placeholder, size = 'md' }: {
  value: string; options: { value: string; label: string }[]; onChange(v: string): void; ariaLabel: string; placeholder?: string; size?: 'md' | 'lg';
}) {
  return (
    <Select.Root value={value || undefined} onValueChange={onChange}>
      <Select.Trigger aria-label={ariaLabel} className={cn('inline-flex items-center', size === 'lg' ? 'h-11' : 'h-8', ' gap-2 rounded-full border border-line bg-page/60 px-3 text-sm font-medium text-ink hover:border-accent')}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-muted">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="studio-root z-50 max-h-80 overflow-hidden rounded-xl border border-line bg-tile shadow-2xl">
          <Select.Viewport className="p-1">
            {options.map(o => (
              <Select.Item key={o.value} value={o.value} className={cn('cursor-pointer select-none rounded-[0.5rem] px-3 text-sm', size === 'lg' ? 'flex min-h-11 items-center' : 'py-1.5', ' text-ink outline-none data-[highlighted]:bg-tile-raised data-[state=checked]:text-accent')}>
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
