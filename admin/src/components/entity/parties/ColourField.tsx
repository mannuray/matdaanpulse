import { Input } from '../../ui/Input';

const HEX = /^#[0-9a-f]{6}$/i;

/** Colour picker + hex text, kept in sync. The picker needs a valid #rrggbb, so it falls back to slate. */
export function ColourField({ value, error, onChange }: { value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <span className="mb-1 block text-xs font-medium text-ink-2">Colour</span>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label="Colour picker"
          value={HEX.test(value) ? value : '#94a3b8'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-control border border-line bg-card p-1"
        />
        <Input aria-label="Colour" value={value} invalid={!!error} placeholder="#4f46e5" className="font-mono" onChange={(e) => onChange(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
}
