import { useId, useState, type ReactNode } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { MAX_PHASE, RESERVATIONS, useConstituencyEditor, type AdminInfo, type Demographics, type Reservation } from '../../../hooks/useConstituencyEditor';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { useRecordQuery } from '../../../hooks/useRecordQuery';
import { getConstituencyHistory } from '../../../services/constituency.service';
import { shortElectionName } from '../../shell/ElectionPicker';
import { RecordPage } from '../../record/RecordPage';
import { RecordCard, RecordMeta } from '../../record/RecordCard';
import { RecordLink } from '../../record/RecordLink';
import { RecordLoadError } from '../../record/RecordLoadError';
import { Field } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { ElectionMismatch } from '../ElectionMismatch';
import { ConstituencyHistoryCard, formatTurnout } from './ConstituencyHistoryCard';
import { ConstituencyAnalysisCard } from './ConstituencyAnalysisCard';
import { TAG_PALETTE, tagLabel } from './tags';

interface ConstituencyRecordProps {
  id: string;
  /** "← Constituencies": back to the list, through the unsaved guard. */
  onBack: () => void;
  /** After a save, so the list shows the new values. */
  onSaved: () => void;
}

const PHASES = Array.from({ length: MAX_PHASE }, (_, i) => String(i + 1));
/** Suggested tags shown under the tag input (the datalist offers all of them). */
const SUGGESTIONS = 4;

/**
 * A demographics number with its unit inside the box. The unit is CSS content, so it is not part of the field's
 * label text (the label wraps exactly one control).
 */
function UnitInput({ unit, ...props }: { unit: string } & Parameters<typeof Input>[0]) {
  return (
    <span
      data-unit={unit}
      className="relative block after:pointer-events-none after:absolute after:top-1/2 after:right-3 after:-translate-y-1/2 after:text-[11px] after:text-muted after:content-[attr(data-unit)]"
    >
      <Input {...props} className="pr-16 tabular-nums" />
    </span>
  );
}

function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </>
  );
}

/**
 * Constituency record page at /constituencies/:id: seat, demographics and tags on the left; seat history (from
 * results), analysis and record info on the right. The page keys it by id. There is no create flow.
 */
export function ConstituencyRecord({ id, onBack, onSaved }: ConstituencyRecordProps) {
  const ed = useConstituencyEditor(id);
  const c = ed.constituency;
  useUnsavedGuard(ed.isDirty);
  const history = useRecordQuery(getConstituencyHistory, id);
  const listId = useId();
  const [tagInput, setTagInput] = useState('');

  const demo = (patch: Partial<Demographics>) => ed.setEditDemographics({ ...ed.editDemographics, ...patch });
  const admin = (patch: Partial<AdminInfo>) => ed.setAdminInfo({ ...ed.adminInfo, ...patch });
  const addTag = (t = tagInput.trim()) => { if (t) ed.addTag(t); setTagInput(''); };
  const save = async () => { if (await ed.handleSave()) onSaved(); };
  const err = ed.fieldErrors;
  const suggested = TAG_PALETTE.filter((t) => !ed.tags.includes(t)).slice(0, SUGGESTIONS);
  // A stored phase outside 1–20 (older data) stays selectable, so loading it is not an edit.
  const phase = String(ed.adminInfo.phase);
  const phases = phase && !PHASES.includes(phase) ? [phase, ...PHASES] : PHASES;

  const meta = c && [
    c.district?.name ? `${c.district.name} district` : null,
    c.region?.name ? `${c.region.name} region` : null,
    c.election ? shortElectionName(c.election.name, c.election.type, c.election.year) : null,
  ].filter(Boolean).join(' · ');

  const error = !c && ed.loadError
    ? <RecordLoadError kind={ed.loadError} noun="constituency" onRetry={() => { void ed.refresh(); }} />
    : null;

  return (
    <RecordPage
      backLabel="Constituencies"
      onBack={onBack}
      loading={!c && !error}
      error={error}
      leading={c && (
        <span className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-control bg-subtle px-3 font-mono text-lg font-semibold text-ink">
          {c.const_no}
        </span>
      )}
      title={c?.name}
      tags={c && <Badge tone="muted">{c.type}</Badge>}
      meta={meta || undefined}
      dirty={ed.isDirty}
      saving={ed.saving}
      canSave={ed.valid}
      onCancel={ed.reset}
      onSave={save}
      headerActions={c && (
        <RecordLink
          to={`/candidates?seat=${encodeURIComponent(c.id)}`}
          electionId={c.election_id}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-control border border-line-strong bg-card px-4 text-sm font-medium whitespace-nowrap text-ink hover:bg-subtle"
        >
          Candidates in this seat <ArrowRight size={14} aria-hidden />
        </RecordLink>
      )}
      main={c && (
        <>
          {ed.loadError === 'failed' && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/40 bg-bad-soft p-4 text-sm text-bad-text">
              <div>
                <div className="font-medium">Could not reload constituency</div>
                <div className="text-xs">The details below may be out of date.</div>
              </div>
              {/* A reload would overwrite unsaved edits. */}
              <Button variant="outline" size="sm" disabled={ed.isDirty} onClick={() => { void ed.refresh(); }}>Try again</Button>
            </div>
          )}
          <ElectionMismatch recordElectionId={c.election_id} />

          <RecordCard title="Seat" subtitle="Constituency identification and administrative boundaries">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Constituency number" error={err.const_no}>
                <Input inputMode="numeric" invalid={!!err.const_no} value={ed.adminInfo.const_no} onChange={(e) => admin({ const_no: e.target.value })} />
              </Field>
              <Field label="Polling phase" error={err.phase}>
                <Select invalid={!!err.phase} value={phase} onChange={(e) => admin({ phase: e.target.value })}>
                  <option value="">Not set</option>
                  {phases.map((p) => <option key={p} value={p}>Phase {p}</option>)}
                </Select>
              </Field>
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
              <Field label="Reservation">
                <Select value={ed.adminInfo.type} onChange={(e) => admin({ type: e.target.value as Reservation })}>
                  {RESERVATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </Field>
            </div>
          </RecordCard>

          <RecordCard title="Demographics" subtitle="Census and statutory demographic profile">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Field label="Population" error={err.population}>
                <UnitInput unit="people" inputMode="numeric" invalid={!!err.population} value={ed.editDemographics.population} onChange={(e) => demo({ population: e.target.value })} />
              </Field>
              <Field label="Literacy rate" error={err.literacy_pct}>
                <UnitInput unit="%" inputMode="decimal" invalid={!!err.literacy_pct} value={ed.editDemographics.literacy_pct} onChange={(e) => demo({ literacy_pct: e.target.value })} />
              </Field>
              <Field label="Urban share" error={err.urban_pct}>
                <UnitInput unit="%" inputMode="decimal" invalid={!!err.urban_pct} value={ed.editDemographics.urban_pct} onChange={(e) => demo({ urban_pct: e.target.value })} />
              </Field>
              <Field label="SC/ST share" error={err.sc_st_pct}>
                <UnitInput unit="%" inputMode="decimal" invalid={!!err.sc_st_pct} value={ed.editDemographics.sc_st_pct} onChange={(e) => demo({ sc_st_pct: e.target.value })} />
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Dominant castes" hint="Socio-political groupings">
                <Input value={ed.editDemographics.dominant_castes} onChange={(e) => demo({ dominant_castes: e.target.value })} />
              </Field>
              <Field label="Religions" hint="e.g. Hindu 92%, Muslim 7%">
                <Input value={ed.editDemographics.religions} onChange={(e) => demo({ religions: e.target.value })} />
              </Field>
            </div>
          </RecordCard>

          <RecordCard title="Tags" subtitle="Analytical labels for filtering and bulk tagging">
            {ed.tags.length === 0 && <p className="mb-3 text-xs text-muted">No tags yet.</p>}
            <ul className="mb-3 flex flex-wrap gap-1.5">
              {ed.tags.map((t) => (
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
                placeholder="Add tag…"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              />
              <datalist id={listId}>{TAG_PALETTE.map((t) => <option key={t} value={t} />)}</datalist>
              <Button variant="outline" onClick={() => addTag()}>Add</Button>
            </div>
            {suggested.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
                Suggested:
                {suggested.map((t) => (
                  <button key={t} type="button" onClick={() => addTag(t)} className="font-mono text-accent hover:underline">{t}</button>
                ))}
              </p>
            )}
          </RecordCard>
        </>
      )}
      aside={c && (
        <>
          <ConstituencyHistoryCard
            seatName={c.name}
            history={history.data}
            loading={history.loading}
            // A seat the history endpoint does not know (404) has no earlier elections; only other failures retry.
            failed={history.error === 'failed'}
            onRetry={history.retry}
          />
          <ConstituencyAnalysisCard analysis={c.analysis} />
          <RecordCard title="Record">
            <dl className="mb-2.5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-xs">
              <MetaRow label="State code"><span className="font-mono">{c.state?.code ?? '—'}</span></MetaRow>
              <MetaRow label="Turnout (this election)">{formatTurnout(c.voter_turnout) ?? 'Not recorded'}</MetaRow>
            </dl>
            <RecordMeta id={id} updatedAt={c.updated_at} lastEdit={c.last_edit} />
          </RecordCard>
        </>
      )}
    />
  );
}
