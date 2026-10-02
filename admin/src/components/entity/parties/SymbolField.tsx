import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { assetUrl } from '../../../utils/asset-url';

/** Image URL with a live preview (always visible — no click-to-reveal). */
export function SymbolField({ label, url, error, onChange }: { label: string; url: string; error?: string; onChange: (url: string) => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-card p-1.5">
        {url ? <img src={assetUrl(url)} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted">None</span>}
      </div>
      <Field label={label} error={error} className="min-w-0 flex-1">
        <Input value={url} placeholder="https://…" onChange={(e) => onChange(e.target.value)} />
      </Field>
      {url && <Button variant="ghost" size="sm" className="mt-5" aria-label={`Remove ${label}`} onClick={() => onChange('')}>Remove</Button>}
    </div>
  );
}
