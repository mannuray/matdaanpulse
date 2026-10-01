import type { ReactNode } from 'react';
import { isWholeNumberOrEmpty, type CandidateForm } from '../../../hooks/useCandidateEdit';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import type { Party } from '../../../types';

const GENDERS = ['Male', 'Female', 'Other'];
const NUMBER_ERROR = 'Enter a whole number';

interface CandidateFieldsProps {
  form: CandidateForm;
  onChange: (patch: Partial<CandidateForm>) => void;
  parties: Party[];
  /** Extra control after Party (the create panel's Seat select). */
  afterParty?: ReactNode;
  /** Say "Name is required" while the name is empty (off on a fresh create form; its Create button is disabled instead). */
  flagEmptyName?: boolean;
}

/** Name, party and affidavit fields, shared by the candidate panel and the create panel. */
export function CandidateFields({ form, onChange: set, parties, afterParty, flagEmptyName = true }: CandidateFieldsProps) {
  const nameError = flagEmptyName && !form.name.trim() ? 'Name is required' : undefined;
  const ageError = isWholeNumberOrEmpty(form.age) ? undefined : NUMBER_ERROR;
  const casesError = isWholeNumberOrEmpty(form.criminal_cases) ? undefined : NUMBER_ERROR;
  return (
    <FormSection title="Details">
      <Field label="Name" error={nameError}>
        <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label="Party">
        <Select value={form.party_id} onChange={(e) => set({ party_id: e.target.value })}>
          <option value="">Independent</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          {form.party_id && !parties.some((p) => p.id === form.party_id) && <option value={form.party_id}>{form.party_id}</option>}
        </Select>
      </Field>
      {afterParty}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Gender">
          <Select value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
            <option value="">Not specified</option>
            {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
            {form.gender && !GENDERS.includes(form.gender) && <option value={form.gender}>{form.gender}</option>}
          </Select>
        </Field>
        <Field label="Age" error={ageError}>
          <Input inputMode="numeric" value={form.age} invalid={!!ageError} onChange={(e) => set({ age: e.target.value })} />
        </Field>
      </div>
      <Field label="Education">
        <Input value={form.education} onChange={(e) => set({ education: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Criminal cases" error={casesError}>
          <Input inputMode="numeric" value={form.criminal_cases} invalid={!!casesError} onChange={(e) => set({ criminal_cases: e.target.value })} />
        </Field>
        <Field label="Declared assets">
          <Input value={form.assets} onChange={(e) => set({ assets: e.target.value })} />
        </Field>
      </div>
    </FormSection>
  );
}
