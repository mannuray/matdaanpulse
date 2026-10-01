import * as Dialog from '@radix-ui/react-dialog';
import { CircleHelp, X } from 'lucide-react';
import { Kbd } from '../ui/Kbd';

const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Search seats, candidates, parties, persons'],
  [['↑', '↓'], 'Move between seats (Live console)'],
  [['Enter'], 'Save seat / open the focused row'],
  [['Esc'], 'Discard seat edits / close the record panel'],
  [['/'], 'Jump to seat search'],
];

export function ShortcutsDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger aria-label="Keyboard shortcuts" className="rounded-control p-1 text-ink-2 hover:bg-subtle hover:text-ink">
        <CircleHelp size={18} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="tw-ui fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content className="tw-ui fixed left-1/2 top-1/2 z-50 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-card p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close aria-label="Close" className="text-muted hover:text-ink"><X size={16} /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Shortcuts available in the admin panel</Dialog.Description>
          <ul className="space-y-2.5 text-sm text-ink-2">
            {SHORTCUTS.map(([keys, what]) => (
              <li key={what} className="flex items-center justify-between gap-4">
                <span>{what}</span>
                <span className="flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
