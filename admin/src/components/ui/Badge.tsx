import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'accent' | 'ok' | 'warn' | 'bad' | 'muted';
const TONES: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok-text',
  warn: 'bg-warn-soft text-warn-text',
  bad: 'bg-bad-soft text-bad-text',
  muted: 'bg-subtle text-ink-2',
};

export function Badge({ tone = 'muted', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', TONES[tone], className)} {...props} />;
}

export type PillStatus = 'LEADING' | 'WON' | 'TRAILING' | 'LOST' | 'PENDING';
const PILL: Record<PillStatus, { tone: Tone; label: string }> = {
  LEADING: { tone: 'accent', label: 'Leading' },
  WON: { tone: 'ok', label: 'Won' },
  TRAILING: { tone: 'muted', label: 'Trailing' },
  LOST: { tone: 'muted', label: 'Lost' },
  PENDING: { tone: 'muted', label: 'Pending' },
};

export function StatusPill({ status, className }: { status: PillStatus; className?: string }) {
  const p = PILL[status];
  return <Badge tone={p.tone} className={className}>{p.label}</Badge>;
}
