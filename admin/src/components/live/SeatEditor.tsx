import { forwardRef, useImperativeHandle, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { StatusPill } from '../ui/Badge';
import { cn } from '../ui/cn';
import { useSeatEditor } from '../../hooks/useSeatEditor';
import { isNota, seatStatus } from '../../utils/seat-math';
import { OVERRIDE_STATUSES, type OverrideStatus } from '../../utils/override-validation';
import type { SeatLockState } from '../../hooks/useSeatLock';
import type { SeatSave } from '../../hooks/useLiveConsole';
import type { LiveConstituency, SeatLock } from '../../types';

export interface SeatEditorHandle { save(): void; discard(): void; dirty: boolean }

interface Props {
  seat: LiveConstituency;
  saving: boolean;
  lastSavedAt?: string;
  lock: { state: SeatLockState; holder: SeatLock | null; takeOver(): Promise<void> };
  onSave(constId: string, payload: SeatSave): Promise<boolean>;
}

const STATUS_LABEL: Record<OverrideStatus, string> = { LEADING: 'Leading', TRAILING: 'Trailing', WON: 'Won', LOST: 'Lost' };
const fmt = (n: number) => n.toLocaleString('en-IN');
const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB') : null);

export const SeatEditor = forwardRef<SeatEditorHandle, Props>(function SeatEditor({ seat, saving, lastSavedAt, lock, onSave }, ref) {
  const ed = useSeatEditor(seat);
  const [error, setError] = useState<string | null>(null);
  const readOnly = lock.state === 'locked';

  const submit = async (declare: boolean) => {
    if (readOnly) return;
    const out = ed.build(declare);
    if (!out.ok) { setError(out.error); return; }
    setError(null);
    if (await onSave(seat.const_id, { overrides: out.overrides, rounds: out.rounds })) ed.markSaved();
  };

  useImperativeHandle(ref, () => ({ save: () => void submit(false), discard: ed.discard, dirty: ed.dirty }));

  const cur = Number(ed.round.current) || 0;
  const tot = Number(ed.round.total) || 0;
  const roundPct = tot > 0 ? Math.min(100, Math.round((cur / tot) * 100)) : 0;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden rounded-card border border-line bg-card p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-ink">#{seat.const_no} {seat.const_name}</h2>
          <span className="rounded-control border border-line bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{seat.const_type}</span>
          <StatusPill status={seatStatus(seat)} />
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-2">
          <label className="flex items-center gap-1.5">
            Round
            <input aria-label="Current round" inputMode="numeric" value={ed.round.current} disabled={readOnly}
              onChange={(e) => ed.setRound('current', e.target.value)}
              className="h-7 w-11 rounded-control border border-line text-center tabular-nums focus:border-accent focus:outline-none" />
            of
            <input aria-label="Total rounds" inputMode="numeric" value={ed.round.total} disabled={readOnly}
              onChange={(e) => ed.setRound('total', e.target.value)}
              className="h-7 w-11 rounded-control border border-line text-center tabular-nums focus:border-accent focus:outline-none" />
          </label>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${roundPct}%` }} /></div>
          {time(lastSavedAt) && <span className="flex items-center gap-1 text-muted"><RefreshCw size={12} aria-hidden />Last saved {time(lastSavedAt)}</span>}
        </div>
      </header>

      {readOnly && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-card border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn-text">
          <span className="flex items-center gap-2"><Lock size={14} aria-hidden />Locked · {lock.holder?.user_name ?? 'another editor'} is editing this seat</span>
          <Button size="sm" variant="outline" onClick={() => void lock.takeOver()}>Take over</Button>
        </div>
      )}
      {ed.changedElsewhere && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-card border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent">
          This seat changed elsewhere while you were editing.
          <Button size="sm" variant="outline" onClick={ed.discard}>Reload</Button>
        </div>
      )}

      <div className="min-h-0 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium text-ink-2">
              <th className="py-2.5 pl-3 font-medium">Candidate</th>
              <th className="px-3 py-2.5 text-right font-medium">Votes</th>
              <th className="py-2.5 pr-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ed.rows.map((r) => (
              <tr key={r.result_id} className={cn(r.result_id === ed.leaderId && 'bg-accent-soft/40')}>
                <td className="py-2.5 pl-3">
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.party_color ?? '#94a3b8' }} aria-hidden />
                    <span className={cn('text-ink', r.result_id === ed.leaderId ? 'font-semibold' : 'font-medium', isNota(r) && 'text-ink-2')}>{r.candidate_name}</span>
                    {!isNota(r) && <span className="rounded-control border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{r.party_abbr ?? r.party_id}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`Votes for ${r.candidate_name}`}
                    aria-invalid={!!r.error}
                    value={r.draftVotes}
                    disabled={readOnly}
                    onChange={(e) => ed.setVotes(r.result_id, e.target.value)}
                    className={cn(
                      'h-8 w-36 rounded-control border bg-card px-2.5 text-right font-medium tabular-nums text-ink focus:outline-none',
                      r.error ? 'border-bad focus:border-bad' : 'border-line-strong focus:border-accent',
                    )}
                  />
                  {r.error && <div className="mt-1 text-[11px] text-bad-text">{r.error}</div>}
                </td>
                <td className="py-2.5 pr-3 text-right">
                  {isNota(r) ? <span className="text-xs text-muted">—</span> : (
                    <select
                      aria-label={`Status for ${r.candidate_name}`}
                      value={r.status}
                      disabled={readOnly}
                      onChange={(e) => ed.setStatus(r.result_id, e.target.value as OverrideStatus)}
                      className="h-8 rounded-control border border-line bg-subtle px-2 text-xs font-medium text-ink-2 focus:border-accent focus:outline-none"
                    >
                      {OVERRIDE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-6 rounded-card border border-line bg-page px-4 py-3 text-xs text-ink-2">
        <span>Margin: <span className="text-sm font-bold tabular-nums text-accent">{ed.tie ? 'Tie' : `+${fmt(ed.margin)}`}</span> <span className="text-muted">(calculated)</span></span>
        <span className="h-3 w-px bg-line-strong" aria-hidden />
        <span>Total votes: <span className="text-sm font-semibold tabular-nums text-ink">{fmt(ed.totalVotes)}</span></span>
      </div>

      {error && <p role="alert" className="text-sm text-bad-text">{error}</p>}

      <footer className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            <Lock size={13} className="text-muted" aria-hidden />
            {lock.state === 'held' ? 'You are editing · lock held'
              : lock.state === 'unavailable' ? 'Seat locking unavailable — others may edit at the same time'
              : lock.state === 'locked' ? 'Read only' : 'Taking lock…'}
          </span>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" onClick={ed.discard} disabled={!ed.dirty || saving}>Discard</Button>
            <Button variant="primary" onClick={() => void submit(false)} disabled={saving || readOnly}>Save seat</Button>
            <Button variant="success" onClick={() => void submit(true)} disabled={saving || readOnly || !ed.leaderId}>Declare won</Button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 text-[11px] text-muted">
          <span>Navigate:</span><Kbd>↑</Kbd><Kbd>↓</Kbd><span aria-hidden>|</span><Kbd>Enter</Kbd><span>save</span><span aria-hidden>|</span><Kbd>Esc</Kbd><span>discard</span>
        </div>
      </footer>
    </section>
  );
});
