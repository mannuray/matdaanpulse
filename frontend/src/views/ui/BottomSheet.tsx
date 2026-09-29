import * as Dialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from './cn';

/** Small mobile sheet anchored to the bottom (menus, pickers) or the top (search) edge of the screen. */
export function BottomSheet({ open, onOpenChange, title, side = 'bottom', initialFocus, children }: {
  open: boolean; onOpenChange(o: boolean): void; title: string; side?: 'bottom' | 'top';
  /** CSS selector of the element to focus when the sheet opens (default: Radix picks the first control). */
  initialFocus?: string; children: ReactNode;
}) {
  const { t } = useTranslation();
  const content = useRef<HTMLDivElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-page/70 backdrop-blur-sm" />
        <Dialog.Content ref={content} aria-describedby={undefined}
          onOpenAutoFocus={initialFocus ? e => { e.preventDefault(); content.current?.querySelector<HTMLElement>(initialFocus)?.focus(); } : undefined}
          className={cn('studio-root fixed inset-x-0 z-50 flex max-h-[85dvh] flex-col border-line bg-tile outline-none',
            side === 'bottom' ? 'bottom-0 rounded-t-tile border-t' : 'top-0 rounded-b-tile border-b')}>
          <div className="flex items-center justify-between px-4 pt-2">
            <Dialog.Title className="font-display text-base font-bold uppercase tracking-wider text-ink">{title}</Dialog.Title>
            <Dialog.Close className="grid h-11 w-11 place-items-center rounded-full text-muted hover:bg-tile-raised hover:text-ink" aria-label={t('studio_close')}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" /></svg>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
