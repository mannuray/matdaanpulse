import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export type SheetWidth = 'md' | 'full';

interface SheetProps {
  open: boolean;
  /** Close button or Esc. The page applies the unsaved-changes guard, then closes by navigating. */
  onRequestClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  width?: SheetWidth;
  footer?: ReactNode;
  children: ReactNode;
}

const WIDTH: Record<SheetWidth, string> = {
  md: 'w-[400px] shrink-0',
  full: 'absolute inset-0 z-20',
};

/**
 * Record panel: a NON-modal Radix Dialog rendered in place (no portal), as the right column of the page body
 * (`full` covers the body, which must be `relative`). No overlay, no focus trap; outside clicks never close it.
 */
export function Sheet({ open, onRequestClose, title, description, width = 'md', footer, children }: SheetProps) {
  const onEscape = (e: KeyboardEvent) => {
    e.preventDefault();
    // Esc inside an open combobox list closes that list only.
    if ((document.activeElement as HTMLElement | null)?.closest('[role="combobox"][aria-expanded="true"]')) return;
    onRequestClose();
  };
  return (
    <Dialog.Root open={open} modal={false} onOpenChange={(o) => { if (!o) onRequestClose(); }}>
      <Dialog.Content
        onEscapeKeyDown={onEscape}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn('tw-ui flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-sm', WIDTH[width])}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <Dialog.Title className="truncate text-lg font-semibold tracking-tight text-ink">{title}</Dialog.Title>
            <Dialog.Description className={cn('text-xs text-ink-2', !description && 'sr-only')}>{description ?? 'Record details'}</Dialog.Description>
          </div>
          <button type="button" aria-label="Close panel" onClick={onRequestClose} className="rounded-control p-1.5 text-muted hover:bg-subtle hover:text-ink">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-between gap-2 border-t border-line bg-subtle/60 px-4 py-3">{footer}</div>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
