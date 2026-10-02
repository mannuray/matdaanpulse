import * as Dialog from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { BottomSheet } from './BottomSheet';

/** Seat / party dialog shell: centred on desktop, bottom sheet on mobile (spec D10). */
/** `leading` sits left of the title (e.g. a party logo); `titleSuffix` follows the title on its line (e.g. the abbreviation). */
export function DetailDialog({ open, title, onClose, header, leading, titleSuffix, children }: { open: boolean; title: string; onClose(): void; header?: ReactNode; leading?: ReactNode; titleSuffix?: ReactNode; children: ReactNode }) {
  const { t } = useTranslation();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { if (open) opener.current = document.activeElement as HTMLElement | null; }, [open]);
  if (!desktop) {
    return <BottomSheet open={open} onOpenChange={o => { if (!o) onClose(); }} title={title}>{leading || titleSuffix ? <div className="mb-2 flex items-center gap-3">{leading}{titleSuffix}</div> : null}{header}{children}</BottomSheet>;
  }
  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* Same z as the content: a later-opened dialog (later in the body) then dims every earlier one. */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm" />
        <Dialog.Content aria-describedby={undefined} onCloseAutoFocus={e => { e.preventDefault(); opener.current?.focus(); }}
          className="studio-root fixed left-1/2 top-1/2 z-50 flex max-h-[88vh] w-[min(760px,92vw)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-tile border border-line bg-tile shadow-2xl outline-none">
          <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {leading}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5">
                  <Dialog.Title className="font-display text-2xl font-bold uppercase tracking-wide text-ink">{title}</Dialog.Title>
                  {titleSuffix}
                </div>
                {header}
              </div>
            </div>
            <Dialog.Close className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted hover:bg-tile-raised hover:text-ink" aria-label={t('studio_close')}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" /></svg>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
