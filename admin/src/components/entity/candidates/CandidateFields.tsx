import type { ReactNode } from 'react';
import { INDEPENDENT, isRupeesOrEmpty, isWholeNumberOrEmpty, type CandidateForm } from '../../../hooks/useCandidateEdit';
import { assetsHelper } from '../../../utils/numbers';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import type { Party } from '../../../types';

const NUMBER_ERROR = 'Enter a whole number';
const RUPEES_ERROR = 'Enter whole rupees';

interface FieldsProps {
  form: CandidateForm;
  onChange: (patch: Partial<CandidateForm>) => void;
  /** Server field errors by field name (`name`, `party_id`, `age`, `assets`…); the record page passes them. */
  errors?: Record<string, string>;
}

interface IdentityFieldsProps extends FieldsProps {
  parties: Party[];
  /** Next to Party (the record page's Incumbent toggle). */
  besideParty?: ReactNode;
  /** After Party (the create dialog's Seat select). */
  afterParty?: ReactNode;
  /** Say "Name is required" while the name is empty (off on a fresh create form; its Create button is disabled instead). */
  flagEmptyName?: boolean;
}

/** Name and party, shared by the record page's Candidate card and the create dialog. */
export function CandidateIdentityFields({ form, onChange: set, parties, besideParty, afterParty, flagEmptyName = true, errors = {} }: IdentityFieldsProps) {
  const nameError = flagEmptyName && !form.name.trim() ? 'Name is required' : errors.name;
  const partyError = errors.party_id;
  // Independent (the IND party row) first, listed once, even before the party list has loaded.
  const ind = parties.find((p) => p.id === INDEPENDENT);
  const partyOptions = [
    { id: INDEPENDENT, name: ind?.name || 'Independent' },
    ...parties.filter((p) => p.id !== INDEPENDENT),
  ];
  const party = (
    <Field label="Party" error={partyError} className={besideParty ? 'min-w-0 flex-1' : undefined}>
      <Select value={form.party_id} invalid={!!partyError} onChange={(e) => set({ party_id: e.target.value })}>
        {partyOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        {form.party_id && !partyOptions.some((p) => p.id === form.party_id) && <option value={form.party_id}>{form.party_id}</option>}
      </Select>
    </Field>
  );
  return (
    <div className="space-y-4">
      <Field label="Name" error={nameError}>
        <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      {besideParty ? <div className="flex flex-wrap items-end gap-4">{party}{besideParty}</div> : party}
      {afterParty}
    </div>
  );
}

/** The affidavit for this run: age, criminal cases, declared assets and liabilities (rupees, with the crore / lakh helper). */
export function CandidateAffidavitFields({ form, onChange: set, errors = {} }: FieldsProps) {
  const ageError = isWholeNumberOrEmpty(form.age) ? errors.age : NUMBER_ERROR;
  const casesError = isWholeNumberOrEmpty(form.criminal_cases) ? errors.criminal_cases : NUMBER_ERROR;
  const assetsError = isRupeesOrEmpty(form.assets) ? errors.assets : RUPEES_ERROR;
  const liabilitiesError = isRupeesOrEmpty(form.liabilities) ? errors.liabilities : RUPEES_ERROR;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Age" error={ageError}>
          <Input inputMode="numeric" value={form.age} invalid={!!ageError} onChange={(e) => set({ age: e.target.value })} />
        </Field>
        <Field label="Criminal cases" error={casesError}>
          <Input inputMode="numeric" value={form.criminal_cases} invalid={!!casesError} onChange={(e) => set({ criminal_cases: e.target.value })} />
        </Field>
      </div>
      <Field label="Declared assets" hint={assetsHelper(form.assets) ?? undefined} error={assetsError}>
        <Input inputMode="numeric" value={form.assets} invalid={!!assetsError} placeholder="Rupees, e.g. 24500000" onChange={(e) => set({ assets: e.target.value })} />
      </Field>
      <Field label="Declared liabilities" hint={assetsHelper(form.liabilities) ?? undefined} error={liabilitiesError}>
        <Input inputMode="numeric" value={form.liabilities} invalid={!!liabilitiesError} placeholder="Rupees, e.g. 1250000" onChange={(e) => set({ liabilities: e.target.value })} />
      </Field>
    </div>
  );
}

/** Every create field in one section (the create dialog). */
export function CandidateFields({ form, onChange, parties, afterParty, flagEmptyName }: Omit<IdentityFieldsProps, 'besideParty'>) {
  return (
    <FormSection title="Details">
      <CandidateIdentityFields form={form} onChange={onChange} parties={parties} afterParty={afterParty} flagEmptyName={flagEmptyName} />
      <CandidateAffidavitFields form={form} onChange={onChange} />
    </FormSection>
  );
}
