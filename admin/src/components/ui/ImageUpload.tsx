import { useRef, useState } from 'react';
import { Camera, Loader2, Upload, X } from 'lucide-react';
import { cn } from './cn';
import { assetUrl } from '../../utils/asset-url';
import { useImageUpload } from '../../hooks/useImageUpload';
import type { MediaKind } from '../../services/media.service';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

/**
 * Image field with no URL text: click the tile (or drop a file on it) to upload/replace, corner ⓧ to remove.
 * Upload happens on pick; `onChange` gets the new URL ('' = removed) and the record saves it with Save changes.
 */
export function ImageUpload({ label, kind, ownerId, url, onChange }: {
  label: string; kind: MediaKind; ownerId: string; url: string; onChange: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { uploading, error, upload, clearError } = useImageUpload(kind, ownerId, onChange);
  const pick = (files: FileList | null | undefined) => { const f = files?.[0]; if (f && !uploading) void upload(f); };

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-card border border-line p-3 text-center">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div
        data-testid="image-drop"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer?.files); }}
        className="relative"
      >
        {/* aria-disabled, not disabled, while uploading: keeps focus on the button. */}
        <button
          type="button"
          aria-label={url ? `Replace ${label}` : `Upload ${label}`}
          aria-disabled={uploading || undefined}
          onClick={() => { if (uploading) return; clearError(); input.current?.click(); }}
          className={cn('group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-card bg-card p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            url ? 'border' : 'border border-dashed',
            over ? 'border-accent ring-2 ring-accent/30' : url ? 'border-line' : 'border-line-strong hover:border-accent',
            uploading ? 'cursor-progress' : 'cursor-pointer')}
        >
          {url
            ? <img src={assetUrl(url)} alt={label} className="max-h-full max-w-full object-contain" />
            : <span className="flex flex-col items-center gap-1 text-[11px] text-muted group-hover:text-accent"><Upload size={16} aria-hidden />Upload</span>}
          {url && !uploading && (
            <span aria-hidden className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-ink/50 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={14} />Replace
            </span>
          )}
        </button>
        {uploading && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-card bg-card/70" role="status" aria-label="Uploading">
            <Loader2 size={18} className="animate-spin text-accent" aria-hidden />
          </span>
        )}
        {url && (
          <button
            type="button"
            aria-label={`Remove ${label}`}
            aria-disabled={uploading || undefined}
            onClick={() => { if (uploading) return; clearError(); onChange(''); }}
            className="absolute -right-1.5 -top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-card text-ink-2 shadow-sm outline-none hover:text-bad-text focus-visible:ring-2 focus-visible:ring-accent/40"
          >
            <X size={12} aria-hidden />
          </button>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-label={`${label} file`}
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      {error && <p role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
}
