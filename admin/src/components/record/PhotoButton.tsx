import { useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Camera, Loader2 } from 'lucide-react';
import { assetUrl } from '../../utils/asset-url';
import { useImageUpload } from '../../hooks/useImageUpload';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';
const ITEM = 'flex cursor-pointer select-none items-center rounded-control px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-subtle';

/** Record-header person photo: click for Upload photo / Remove. Upload happens on pick; the page saves the URL. */
export function PhotoButton({ name, ownerId, url, onChange, note, error }: {
  name: string; ownerId: string; url: string; onChange: (url: string) => void; note?: string; error?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const up = useImageUpload('person-photo', ownerId, onChange);
  const shownError = up.error ?? error ?? null;
  return (
    <div className="flex flex-col items-center gap-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={`Change photo of ${name}`} disabled={up.uploading}
            className="group relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border border-line bg-subtle text-xl font-semibold text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
              {url ? <img src={assetUrl(url)} alt={name} className="h-full w-full object-cover" /> : name.charAt(0)}
            </span>
            <span aria-hidden className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-ink-2 shadow-sm group-hover:text-accent">
              {up.uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className="z-50 min-w-[200px] max-w-[260px] rounded-card border border-line bg-card p-1 shadow-lg">
            {note && <p className="px-2.5 py-1.5 text-xs text-muted">{note}</p>}
            <DropdownMenu.Item className={ITEM} onSelect={() => { up.clearError(); input.current?.click(); }}>
              {url ? 'Upload new photo' : 'Upload photo'}
            </DropdownMenu.Item>
            {url && <DropdownMenu.Item className={ITEM} onSelect={() => { up.clearError(); onChange(''); }}>Remove</DropdownMenu.Item>}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label={`Upload photo of ${name}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void up.upload(f); e.target.value = ''; }} />
      {shownError && <p role="alert" className="max-w-[160px] text-center text-[11px] text-bad-text">{shownError}</p>}
    </div>
  );
}
