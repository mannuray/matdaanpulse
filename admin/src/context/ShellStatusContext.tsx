import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type LiveStreamState = 'idle' | 'connecting' | 'open' | 'reconnecting';
interface ShellStatus {
  live: LiveStreamState;
  setLive: (s: LiveStreamState) => void;
  /** A record panel or the Live Console seat editor has unsaved edits: the shell asks before leaving or switching election. */
  editorDirty: boolean;
  /** Each guarded editor reports under its own id, so one editor never overwrites another's dirty state. */
  markDirty: (ownerId: string, dirty: boolean) => void;
}

export const DISCARD_EDITS_PROMPT = 'Discard unsaved changes?';
/** True when it is fine to leave: nothing unsaved, or the user agreed to discard it. */
export const confirmDiscardEdits = (dirty: boolean) => !dirty || window.confirm(DISCARD_EDITS_PROMPT);

const Ctx = createContext<ShellStatus>({ live: 'idle', setLive: () => {}, editorDirty: false, markDirty: () => {} });

/** Lets the Live Console report its SSE state (top-bar pill) and unsaved edits (navigation guards) to the shell. */
export function ShellStatusProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveStreamState>('idle');
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
  const value = useMemo(() => ({ live, setLive, editorDirty, markDirty }), [live, editorDirty, markDirty]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useShellStatus = () => useContext(Ctx);
