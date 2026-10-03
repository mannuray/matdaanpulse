import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { Input, Select } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useUnsavedGuard } from '../../hooks/useUnsavedGuard';
import { formatIst, timeAgo } from '../../utils/time';
import { cn } from '../ui/cn';
import type { IngestStatus } from '../../types';

interface Props { status: IngestStatus; sources: string[]; saving: boolean; onApply(source: string | null, holdMinutes: number): Promise<boolean> | void }

const OTHER = '__other__';

const expiresIn = (iso: string | null) => {
  if (!iso) return null;
  const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
  return Number.isFinite(s) ? (s > 0 ? `expires in ${s} s` : 'expired') : null;
};

/** Live Console feed controls (spec §5): source / pause, hold time, per-shard status, alerts. */
export function FeedPanel({ status, sources, saving, onApply }: Props) {
  const [choice, setChoice] = useState(status.active_source ?? '');
  const [other, setOther] = useState('');
  const [hold, setHold] = useState(String(status.hold_minutes));
  const [confirm, setConfirm] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { setChoice(status.active_source ?? ''); setOther(''); setHold(String(status.hold_minutes)); }, [status.active_source, status.hold_minutes]);
  const source = choice === OTHER ? other.trim() : choice;
  const holdN = Number(hold);
  const holdOk = Number.isInteger(holdN) && holdN >= 1 && holdN <= 240;
  const sourceOk = choice !== OTHER || source !== '';
  const dirty = source !== (status.active_source ?? '') || choice === OTHER || hold !== String(status.hold_minutes);
  useUnsavedGuard(dirty);
  const options = [...new Set([...sources, ...(status.active_source ? [status.active_source] : [])])].sort();
  const apply = () => {
    const next = source || null;
    if (next && next !== status.active_source) setConfirm(true);
    else void onApply(next, holdN);
  };

  return (
    <section className="mx-6 mb-4 flex flex-col gap-3 rounded-card border border-line bg-card p-4 shadow-sm" aria-label="Live feed">
      {status.alerts.map(a => (
        <p key={a.key} role="alert" className={cn('rounded-control px-3 py-2 text-sm', a.level === 'error' ? 'bg-bad-soft text-bad-text' : 'bg-warn-soft text-warn-text')}>{a.message}</p>
      ))}
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">Source
          <Select aria-label="Source" value={choice} onChange={e => setChoice(e.target.value)} className="min-w-44">
            <option value="">Paused</option>
            {options.map(s => <option key={s} value={s}>{s}</option>)}
            <option value={OTHER}>Other…</option>
          </Select>
        </label>
        {choice === OTHER && (
          <Input aria-label="Other source" placeholder="source name" value={other} onChange={e => setOther(e.target.value)} className="w-40" />
        )}
        <label className="flex flex-col gap-1 text-xs font-medium text-ink-2">Hold (minutes)
          <Input aria-label="Hold (minutes)" inputMode="numeric" value={hold} invalid={!holdOk} onChange={e => setHold(e.target.value)} className="w-24" />
        </label>
        <Button variant="primary" disabled={!dirty || !holdOk || !sourceOk || saving} onClick={apply}>Apply</Button>
        <span className="ml-auto text-xs text-muted">{status.active_source ? `Live from ${status.active_source}` : 'Feed paused'}</span>
      </div>
      <table className="w-full text-left text-xs">
        <thead className="text-muted"><tr><th className="py-1 font-medium">Shard</th><th>Seats</th><th>Source</th><th>Job</th><th>Last post</th><th>Lag</th><th>Recent</th><th /></tr></thead>
        <tbody>
          {status.shards.map(s => (
            <tr key={s.name} className="border-t border-line align-top text-ink">
              <td className="py-1.5 font-semibold">{s.name}</td>
              <td className="tabular-nums">{s.seat_count}</td>
              <td>{s.source ?? <span className="text-muted">paused</span>}</td>
              <td>
                {s.lease_holder ? <span>{s.lease_holder}</span> : <span className="text-muted">none</span>}
                {s.lease_holder && s.lease_expires_at && <span className="ml-1 text-muted" title={formatIst(s.lease_expires_at)}>{expiresIn(s.lease_expires_at)}</span>}
              </td>
              <td>{s.last_post_at ? timeAgo(s.last_post_at) : '–'}</td>
              <td className={cn('tabular-nums', (s.lag_s ?? 0) > 180 && 'font-semibold text-warn-text')}>{s.lag_s == null ? '–' : `${s.lag_s} s`}</td>
              <td className="tabular-nums text-ink-2" title="applied / unchanged / stale / held / rejected">{['applied', 'unchanged', 'stale', 'held', 'rejected'].map(k => s.recent[k] ?? 0).join(' / ')}</td>
              <td>
                {s.rejected.length > 0 && <Button size="sm" variant="ghost" onClick={() => setOpen(open === s.name ? null : s.name)}>{s.rejected.length} rejected</Button>}
                {open === s.name && <ul className="mt-1 space-y-0.5 text-bad-text">{s.rejected.map(r => <li key={r.const_id}>{r.const_id}: {r.reason}</li>)}</ul>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog open={confirm} title="Switch source" tone="danger" confirmLabel="Switch"
        description={`Switch the live source to ${source}? The current source's posts will be refused from now on.`}
        onCancel={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void onApply(source || null, holdN); }} />
    </section>
  );
}
