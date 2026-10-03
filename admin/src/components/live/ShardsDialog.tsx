import { useEffect, useState } from 'react';
import { FormDialog } from '../ui/FormDialog';
import { Field } from '../ui/Field';
import { Input, Select } from '../ui/Input';
import { Button } from '../ui/Button';
import { putShard, deleteShard } from '../../services/ingest.service';
import { getStates, getRegions, getDistricts } from '../../services/geo.service';
import type { IngestShardStatus, ShardSelector } from '../../types';

/** "1-100, 120-130, 7" -> [[1,100],[120,130],[7,7]]; null for empty text, junk, zero or reversed ranges. */
export function parseRanges(text: string): [number, number][] | null {
  if (!text.trim()) return null;
  const out: [number, number][] = [];
  for (const raw of text.split(',')) {
    const m = /^\s*(\d+)\s*(?:-\s*(\d+)\s*)?$/.exec(raw);
    if (!m) return null;
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a < 1 || a > b) return null;
    out.push([a, b]);
  }
  return out;
}

export const NAME_RE = /^[a-z0-9][a-z0-9_-]*$/;
type Kind = 'seats' | 'states' | 'regions' | 'districts';
type Opt = { id: number; name: string };

interface Props {
  open: boolean;
  electionId: string;
  shards: IngestShardStatus[];
  onClose(): void;
  onSaved(): void;
}

function errorText(e: unknown): string {
  const err = e as Error & { status?: number; details?: { sample?: unknown } };
  const sample = err.status === 409 && Array.isArray(err.details?.sample) ? (err.details!.sample as string[]).join(', ') : '';
  return sample ? `${err.message} Clashing seats: ${sample}` : err.message || 'Could not save the shard';
}

/** Live Console: the shards (disjoint seat sets, one ingest job each) of an election. */
export function ShardsDialog({ open, electionId, shards, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('seats');
  const [seats, setSeats] = useState('');
  const [picked, setPicked] = useState<Record<'states' | 'regions' | 'districts', number[]>>({ states: [], regions: [], districts: [] });
  const [states, setStates] = useState<Opt[]>([]);
  const [stateId, setStateId] = useState('');
  const [options, setOptions] = useState<Opt[]>([]);
  const [override, setOverride] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || kind === 'seats' || states.length) return;
    getStates().then(s => setStates(s.map(x => ({ id: x.id, name: x.name })))).catch(() => setStates([]));
  }, [open, kind, states.length]);

  useEffect(() => {
    setOptions([]);
    if (kind !== 'regions' && kind !== 'districts') return;
    if (!stateId) return;
    let live = true;
    const load = kind === 'regions' ? getRegions : getDistricts;
    load(Number(stateId)).then(o => { if (live) setOptions(o); }).catch(() => { if (live) setOptions([]); });
    return () => { live = false; };
  }, [kind, stateId]);

  const ranges = kind === 'seats' ? parseRanges(seats) : null;
  const ids = kind === 'seats' ? [] : picked[kind];
  const nameOk = NAME_RE.test(name) && name !== 'rest';
  const selectorOk = kind === 'seats' ? ranges !== null : ids.length > 0;
  const toggle = (id: number) => {
    if (kind === 'seats') return;
    setPicked(p => ({ ...p, [kind]: p[kind].includes(id) ? p[kind].filter(x => x !== id) : [...p[kind], id] }));
  };

  const selector = (): ShardSelector => {
    if (kind === 'seats') return { const_no_ranges: ranges! };
    if (kind === 'states') return { state_ids: ids };
    if (kind === 'regions') return { region_ids: ids };
    return { district_ids: ids };
  };

  const save = async () => {
    setBusy(true); setError(null);
    try {
      await putShard(electionId, name, { selector: selector(), source_override: override.trim() || null });
      setName(''); setSeats(''); setOverride(''); setPicked({ states: [], regions: [], districts: [] });
      onSaved();
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };
  const remove = async (n: string) => {
    setBusy(true); setError(null);
    try { await deleteShard(electionId, n); onSaved(); } catch (e) { setError(errorText(e)); } finally { setBusy(false); }
  };

  const checks = (list: Opt[]) => (
    <ul className="max-h-40 space-y-1 overflow-y-auto rounded-control border border-line p-2 text-sm">
      {list.map(o => (
        <li key={o.id}><label className="flex items-center gap-2"><input type="checkbox" checked={ids.includes(o.id)} onChange={() => toggle(o.id)} />{o.name}</label></li>
      ))}
      {list.length === 0 && <li className="text-xs text-muted">Nothing to pick.</li>}
    </ul>
  );

  return (
    <FormDialog open={open} onRequestClose={onClose} title="Shards"
      description="Each shard is a set of seats one ingest job posts. Seats in no shard fall into “rest”."
      footer={<>
        <span className="text-xs text-muted">{error ? '' : 'Seat sets must not overlap.'}</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button variant="primary" disabled={!nameOk || !selectorOk || busy} onClick={() => { void save(); }}>Save shard</Button>
        </div>
      </>}>
      <div className="space-y-5">
        {error && <p role="alert" className="rounded-control bg-bad-soft px-3 py-2 text-sm text-bad-text">{error}</p>}
        <ul className="divide-y divide-line text-sm" aria-label="Existing shards">
          {shards.map(s => (
            <li key={s.name} className="flex items-center justify-between gap-3 py-2">
              <span><span className="font-semibold">{s.name}</span> <span className="text-muted">{s.seat_count} seats{s.source ? ` · ${s.source}` : ''}</span></span>
              <Button size="sm" variant="danger" aria-label={`Delete ${s.name}`} disabled={busy} onClick={() => { void remove(s.name); }}>Delete</Button>
            </li>
          ))}
          {shards.length === 0 && <li className="py-2 text-muted">No shards yet: every seat is in “rest”.</li>}
        </ul>
        <form className="space-y-3" onSubmit={e => { e.preventDefault(); if (nameOk && selectorOk && !busy) void save(); }}>
          <Field label="Name" hint="Lower-case letters, digits, - and _. “rest” is reserved." error={name && !nameOk ? 'Invalid name' : undefined}>
            <Input value={name} invalid={!!name && !nameOk} onChange={e => setName(e.target.value)} />
          </Field>
          <Field label="Selector">
            <Select value={kind} onChange={e => setKind(e.target.value as Kind)}>
              <option value="seats">Seat numbers</option>
              <option value="states">States</option>
              <option value="regions">Regions</option>
              <option value="districts">Districts</option>
            </Select>
          </Field>
          {kind === 'seats' && (
            <Field label="Seat numbers" hint="Ranges and single seats, e.g. 1-100, 120-130" error={seats && !ranges ? 'Use numbers like 1-100, 120-130 (low to high)' : undefined}>
              <Input value={seats} invalid={!!seats && !ranges} onChange={e => setSeats(e.target.value)} />
            </Field>
          )}
          {kind === 'states' && checks(states)}
          {(kind === 'regions' || kind === 'districts') && (
            <>
              <Field label="State">
                <Select value={stateId} onChange={e => setStateId(e.target.value)}>
                  <option value="">Pick a state</option>
                  {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              {checks(options)}
              {ids.length > 0 && <p className="text-xs text-muted">{ids.length} selected</p>}
            </>
          )}
          <Field label="Source override" hint="Optional: this shard follows this source instead of the election's.">
            <Input value={override} onChange={e => setOverride(e.target.value)} />
          </Field>
        </form>
      </div>
    </FormDialog>
  );
}
