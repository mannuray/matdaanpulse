import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type LiveStreamState = 'idle' | 'connecting' | 'open' | 'reconnecting';
interface ShellStatus {
  live: LiveStreamState;
  setLive: (s: LiveStreamState) => void;
  /** A record panel or the Live Console seat editor has unsaved edits: the shell asks before leaving or switching election. */
  editorDirty: boolean;
  setEditorDirty: (dirty: boolean) => void;
}

export const DISCARD_EDITS_PROMPT = 'Discard unsaved changes?';
/** True when it is fine to leave: nothing unsaved, or the user agreed to discard it. */
export const confirmDiscardEdits = (dirty: boolean) => !dirty || window.confirm(DISCARD_EDITS_PROMPT);

const Ctx = createContext<ShellStatus>({ live: 'idle', setLive: () => {}, editorDirty: false, setEditorDirty: () => {} });

/** Lets the Live Console report its SSE state (top-bar pill) and unsaved edits (navigation guards) to the shell. */
export function ShellStatusProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveStreamState>('idle');
  const [editorDirty, setEditorDirty] = useState(false);
  const value = useMemo(() => ({ live, setLive, editorDirty, setEditorDirty }), [live, editorDirty]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useShellStatus = () => useContext(Ctx);
