import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { usePersonEdit, isValidDob, type PersonForm } from '../../../hooks/usePersonEdit';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { RecordPage } from '../../record/RecordPage';
import { RecordCard, RecordMeta } from '../../record/RecordCard';
import { RecordLoadError } from '../../record/RecordLoadError';
import { Field } from '../../ui/Field';
import { Input, Select, Textarea } from '../../ui/Input';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { PersonHistoryCard } from './PersonHistoryCard';
import { PersonMergeCard } from './PersonMergeCard';
import { PersonMergeHistoryCard } from './PersonMergeHistoryCard';
import { contestsLabel } from '../../../utils/person-format';
import type { PersonCandidate, PersonMerge } from '../../../types';

const GENDERS = ['Male', 'Female', 'Other'];

interface PersonRecordProps {
  id: string;
  /** "← Persons": back to the list, through the unsaved guard. */
  onBack: () => void;
  /** After a save, a merge or an undo, so the list shows the new values and counts. */
  onSaved: () => void;
  /** Open another person (after an undo that deleted this one, the restored person). */
  onOpenPerson: (id: string) => void;
}

/** "5 contests · first 2010" (no first year without contests). */
function contestsSummary(contests: PersonCandidate[]): string {
  const years = contests.map((c) => c.election_year).filter((y): y is number => typeof y === 'number');
  return contestsLabel(contests.length, years.length ? Math.min(...years) : null);
}

const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v.trim());

/**
 * Person record page at /persons/:id: profile (with the admin-only caste and religion), links and biography on the
 * left; election history, merge (SUPER_ADMIN), merge history (Undo for SUPER_ADMIN) and record info on the right.
 * The page keys it by id.
 */
export function PersonRecord({ id, onBack, onSaved, onOpenPerson }: PersonRecordProps) {
  const { hasRole } = useAuth();
  const canMerge = hasRole('SUPER_ADMIN');
  const ed = usePersonEdit(id);
  const { person, form, setForm, fieldErrors } = ed;
  useUnsavedGuard(ed.dirty);

  const set = (patch: Partial<PersonForm>) => setForm({ ...form, ...patch });
  const nameError = form.name.trim() ? fieldErrors.name : 'Name is required';
  const dobError = isValidDob(form.date_of_birth) ? fieldErrors.date_of_birth : 'Enter a valid date';
  const save = async () => { if (await ed.handleSave()) onSaved(); };
  const merge = async (dupId: string, dupName: string) => { if (await ed.handleMerge(dupId, dupName)) onSaved(); };

  const contests = person?.candidates ?? [];

  // Undo merge (SUPER_ADMIN), after a confirm naming what comes back.
  const [undo, setUndo] = useState<PersonMerge | null>(null);
  const confirmUndo = async () => {
    if (!undo) return;
    const res = await ed.handleUndo(undo.id, undo.duplicate_name);
    setUndo(null);
    if (!res) return;
    onSaved();
    // This person had no contests of its own, so it was deleted: show the restored one instead.
    if (res.keeperGone) onOpenPerson(res.restoredId);
  };

  const error = !person && ed.loadError
    ? <RecordLoadError kind={ed.loadError} noun="person" onRetry={() => { void ed.refresh(); }} />
    : null;

  return (
    <RecordPage
      backLabel="Persons"
      onBack={onBack}
      loading={!person && !error}
      error={error}
      leading={
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-lg font-semibold text-ink-2">
          {form.photo_url ? <img src={form.photo_url} alt="" className="h-full w-full object-cover" /> : person?.name.charAt(0)}
        </span>
      }
      title={person?.name}
      meta={person && (
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>{contestsSummary(contests)}</span>
          <span className="rounded-control border border-line bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-muted">id {id.split('-')[0]}</span>
        </span>
      )}
      dirty={ed.dirty}
      saving={ed.saving}
      canSave={!!form.name.trim() && isValidDob(form.date_of_birth)}
      onCancel={ed.reset}
      onSave={save}
      main={
        <>
          {ed.loadError === 'failed' && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/40 bg-bad-soft p-4 text-sm text-bad-text">
              <div>
                <div className="font-medium">Could not reload person</div>
                <div className="text-xs">The details below may be out of date.</div>
              </div>
              {/* A reload would overwrite unsaved edits. */}
              <Button variant="outline" size="sm" disabled={ed.dirty} onClick={() => { void ed.refresh(); }}>Try again</Button>
            </div>
          )}

          <RecordCard title="Profile" subtitle="One record per politician, across elections">
            <div className="space-y-4">
              <Field label="Name" error={nameError}>
                <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
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
              {/* Admin only: the public profile never shows caste or religion. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Caste" hint="Admin only" error={fieldErrors.caste}>
                  <Input value={form.caste} onChange={(e) => set({ caste: e.target.value })} />
                </Field>
                <Field label="Religion" hint="Admin only" error={fieldErrors.religion}>
                  <Input value={form.religion} onChange={(e) => set({ religion: e.target.value })} />
                </Field>
              </div>
            </div>
          </RecordCard>

          <RecordCard title="Links">
            <div className="flex items-end gap-3">
              <Field label="Wikipedia URL" error={fieldErrors.wikipedia_url} className="min-w-0 flex-1">
                <Input value={form.wikipedia_url} placeholder="https://en.wikipedia.org/wiki/…" onChange={(e) => set({ wikipedia_url: e.target.value })} />
              </Field>
              {isHttpUrl(form.wikipedia_url) && (
                <a
                  href={form.wikipedia_url.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-px inline-flex h-9 shrink-0 items-center gap-1 rounded-control border border-line px-3 text-xs font-medium text-accent hover:bg-accent-soft"
                >
                  Open <ExternalLink size={12} aria-hidden />
                </a>
              )}
            </div>
          </RecordCard>

          <RecordCard title="Biography">
            <Field label="Biographical summary" error={fieldErrors.bio}>
              <Textarea rows={5} value={form.bio} onChange={(e) => set({ bio: e.target.value })} />
            </Field>
          </RecordCard>
        </>
      }
      aside={
        <>
          <PersonHistoryCard contests={contests} />
          {canMerge && <PersonMergeCard ed={ed} onMerge={(dupId, dupName) => { void merge(dupId, dupName); }} />}
          {person && (
            <PersonMergeHistoryCard
              merges={person.merges ?? []}
              canUndo={canMerge}
              locked={ed.dirty}
              busy={ed.undoing || ed.merging || ed.saving}
              onUndo={setUndo}
            />
          )}
          <ConfirmDialog
            open={!!undo}
            title="Undo merge?"
            description={undo
              ? `"${undo.duplicate_name}" comes back as its own person record with its ${undo.candidate_count} ${undo.candidate_count === 1 ? 'contest' : 'contests'}, and the fields the merge filled in on ${person?.name ?? 'this person'} are cleared.`
              : ''}
            confirmLabel="Undo merge"
            tone="danger"
            busy={ed.undoing}
            onConfirm={() => { void confirmUndo(); }}
            onCancel={() => setUndo(null)}
          />
          <RecordCard title="Record">
            <RecordMeta id={id} updatedAt={person?.updated_at} lastEdit={person?.last_edit} />
          </RecordCard>
        </>
      }
    />
  );
}
