import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-2">{children}</kbd>;
}
