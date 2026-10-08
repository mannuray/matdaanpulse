import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface UnsavedEdits {
  /** A record panel or the Live Console seat editor has unsaved edits: the shell asks before leaving or switching election. */
  editorDirty: boolean;
  /** Each guarded editor reports under its own id, so one editor never overwrites another's dirty state. */
  markDirty: (ownerId: string, dirty: boolean) => void;
}

export const DISCARD_EDITS_PROMPT = 'Discard unsaved changes?';
/** True when it is fine to leave: nothing unsaved, or the user agreed to discard it. */
export const confirmDiscardEdits = (dirty: boolean) => !dirty || window.confirm(DISCARD_EDITS_PROMPT);

const Ctx = createContext<UnsavedEdits>({ editorDirty: false, markDirty: () => {} });

/** Editors report unsaved edits here (useUnsavedGuard); navigation guards read `editorDirty`. */
export function UnsavedEditsProvider({ children }: { children: ReactNode }) {
  const [dirtyOwners, setDirtyOwners] = useState<ReadonlySet<string>>(() => new Set());
  const markDirty = useCallback((ownerId: string, dirty: boolean) => {
    setDirtyOwners((prev) => {
      if (prev.has(ownerId) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(ownerId); else next.delete(ownerId);
      return next;
    });
  }, []);
  const editorDirty = dirtyOwners.size > 0;
  const value = useMemo(() => ({ editorDirty, markDirty }), [editorDirty, markDirty]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useUnsavedEdits = () => useContext(Ctx);
