import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

interface FormDialogProps {
  open: boolean;
  /** Close button, Esc or an outside click. The page applies the unsaved-changes guard, then closes. */
  onRequestClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}

/** Centred modal form for small records edited rarely (e.g. elections): same props as Sheet, minus width. */
export function FormDialog({ open, onRequestClose, title, description, footer, children }: FormDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onRequestClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content
          // Esc and outside clicks go through the guard; Radix must not close on its own.
          onEscapeKeyDown={(e) => { e.preventDefault(); onRequestClose(); }}
          onInteractOutside={(e) => { e.preventDefault(); onRequestClose(); }}
          className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[480px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-panel border border-line bg-card shadow-lg"
        >
          <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-semibold text-ink">{title}</Dialog.Title>
              {description
                ? <Dialog.Description className="mt-0.5 text-xs text-muted">{description}</Dialog.Description>
                : <Dialog.Description className="sr-only">Edit form</Dialog.Description>}
            </div>
            <button type="button" aria-label="Close" onClick={onRequestClose} className="rounded-control p-1 text-muted hover:bg-subtle hover:text-ink">
              <X size={16} aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
