import type { ReactNode } from 'react';
import { LiveStatusProvider } from './LiveStatusContext';
import { UnsavedEditsProvider } from './UnsavedEditsContext';

/**
 * The shell's two status channels, as separate contexts so a reader of one never re-renders on the other:
 * the Live Console's SSE state (useLiveStatus, top-bar pill) and unsaved edits (useUnsavedEdits, navigation guards).
 */
export function ShellStatusProvider({ children }: { children: ReactNode }) {
  return (
    <LiveStatusProvider>
      <UnsavedEditsProvider>{children}</UnsavedEditsProvider>
    </LiveStatusProvider>
  );
}
