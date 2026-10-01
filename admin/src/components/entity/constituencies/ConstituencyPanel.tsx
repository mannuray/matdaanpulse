import { useEffect, useId, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useConstituencyEditor } from '../../../hooks/useConstituencyEditor';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import { ElectionMismatch } from '../ElectionMismatch';
import { TAG_PALETTE, tagLabel } from './tags';

type SeatHistory = Array<{ year: number; party: string; candidate: string }>;

/** Constituency record: demographics, administrative fields, tags, and read-only seat history. */
export function ConstituencyPanel({ id, onClose, onSaved, refreshSignal = 0 }: { id: string; onClose: () => void; onSaved: () => void; refreshSignal?: number }) {
  const ed = useConstituencyEditor(id);
  const c = ed.constituency;
  useUnsavedGuard(ed.isDirty);
  const listId = useId();
  // The list changed this record (bulk tag): reload it, but never over unsaved edits.
  const dirtyRef = useRef(ed.isDirty);
  dirtyRef.current = ed.isDirty;
  const firstSignal = useRef(refreshSignal);
  useEffect(() => {
    if (refreshSignal === firstSignal.current) return;
    firstSignal.current = refreshSignal;
    if (!dirtyRef.current) void ed.refresh();
  }, [refreshSignal]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tagInput, setTagInput] = useState('');

  const demo = (patch: Partial<typeof ed.editDemographics>) => ed.setEditDemographics({ ...ed.editDemographics, ...patch });
  const admin = (patch: Partial<typeof ed.adminInfo>) => ed.setAdminInfo({ ...ed.adminInfo, ...patch });
  const addTag = () => { const t = tagInput.trim(); if (t) ed.addTag(t); setTagInput(''); };
  const save = async () => { if (await ed.handleSave()) onSaved(); };
  const tags = ed.tags;
  // A reload would overwrite unsaved edits.
  const retry = <Button variant="outline" size="sm" disabled={ed.isDirty} onClick={() => { void ed.refresh(); }}>Try again</Button>;
  const history = ((c?.analysis?.incumbency ?? {}) as { seat_history?: SeatHistory }).seat_history ?? [];

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={c?.name ?? 'Constituency'}
      description={c ? `#${c.const_no} · ${c.type}${c.election ? ` · ${c.election.name}` : ''}` : undefined}
      footer={c ? <PanelFooter dirty={ed.isDirty} saving={ed.saving} canSave={ed.valid} onCancel={ed.reset} onSave={save} /> : undefined}
    >
      {!c ? (
        ed.loading
          ? <p className="py-10 text-center text-sm text-muted">Loading constituency…</p>
          : ed.loadError === 'failed'
            ? <EmptyState title="Could not load constituency" description="Check the connection and try again." action={retry} />
            : <EmptyState title="Constituency not found" description="Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5">
          {ed.loadError === 'failed' && (
            <EmptyState title="Could not reload constituency" description="The details below may be out of date." action={retry} />
          )}
          <ElectionMismatch recordElectionId={c.election_id} />

          <FormSection title="Demographics">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Population" error={ed.fieldErrors.population}><Input inputMode="numeric" invalid={!!ed.fieldErrors.population} value={ed.editDemographics.population} onChange={(e) => demo({ population: e.target.value })} /></Field>
              <Field label="Literacy %" error={ed.fieldErrors.literacy_pct}><Input inputMode="decimal" invalid={!!ed.fieldErrors.literacy_pct} value={ed.editDemographics.literacy_pct} onChange={(e) => demo({ literacy_pct: e.target.value })} /></Field>
              <Field label="Urban %" error={ed.fieldErrors.urban_pct}><Input inputMode="decimal" invalid={!!ed.fieldErrors.urban_pct} value={ed.editDemographics.urban_pct} onChange={(e) => demo({ urban_pct: e.target.value })} /></Field>
              <Field label="SC/ST %" error={ed.fieldErrors.sc_st_pct}><Input inputMode="decimal" invalid={!!ed.fieldErrors.sc_st_pct} value={ed.editDemographics.sc_st_pct} onChange={(e) => demo({ sc_st_pct: e.target.value })} /></Field>
            </div>
            <Field label="Dominant castes"><Input value={ed.editDemographics.dominant_castes} onChange={(e) => demo({ dominant_castes: e.target.value })} /></Field>
            <Field label="Religions"><Input value={ed.editDemographics.religions} onChange={(e) => demo({ religions: e.target.value })} /></Field>
          </FormSection>

          <FormSection title="Administrative">
            <Field label="District">
              <Select value={String(ed.adminInfo.district_id)} onChange={(e) => admin({ district_id: e.target.value })}>
                <option value="">No district</option>
                {ed.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Region">
              <Select value={String(ed.adminInfo.region_id)} onChange={(e) => admin({ region_id: e.target.value })}>
                <option value="">No region</option>
                {ed.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Seat number" error={ed.fieldErrors.const_no}>
                <Input inputMode="numeric" invalid={!!ed.fieldErrors.const_no} value={ed.adminInfo.const_no} onChange={(e) => admin({ const_no: e.target.value })} />
              </Field>
              <Field label="Phase"><Input value={ed.adminInfo.phase} onChange={(e) => admin({ phase: e.target.value })} /></Field>
            </div>
          </FormSection>

          <FormSection title="Tags">
            {tags.length === 0 && <p className="text-xs text-muted">No tags yet.</p>}
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li key={t}>
                  <Badge tone="muted" className="gap-1">
                    {tagLabel(t)}
                    <button type="button" aria-label={`Remove tag ${tagLabel(t)}`} onClick={() => ed.removeTag(t)} className="text-muted hover:text-ink">
                      <X size={12} aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                aria-label="Add a tag"
                list={listId}
                value={tagInput}
                placeholder="e.g. urban"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              />
              <datalist id={listId}>{TAG_PALETTE.map((t) => <option key={t} value={t} />)}</datalist>
              <Button variant="outline" onClick={addTag}>Add</Button>
            </div>
          </FormSection>

          <FormSection title="Seat history">
            {history.length === 0
              ? <p className="text-xs text-muted">No history computed yet. Use "Compute analysis" on the list.</p>
              : (
                <ul className="divide-y divide-line">
                  {history.map((h, i) => (
                    <li key={`${h.year}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-12 font-mono text-xs text-muted">{h.year}</span>
                      <span className="font-medium text-ink">{h.party}</span>
                      <span className="truncate text-ink-2">{h.candidate}</span>
                    </li>
                  ))}
                </ul>
              )}
          </FormSection>
        </div>
      )}
    </Sheet>
  );
}
