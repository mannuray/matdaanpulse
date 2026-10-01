import { useState } from 'react';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { FormDialog } from '../../ui/FormDialog';
import { Field, FormSection } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { PanelFooter } from '../PanelFooter';
import { ColourField } from './ColourField';

export interface NewParty { id: string; name: string; color: string; abbreviation?: string }

const EMPTY = { id: '', name: '', abbreviation: '', color: '#3b82f6' };

/** /parties/new: a dialog over the list with the four create fields; everything else is edited on the record page. */
export function PartyCreateDialog({ saving, onCreate, onClose }: { saving: boolean; onCreate: (data: NewParty) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  useUnsavedGuard(dirty);
  const set = (patch: Partial<typeof EMPTY>) => setForm({ ...form, ...patch });
  const canSave = !!form.id.trim() && !!form.name.trim();
  const submit = () => { if (canSave && !saving) void onCreate({
    id: form.id.trim(),
    name: form.name.trim(),
    color: form.color,
    abbreviation: form.abbreviation.trim() || undefined,
  }); };

  return (
    <FormDialog
      open
      onRequestClose={onClose}
      title="New party"
      description="Add the profile and symbols after it is created."
      footer={<PanelFooter dirty={dirty} saving={saving} canSave={canSave} onCancel={() => setForm(EMPTY)} onSave={submit} saveLabel="Create party" />}
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <FormSection title="Details">
        <Field label="ID" hint="Short code, e.g. BJP. It cannot be changed later.">
          <Input value={form.id} onChange={(e) => set({ id: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Abbreviation">
          <Input value={form.abbreviation} onChange={(e) => set({ abbreviation: e.target.value.toUpperCase() })} />
        </Field>
        <ColourField value={form.color} onChange={(color) => set({ color })} />
      </FormSection>
      <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </FormDialog>
  );
}
