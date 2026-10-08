import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** `offline`: SSE_OFFLINE_AFTER failed (re)connects in a row; the stream keeps retrying. */
export type LiveStreamState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline';
interface LiveStatus {
  live: LiveStreamState;
  setLive: (s: LiveStreamState) => void;
}

const Ctx = createContext<LiveStatus>({ live: 'idle', setLive: () => {} });

/** The Live Console reports its SSE stream state here; the top-bar pill reads it. */
export function LiveStatusProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveStreamState>('idle');
  const value = useMemo(() => ({ live, setLive }), [live]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useLiveStatus = () => useContext(Ctx);
