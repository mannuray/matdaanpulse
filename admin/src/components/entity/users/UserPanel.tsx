import { useEffect, useRef, useState } from 'react';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import {
  EMPTY_USER, MIN_PASSWORD, ROLE_OPTIONS, sameUserForm, userPatch, validateUser,
  type SaveOutcome, type UserForm, type UserRole,
} from '../../../hooks/useUserManager';
import type { UpdateUserData } from '../../../services/user.service';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { PasswordInput } from '../../ui/PasswordInput';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import type { User } from '../../../types';

interface UserPanelProps {
  /** From the loaded list (there is no GET-by-id); null while loading, after a failed load, or for an unknown id. */
  user: User | null;
  isSelf: boolean;
  listLoading: boolean;
  listError: string | null;
  saving: boolean;
  onRetry: () => void;
  onClose: () => void;
  onSave: (data: UpdateUserData) => Promise<SaveOutcome<User>>;
  onDelete: () => Promise<SaveOutcome<true>>;
  onDeleted: () => void;
}

const toForm = (u: User): UserForm => ({ name: u.name, email: u.email, role: u.role, password: '' });

/** One account: name, email, role, an optional new password, and Delete. The page keys it by id. */
export function UserPanel({ user, isSelf, listLoading, listError, saving, onRetry, onClose, onSave, onDelete, onDeleted }: UserPanelProps) {
  const [form, setForm] = useState<UserForm>(() => (user ? toForm(user) : EMPTY_USER));
  const [saved, setSaved] = useState<UserForm>(() => (user ? toForm(user) : EMPTY_USER));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  // A deep link can open the panel before the list arrives: take the record once, when it does.
  const filled = useRef(!!user);
  useEffect(() => {
    if (user && !filled.current) {
      filled.current = true;
      const next = toForm(user);
      setForm(next);
      setSaved(next);
    }
  }, [user]);

  const dirty = !sameUserForm(form, saved);
  useUnsavedGuard(dirty);
  const set = (patch: Partial<UserForm>) => setForm({ ...form, ...patch });

  const save = async () => {
    const problems = validateUser(form, false);
    setErrors(problems);
    setBanner(null);
    if (Object.keys(problems).length > 0) return;
    const submitted = form;
    const out = await onSave(userPatch(submitted, isSelf));
    if (out.ok) {
      // The submitted values are the new baseline; edits typed during the save stay dirty.
      const next = { ...submitted, name: submitted.name.trim(), email: submitted.email.trim(), password: '' };
      setSaved(next);
      if (sameUserForm(formRef.current, submitted)) setForm(next);
    } else {
      setErrors(out.fields);
      setBanner(out.banner);
    }
  };

  const remove = async () => {
    setDeleting(true);
    const out = await onDelete();
    setDeleting(false);
    setConfirmDelete(false);
    if (out.ok) onDeleted();
    else setBanner(out.banner);
  };

  const roleHint = isSelf ? 'You cannot change your own role.' : ROLE_OPTIONS.find((o) => o.value === form.role)?.hint;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={user?.name || 'User'}
      description={user?.email}
      footer={user ? (
        <PanelFooter
          dirty={dirty}
          saving={saving}
          canSave={!!form.name.trim() && !!form.email.trim()}
          onCancel={() => { setForm(saved); setErrors({}); setBanner(null); }}
          onSave={() => { void save(); }}
        />
      ) : undefined}
    >
      {!user ? (
        listLoading ? <p className="py-10 text-center text-sm text-muted">Loading user…</p>
          : listError
            ? <EmptyState title="Could not load users" description={listError} action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>} />
            : <EmptyState title="User not found" description="The account may have been deleted. Close this panel to go back to the list." />
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-5">
          {banner && <div role="alert" className="rounded-control border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad-text">{banner}</div>}
          <FormSection title="Account">
            <Field label="Name" error={errors.name}>
              <Input value={form.name} invalid={!!errors.name} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={form.email} invalid={!!errors.email} autoComplete="off" onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Role" error={errors.role} hint={roleHint}>
              <Select value={form.role} disabled={isSelf} onChange={(e) => set({ role: e.target.value as UserRole })}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
              </Select>
            </Field>
          </FormSection>
          <FormSection title="Password">
            <PasswordInput
              label="Set new password"
              autoComplete="new-password"
              value={form.password}
              error={errors.password}
              hint={`Leave empty to keep the current password. At least ${MIN_PASSWORD} characters.`}
              onChange={(e) => set({ password: e.target.value })}
            />
          </FormSection>
          <FormSection title="Remove access">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-2">
                {isSelf ? 'You cannot delete your own account.' : 'They are signed out and can no longer sign in. Their audit log entries are kept.'}
              </p>
              <Button size="sm" variant="danger" disabled={isSelf || deleting} onClick={() => setConfirmDelete(true)}>Delete user</Button>
            </div>
          </FormSection>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${user?.name ?? 'this user'}?`}
        description="They are signed out at once and can no longer sign in. Their audit log entries are kept."
        confirmLabel="Yes, delete"
        busy={deleting}
        onConfirm={() => { void remove(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  );
}
