import { usePartyEdit, isValidYear, type PartyForm } from '../../../hooks/usePartyEdit';
import { usePartyUsage } from '../../../hooks/usePartyUsage';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { RecordPage } from '../../record/RecordPage';
import { RecordCard, RecordMeta } from '../../record/RecordCard';
import { Field } from '../../ui/Field';
import { Input, Select, Textarea } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { RecordLoadError } from '../../record/RecordLoadError';
import { ColourField } from './ColourField';
import { ImageUpload } from '../../ui/ImageUpload';
import { PartyUsageCard, usageSummary } from './PartyUsageCard';
import { ECI_RECOGNITIONS, EciRecognitionBadge } from './eciRecognition';

interface PartyRecordProps {
  id: string;
  /** "← Parties": back to the list, through the unsaved guard. */
  onBack: () => void;
  onSaved: () => void;
}

/** Party record page at /parties/:id: profile cards on the left; symbols, usage and record info on the right. The page keys it by id. */
export function PartyRecord({ id, onBack, onSaved }: PartyRecordProps) {
  const ed = usePartyEdit(id);
  const usage = usePartyUsage(id);
  const { party, form, setForm, fieldErrors } = ed;
  useUnsavedGuard(ed.dirty);

  const set = (patch: Partial<PartyForm>) => setForm({ ...form, ...patch });
  const nameError = form.name.trim() ? fieldErrors.name : 'Name is required';
  const yearError = isValidYear(form.founded_year) ? fieldErrors.founded_year : 'Enter a 4-digit year';
  const save = async () => { if (await ed.handleSave()) onSaved(); };

  const error = !party && ed.loadError
    ? <RecordLoadError kind={ed.loadError} noun="party" onRetry={() => { void ed.refresh(); }} />
    : null;

  return (
    <RecordPage
      backLabel="Parties"
      onBack={onBack}
      loading={!party && !error}
      error={error}
      leading={<span aria-hidden className="h-9 w-9 shrink-0 rounded-control border border-line" style={{ background: form.color || 'var(--color-muted)' }} />}
      title={party?.name}
      tags={party && (
        <>
          <Badge tone="muted" className="font-mono">{party.abbreviation || party.id}</Badge>
          {party.eci_recognition && <EciRecognitionBadge value={party.eci_recognition} />}
        </>
      )}
      meta={usage.usage ? usageSummary(usage.usage.totals) : undefined}
      dirty={ed.dirty}
      saving={ed.saving}
      canSave={!!form.name.trim() && isValidYear(form.founded_year)}
      onCancel={ed.reset}
      onSave={save}
      main={
        <>
          <RecordCard title="Identity" subtitle="Name, colour and ECI recognition">
            <div className="space-y-4">
              <Field label="Name" error={nameError}>
                <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Abbreviation" error={fieldErrors.abbreviation}>
                  <Input value={form.abbreviation} onChange={(e) => set({ abbreviation: e.target.value.toUpperCase() })} />
                </Field>
                <ColourField value={form.color} error={fieldErrors.color} onChange={(color) => set({ color })} />
              </div>
              <Field label="ECI recognition" error={fieldErrors.eci_recognition}>
                <Select value={form.eci_recognition} onChange={(e) => set({ eci_recognition: e.target.value as PartyForm['eci_recognition'] })}>
                  <option value="">Not set</option>
                  {ECI_RECOGNITIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
            </div>
          </RecordCard>

          <RecordCard title="Organisation">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Leader" error={fieldErrors.leader_name}>
                  <Input value={form.leader_name} onChange={(e) => set({ leader_name: e.target.value })} />
                </Field>
                <Field label="Founded year" error={yearError}>
                  <Input inputMode="numeric" invalid={!!yearError} value={form.founded_year} onChange={(e) => set({ founded_year: e.target.value })} />
                </Field>
              </div>
              <Field label="Headquarters" error={fieldErrors.headquarters}>
                <Input value={form.headquarters} onChange={(e) => set({ headquarters: e.target.value })} />
              </Field>
            </div>
          </RecordCard>

          <RecordCard title="Links">
            <div className="space-y-4">
              <Field label="Website" error={fieldErrors.website}>
                <Input value={form.website} placeholder="https://…" onChange={(e) => set({ website: e.target.value })} />
              </Field>
              <Field label="Wikipedia URL" error={fieldErrors.wikipedia_url}>
                <Input value={form.wikipedia_url} placeholder="https://en.wikipedia.org/wiki/…" onChange={(e) => set({ wikipedia_url: e.target.value })} />
              </Field>
            </div>
          </RecordCard>

          <RecordCard title="About">
            <Field label="Description" error={fieldErrors.description}>
              <Textarea rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </RecordCard>
        </>
      }
      aside={
        <>
          <RecordCard title="Symbols">
            <div className="grid grid-cols-2 gap-3">
              <ImageUpload label="Party logo" kind="party-logo" ownerId={id} url={form.symbol_url} onChange={(symbol_url) => set({ symbol_url })} />
              <ImageUpload label="ECI symbol" kind="party-eci" ownerId={id} url={form.eci_symbol_url} onChange={(eci_symbol_url) => set({ eci_symbol_url })} />
            </div>
            {(fieldErrors.symbol_url || fieldErrors.eci_symbol_url) && (
              <p className="mt-2 text-xs text-bad-text">{fieldErrors.symbol_url || fieldErrors.eci_symbol_url}</p>
            )}
          </RecordCard>
          <PartyUsageCard state={usage} />
          <RecordCard title="Record">
            <RecordMeta id={id} updatedAt={party?.updated_at} lastEdit={party?.last_edit} />
          </RecordCard>
        </>
      }
    />
  );
}
