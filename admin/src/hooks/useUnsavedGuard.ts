import { useEffect } from 'react';
import { useShellStatus } from '../context/ShellStatusContext';

/**
 * Unsaved-changes guard for one editor (a record panel or the Live Console seat editor).
 * Reports `dirty` to the shell (sidebar, election picker and ⌘K ask before leaving), arms the browser's
 * tab-close warning while dirty, and clears both on unmount. BrowserRouter has no useBlocker, so the
 * browser Back button is not guarded.
 */
export function useUnsavedGuard(dirty: boolean): void {
  const { setEditorDirty } = useShellStatus();

  useEffect(() => { setEditorDirty(dirty); }, [dirty, setEditorDirty]);
  useEffect(() => () => setEditorDirty(false), [setEditorDirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
