import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type LiveStreamState = 'idle' | 'connecting' | 'open' | 'reconnecting';
interface ShellStatus { live: LiveStreamState; setLive: (s: LiveStreamState) => void }

const Ctx = createContext<ShellStatus>({ live: 'idle', setLive: () => {} });

/** Lets the Live Console report its SSE state to the top-bar pill. */
export function ShellStatusProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveStreamState>('idle');
  const value = useMemo(() => ({ live, setLive }), [live]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useShellStatus = () => useContext(Ctx);
