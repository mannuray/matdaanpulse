import * as Select from '@radix-ui/react-select';

export function PickerSelect({ value, options, onChange, ariaLabel, placeholder }: {
  value: string; options: { value: string; label: string }[]; onChange(v: string): void; ariaLabel: string; placeholder?: string;
}) {
  return (
    <Select.Root value={value || undefined} onValueChange={onChange}>
      <Select.Trigger aria-label={ariaLabel} className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-page/60 px-3 text-sm font-medium text-ink hover:border-accent">
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="text-muted">▾</Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="studio-root z-50 max-h-80 overflow-hidden rounded-xl border border-line bg-tile shadow-2xl">
          <Select.Viewport className="p-1">
            {options.map(o => (
              <Select.Item key={o.value} value={o.value} className="cursor-pointer select-none rounded-lg px-3 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-tile-raised data-[state=checked]:text-accent">
                <Select.ItemText>{o.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
