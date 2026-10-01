import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal yes/no for irreversible or live-affecting actions (Go live, Finalize). It sits above any open Sheet. */
export function ConfirmDialog({ open, title, description, confirmLabel, tone = 'danger', busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="tw-ui fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content className="tw-ui fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-card p-6 shadow-lg">
          <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-ink-2">{description}</Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
