import { ExternalLink } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { usePersonEdit, isValidDob, type PersonForm } from '../../../hooks/usePersonEdit';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { genderLabel } from '../../../utils/person-format';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select, Textarea } from '../../ui/Input';
import { SearchInput } from '../../ui/Toolbar';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';

const GENDERS = ['Male', 'Female', 'Other'];

/** Person record: edit form, read-only recorded details, election history, and (SUPER_ADMIN) merge duplicates. */
export function PersonPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { hasRole } = useAuth();
  const canMerge = hasRole('SUPER_ADMIN');
  const ed = usePersonEdit(id);
  const { person, form, setForm, fieldErrors } = ed;
  useUnsavedGuard(ed.dirty);

  const set = (patch: Partial<PersonForm>) => setForm({ ...form, ...patch });
  const nameError = form.name.trim() ? fieldErrors.name : 'Name is required';
  const dobError = isValidDob(form.date_of_birth) ? fieldErrors.date_of_birth : 'Enter a valid date';
  const save = async () => { if (await ed.handleSave()) onChanged(); };
  const merge = async (dupId: string, dupName: string) => { if (await ed.handleMerge(dupId, dupName)) onChanged(); };
  const meta = (person?.metadata ?? {}) as Record<string, unknown>;
  const contests = person?.candidates?.length ?? 0;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={person?.name ?? 'Person'}
      description={person ? `${genderLabel(person.gender)} · ${contests} ${contests === 1 ? 'contest' : 'contests'}` : undefined}
      footer={person ? <PanelFooter dirty={ed.dirty} saving={ed.saving} canSave={!!form.name.trim() && isValidDob(form.date_of_birth)} onCancel={ed.reset} onSave={save} /> : undefined}
    >
      {!person ? (
        ed.loading
          ? <p className="py-10 text-center text-sm text-muted">Loading person…</p>
          : ed.loadError === 'failed'
            ? <EmptyState title="Could not load person" description="Check the connection and try again." action={<Button variant="outline" size="sm" onClick={() => { void ed.refresh(); }}>Try again</Button>} />
            : <EmptyState title="Person not found" description="It may have been merged into another record." />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-subtle text-lg font-semibold text-ink-2">
              {form.photo_url ? <img src={form.photo_url} alt="" className="h-full w-full object-cover" /> : person.name.charAt(0)}
            </span>
            <div className="space-y-1 text-xs">
              <p className="text-ink-2">{person.education || 'No education recorded'}</p>
              {form.wikipedia_url && (
                <a href={form.wikipedia_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Wikipedia <ExternalLink size={12} aria-hidden />
                </a>
              )}
            </div>
          </div>

          <FormSection title="Details">
            <Field label="Name" error={nameError}>
              <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth" error={dobError}>
                <Input type="date" value={form.date_of_birth} invalid={!!dobError} onChange={(e) => set({ date_of_birth: e.target.value })} />
              </Field>
              <Field label="Gender" error={fieldErrors.gender}>
                <Select value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                  <option value="">Not specified</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  {form.gender && !GENDERS.includes(form.gender) && <option value={form.gender}>{form.gender}</option>}
                </Select>
              </Field>
            </div>
            <Field label="Education" error={fieldErrors.education}>
              <Input value={form.education} onChange={(e) => set({ education: e.target.value })} />
            </Field>
            <Field label="Photo URL" error={fieldErrors.photo_url}>
              <Input value={form.photo_url} placeholder="https://…" onChange={(e) => set({ photo_url: e.target.value })} />
            </Field>
            <Field label="Wikipedia URL" error={fieldErrors.wikipedia_url}>
              <Input value={form.wikipedia_url} placeholder="https://en.wikipedia.org/wiki/…" onChange={(e) => set({ wikipedia_url: e.target.value })} />
            </Field>
            <Field label="Bio" error={fieldErrors.bio}>
              <Textarea rows={5} value={form.bio} onChange={(e) => set({ bio: e.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Recorded details">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Caste</dt><dd className="text-ink">{(meta.caste as string) || 'Not recorded'}</dd></div>
              <div><dt className="text-xs text-muted">Religion</dt><dd className="text-ink">{(meta.religion as string) || 'Not recorded'}</dd></div>
            </dl>
            <p className="text-[11px] text-muted">Read-only. These come from the data import.</p>
          </FormSection>

          <FormSection title="Election history">
            {contests === 0 && <p className="text-xs text-muted">No contests recorded.</p>}
            <ul className="divide-y divide-line">
              {person.candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{c.constituency_name || c.const_id}</div>
                    <div className="text-[11px] text-muted">
                      {c.election_name || c.election_id}{c.election_year ? ` (${c.election_year})` : ''} · {c.party_id || 'IND'}
                    </div>
                  </div>
                  {c.is_incumbent && <Badge tone="warn">Incumbent</Badge>}
                </li>
              ))}
            </ul>
          </FormSection>

          {canMerge && (
            <FormSection title="Merge duplicates">
              <p className="text-xs text-ink-2">Find a duplicate record and merge it into this one. Its contests move here and the duplicate is deleted.</p>
              {/* A merge reloads the record, which would silently drop unsaved form edits. */}
              {ed.dirty && <p className="text-xs text-warn-text">Save or cancel your changes first.</p>}
              <SearchInput label="Search duplicates" placeholder="Search by name…" value={ed.mergeSearch} onChange={ed.setMergeSearch} />
              <ul className="space-y-1.5">
                {ed.mergeResults.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-control border border-line px-2.5 py-1.5">
                    <div className="min-w-0 text-xs">
                      <div className="truncate font-medium text-ink">{p.name}</div>
                      <div className="text-muted">{p.candidate_count} contests</div>
                    </div>
                    <Button size="sm" variant="danger" disabled={ed.merging || ed.dirty} aria-label={`Merge ${p.name} into this record`} onClick={() => merge(p.id, p.name)}>Merge</Button>
                  </li>
                ))}
              </ul>
            </FormSection>
          )}
        </div>
      )}
    </Sheet>
  );
}
