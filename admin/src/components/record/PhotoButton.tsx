import { useId, useRef } from 'react';
import { Camera, Loader2, X } from 'lucide-react';
import { cn } from '../ui/cn';
import { assetUrl } from '../../utils/asset-url';
import { useImageUpload } from '../../hooks/useImageUpload';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

/**
 * Record-header person photo: click it to upload/replace, corner ⓧ to remove. Upload happens on pick; the page saves the URL.
 * `note` is shown as the photo's tooltip and read as its description.
 */
export function PhotoButton({ name, ownerId, url, onChange, note, error }: {
  name: string; ownerId: string; url: string; onChange: (url: string) => void; note?: string; error?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const noteId = useId();
  const up = useImageUpload('person-photo', ownerId, onChange);
  const shownError = up.error ?? error ?? null;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {/* aria-disabled, not disabled, while uploading: keeps focus on the button. */}
        <button type="button" aria-label={url ? `Change photo of ${name}` : `Upload photo of ${name}`}
          aria-disabled={up.uploading || undefined} title={note} aria-describedby={note ? noteId : undefined}
          onClick={() => { if (up.uploading) return; up.clearError(); input.current?.click(); }}
          className={cn('group relative flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-xl font-semibold text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
            up.uploading ? 'cursor-progress' : 'cursor-pointer')}>
          {url ? <img src={assetUrl(url)} alt={name} className="h-full w-full object-cover" /> : name.charAt(0)}
          {!up.uploading && (
            <span aria-hidden className="absolute inset-0 flex items-center justify-center bg-ink/50 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={18} />
            </span>
          )}
        </button>
        {up.uploading && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-card/70" role="status" aria-label="Uploading">
            <Loader2 size={18} className="animate-spin text-accent" aria-hidden />
          </span>
        )}
        {url && (
          <button type="button" aria-label={`Remove photo of ${name}`} aria-disabled={up.uploading || undefined}
            onClick={() => { if (up.uploading) return; up.clearError(); onChange(''); }}
            className="absolute -right-1.5 -top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-line bg-card text-ink-2 shadow-sm outline-none hover:text-bad-text focus-visible:ring-2 focus-visible:ring-accent/40">
            <X size={12} aria-hidden />
          </button>
        )}
        {note && <span id={noteId} className="sr-only">{note}</span>}
      </div>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" tabIndex={-1} aria-label={`Photo file of ${name}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f && !up.uploading) void up.upload(f); e.target.value = ''; }} />
      {shownError && <p role="alert" className="max-w-[160px] text-center text-[11px] text-bad-text">{shownError}</p>}
    </div>
  );
}
