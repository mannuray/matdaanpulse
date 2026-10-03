import * as Dialog from '@radix-ui/react-dialog';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export function FocusDialog({ open, title, onClose, children }: { open: boolean; title: string; onClose(): void; children: ReactNode }) {
  const { t } = useTranslation();
  // Dialog has no Trigger here, so Radix would drop focus to <body> on close; restore it to the opener ourselves.
  const opener = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { if (open) opener.current = document.activeElement as HTMLElement | null; }, [open]);
  return (
    <Dialog.Root open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* Same z as the content: a later-opened dialog (later in the body) then dims every earlier one. */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          onCloseAutoFocus={e => { e.preventDefault(); opener.current?.focus(); }}
          className="studio-root studio-focus fixed left-1/2 top-1/2 z-50 flex h-[88vh] w-[90vw] max-w-[1400px] -translate-x-1/2 -translate-y-1/2 flex-col rounded-tile border border-line bg-tile shadow-2xl outline-none max-lg:h-dvh max-lg:w-screen max-lg:rounded-none"
        >
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <Dialog.Title className="font-display text-xl font-bold uppercase tracking-wide text-ink">{title}</Dialog.Title>
            <Dialog.Close className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-tile-raised hover:text-ink" aria-label={t('studio_close')}>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden><path d="M4.3 4.3a1 1 0 011.4 0L10 8.6l4.3-4.3a1 1 0 111.4 1.4L11.4 10l4.3 4.3a1 1 0 01-1.4 1.4L10 11.4l-4.3 4.3a1 1 0 01-1.4-1.4L8.6 10 4.3 5.7a1 1 0 010-1.4z" /></svg>
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
