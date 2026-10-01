import { useState } from 'react';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { EMPTY_USER, MIN_PASSWORD, ROLE_OPTIONS, sameUserForm, validateUser, type SaveOutcome, type UserForm, type UserRole } from '../../../hooks/useUserManager';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { PasswordInput } from '../../ui/PasswordInput';
import { PanelFooter } from '../PanelFooter';
import type { User } from '../../../types';

interface UserCreatePanelProps {
  saving: boolean;
  onCreate: (form: UserForm) => Promise<SaveOutcome<User>>;
  onCreated: (user: User) => void;
  onClose: () => void;
}

/** /users/new: name, email, temporary password, role. */
export function UserCreatePanel({ saving, onCreate, onCreated, onClose }: UserCreatePanelProps) {
  const [form, setForm] = useState<UserForm>(EMPTY_USER);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const dirty = !sameUserForm(form, EMPTY_USER);
  useUnsavedGuard(dirty);
  const set = (patch: Partial<UserForm>) => setForm({ ...form, ...patch });

  const submit = async () => {
    if (saving) return;
    const problems = validateUser(form, true);
    setErrors(problems);
    setBanner(null);
    if (Object.keys(problems).length > 0) return;
    const out = await onCreate(form);
    if (out.ok) onCreated(out.value);
    else { setErrors(out.fields); setBanner(out.banner); }
  };

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title="New user"
      description="They sign in with this email and the temporary password."
      footer={
        <PanelFooter
          dirty={dirty}
          saving={saving}
          canSave={!!form.name.trim() && !!form.email.trim() && !!form.password}
          onCancel={() => { setForm(EMPTY_USER); setErrors({}); setBanner(null); }}
          onSave={() => { void submit(); }}
          saveLabel="Create user"
        />
      }
    >
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-5">
        {banner && <div role="alert" className="rounded-control border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad-text">{banner}</div>}
        <FormSection title="Account">
          <Field label="Name" error={errors.name}>
            <Input value={form.name} invalid={!!errors.name} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={form.email} invalid={!!errors.email} autoComplete="off" onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <PasswordInput
            label="Temporary password"
            autoComplete="new-password"
            value={form.password}
            error={errors.password}
            hint={`At least ${MIN_PASSWORD} characters.`}
            onChange={(e) => set({ password: e.target.value })}
          />
          <Field label="Role" error={errors.role}>
            <Select value={form.role} onChange={(e) => set({ role: e.target.value as UserRole })}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
            </Select>
          </Field>
        </FormSection>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
