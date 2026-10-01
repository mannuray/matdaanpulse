import { useElectionManager, isValidElectionYear, type ElectionFormState } from '../../../hooks/useElectionManager';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { FormDialog } from '../../ui/FormDialog';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import type { Election } from '../../../types';

const TONE: Record<Election['status'], 'accent' | 'ok' | 'muted'> = { Upcoming: 'accent', Live: 'ok', Finalized: 'muted' };
const HELP: Record<Election['status'], string> = {
  Upcoming: 'Not live yet. Going live opens it to results entry in the Live Console.',
  Live: 'Accepting results. Finalizing archives the live data and stops overrides.',
  Finalized: 'Archived. Results can no longer be changed.',
};

export function ElectionStatusBadge({ status }: { status: Election['status'] }) {
  return <Badge tone={TONE[status]}>{status}</Badge>;
}

export const electionTypeLabel = (t: Election['type']) => (t === 'LS' ? 'Lok Sabha' : 'Vidhan Sabha');

interface ElectionPanelProps {
  mode: 'new' | 'edit';
  /** The open election, resolved from the global list (null while loading or if unknown). */
  election: Election | null;
  manager: ReturnType<typeof useElectionManager>;
  loadingElections: boolean;
  /** The global election list failed to load (distinct from an unknown id). */
  loadFailed: boolean;
  onRetry: () => void;
  canFinalize: boolean;
  onClose: () => void;
  onSave: () => void | Promise<void>;
  onGoLive: () => void;
  onFinalize: () => void;
}

/** Elections have no detail page: a centred dialog holds the create/edit form plus the lifecycle actions. */
export function ElectionPanel({ mode, election, manager, loadingElections, loadFailed, onRetry, canFinalize, onClose, onSave, onGoLive, onFinalize }: ElectionPanelProps) {
  const { form, setForm, states, fieldErrors } = manager;
  useUnsavedGuard(manager.dirty);
  const set = (patch: Partial<ElectionFormState>) => setForm({ ...form, ...patch });
  const nameError = form.name.trim() ? fieldErrors.name : 'Name is required';
  const yearError = isValidElectionYear(form.year) ? fieldErrors.year : 'Enter a 4-digit year';
  const missing = mode === 'edit' && !election;
  const title = mode === 'new' ? 'New election' : election?.name ?? 'Election';
  const description = election
    ? `${electionTypeLabel(election.type)} · ${election.year}`
    : mode === 'new' ? 'Name, type, year and state' : undefined;

  return (
    <FormDialog
      open
      onRequestClose={onClose}
      title={title}
      description={description}
      footer={missing ? undefined : (
        <PanelFooter dirty={manager.dirty} saving={manager.saving} canSave={!!form.name.trim() && isValidElectionYear(form.year)} onCancel={manager.revert} onSave={onSave}
          saveLabel={mode === 'new' ? 'Create election' : 'Save changes'} />
      )}
    >
      {missing ? (
        loadingElections
          ? <p className="py-10 text-center text-sm text-muted">Loading election…</p>
          : loadFailed
            ? <EmptyState title="Could not load election" description="Check the connection and try again." action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>} />
            : <EmptyState title="Election not found" description="It may have been removed. Close this panel to go back to the list." />
      ) : (
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); if (manager.dirty && !manager.saving) onSave(); }}>
          {election && (
            <FormSection title="Status">
              <div className="flex items-center justify-between gap-3">
                <ElectionStatusBadge status={election.status} />
                <div className="flex gap-2">
                  {election.status === 'Upcoming' && <Button size="sm" variant="primary" onClick={onGoLive}>Go live</Button>}
                  {election.status === 'Live' && canFinalize && <Button size="sm" variant="danger" onClick={onFinalize}>Finalize</Button>}
                </div>
              </div>
              <p className="text-xs text-muted">{HELP[election.status]}</p>
            </FormSection>
          )}
          <FormSection title="Details">
            <Field label="Name" error={nameError}>
              <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={form.type} onChange={(e) => {
                  const type = e.target.value as ElectionFormState['type'];
                  set(type === 'LS' ? { type, state_id: '' } : { type });
                }}>
                  <option value="LS">Lok Sabha</option>
                  <option value="VS">Vidhan Sabha</option>
                </Select>
              </Field>
              <Field label="Year" error={yearError}>
                <Input inputMode="numeric" invalid={!!yearError} value={form.year} onChange={(e) => set({ year: e.target.value })} />
              </Field>
            </div>
            {form.type === 'VS' && (
              <Field label="State" error={fieldErrors.state_id}>
                <Select value={form.state_id} onChange={(e) => set({ state_id: e.target.value })}>
                  <option value="">Select a state</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Result date" hint="Counting day. The public site counts down to it while the election is upcoming." error={fieldErrors.tentative_next_date}>
              <Input type="date" value={form.tentative_next_date} onChange={(e) => set({ tentative_next_date: e.target.value })} />
            </Field>
          </FormSection>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}
    </FormDialog>
  );
}
