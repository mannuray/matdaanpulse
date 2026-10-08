import { useEffect, useMemo, useState } from 'react';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { EMPTY_AFFIDAVIT, INDEPENDENT, candidateAffidavit, candidateNumbersValid, type CandidateForm } from '../../../hooks/useCandidateEdit';
import type { NewCandidate } from '../../../hooks/useCandidateManager';
import { getParties } from '../../../services/party.service';
import { FormDialog } from '../../ui/FormDialog';
import { EmptyState } from '../../ui/EmptyState';
import { Field } from '../../ui/Field';
import { Combobox } from '../../ui/Combobox';
import { PanelFooter } from '../PanelFooter';
import { CandidateFields } from './CandidateFields';
import type { Constituency, Party } from '../../../types';

type CreateForm = CandidateForm & { const_id: string };
const EMPTY: CreateForm = { name: '', party_id: INDEPENDENT, const_id: '', ...EMPTY_AFFIDAVIT };

interface CandidateCreateDialogProps {
  electionId: string;
  /** Seats of the global election (the new candidate must stand in one of them). */
  seats: Constituency[];
  /** The seat selected on the page; the form starts there. */
  defaultSeat: string;
  saving: boolean;
  onCreate: (data: NewCandidate) => Promise<void>;
  onClose: () => void;
}

export const ARCHIVED_HINT = "Archived elections can't get new candidates";

/** /candidates/new in a Finalized election: the backend refuses new candidates (409), so the dialog says why instead. */
export function CandidateCreateArchived({ onClose }: { onClose: () => void }) {
  return (
    <FormDialog open onRequestClose={onClose} title="New candidate">
      <EmptyState title={ARCHIVED_HINT} description="This election is finalized. Switch to another election to add a candidate." />
    </FormDialog>
  );
}

/** /candidates/new: a dialog over the list with a candidate in a seat of the global election and its affidavit fields. */
export function CandidateCreateDialog({ electionId, seats, defaultSeat, saving, onCreate, onClose }: CandidateCreateDialogProps) {
  const [initial, setInitial] = useState<CreateForm>(() => ({ ...EMPTY, const_id: defaultSeat }));
  const [form, setForm] = useState<CreateForm>(initial);
  const [parties, setParties] = useState<Party[]>([]);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  useUnsavedGuard(dirty);

  useEffect(() => {
    let cancelled = false;
    getParties().then((p) => { if (!cancelled) setParties(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Opened before the seats loaded: start at the page's seat once it is known (not an edit).
  useEffect(() => {
    if (defaultSeat && !initial.const_id && form.const_id === '') {
      setInitial((i) => ({ ...i, const_id: defaultSeat }));
      setForm((f) => ({ ...f, const_id: defaultSeat }));
    }
  }, [defaultSeat, initial.const_id, form.const_id]);

  const seatOptions = useMemo(() => seats.map((c) => ({ value: c.id, label: `${c.const_no} ${c.name}`, hint: c.type })), [seats]);
  const seatValid = seats.some((c) => c.id === form.const_id);
  const set = (patch: Partial<CreateForm>) => setForm({ ...form, ...patch });
  const canSave = !!form.name.trim() && seatValid && candidateNumbersValid(form);

  const submit = () => {
    if (!canSave || saving) return;
    void onCreate({
      election_id: electionId,
      const_id: form.const_id,
      name: form.name.trim(),
      party_id: form.party_id || INDEPENDENT,
      ...candidateAffidavit(form),
    });
  };

  return (
    <FormDialog
      open
      onRequestClose={onClose}
      title="New candidate"
      description="Starts with 0 votes in the Live Console. A person record is created with the same name; merge it later if it is a duplicate."
      footer={<PanelFooter dirty={dirty} saving={saving} canSave={canSave} onCancel={() => setForm(initial)} onSave={submit} saveLabel="Create candidate" />}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <CandidateFields
          form={form}
          onChange={set}
          parties={parties}
          flagEmptyName={form.name !== ''}
          afterParty={
            <Field label="Seat" error={form.const_id && !seatValid ? 'Pick a seat of the selected election' : undefined}>
              <Combobox label="Seat" options={seatOptions} value={form.const_id} invalid={!!form.const_id && !seatValid} onChange={(const_id) => set({ const_id })} placeholder="Find a seat…" />
            </Field>
          }
        />
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </FormDialog>
  );
}
