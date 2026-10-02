import { useState } from 'react';
import { cn } from './cn';

const DOT: Record<number, string> = { 16: 'h-2.5 w-2.5', 24: 'h-3 w-3', 40: 'h-4 w-4', 64: 'h-6 w-6' };

/** D1: logo / ECI symbol image, else (or on load error) the party colour dot. */
export function PartyMark({ mark, color, label, size = 16, className }: { mark: string | null; color: string | null; label: string; size?: 16 | 24 | 40 | 64; className?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (mark && failed !== mark) {
    return (
      <img src={mark} alt={label} width={size} height={size} loading="lazy" onError={() => setFailed(mark)}
        className={cn('shrink-0 rounded-[0.25rem] bg-white/90 object-contain p-px', className)} style={{ width: size, height: size }} />
    );
  }
  return <span data-party-dot aria-label={label} role="img" className={cn('shrink-0 rounded-full', DOT[size], className)} style={{ background: color ?? 'var(--color-fallback)' }} />;
}
