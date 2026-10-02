import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';
import { assetUrl } from '../../utils/asset-url';
import { useImageUpload } from '../../hooks/useImageUpload';
import type { MediaKind } from '../../services/media.service';

export const fileNameOf = (url: string) => url.split('?')[0].split('/').filter(Boolean).pop() ?? '';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

/**
 * Image field with no URL text: preview tile, Replace (file picker, or drop a file on the tile), Remove.
 * Upload happens on pick; `onChange` gets the new URL ('' = removed) and the record saves it with Save changes.
 */
export function ImageUpload({ label, kind, ownerId, url, onChange, showFilename = true }: {
  label: string; kind: MediaKind; ownerId: string; url: string; onChange: (url: string) => void; showFilename?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { uploading, error, upload, clearError } = useImageUpload(kind, ownerId, onChange);
  const pick = (files: FileList | null | undefined) => { const f = files?.[0]; if (f) void upload(f); };

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-card border border-line p-3 text-center">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div
        data-testid="image-drop"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer?.files); }}
        className={cn('relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-card border bg-card p-1.5',
          over ? 'border-accent ring-2 ring-accent/30' : 'border-line')}
      >
        {url ? <img src={assetUrl(url)} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted">None</span>}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-card/70" aria-label="Uploading">
            <Loader2 size={18} className="animate-spin text-accent" aria-hidden />
          </span>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label={`Upload ${label}`}
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => { clearError(); input.current?.click(); }}>
          {url ? 'Replace' : 'Upload'}
        </Button>
        {url && <Button variant="ghost" size="sm" disabled={uploading} aria-label={`Remove ${label}`} onClick={() => { clearError(); onChange(''); }}>Remove</Button>}
      </div>
      {showFilename && url && (
        <span title={url} className="max-w-full truncate rounded-control bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-muted">{fileNameOf(url)}</span>
      )}
      {error && <p role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
}
