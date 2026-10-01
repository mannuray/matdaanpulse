import { useState, useEffect } from 'react';
import { getElections, createElection, updateElection, finalizeElection } from '../services/election.service';
import { getStates } from '../services/geo.service';
import { useResourceList } from './useResourceList';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import type { Election, State } from '../types';

interface ElectionFilters {
  status: string;
  type: '' | 'LS' | 'VS';
  stateId: number | null;
}

export interface ElectionFormState {
  name: string;
  type: 'LS' | 'VS';
  /** Kept as typed text so a half-typed year is never coerced to NaN. */
  year: string;
  state_id: string;
  tentative_next_date: string;
}

export const INITIAL_ELECTION_FORM: ElectionFormState = {
  name: '',
  type: 'LS',
  year: String(new Date().getFullYear()),
  state_id: '',
  tentative_next_date: ''
};

/** A year is required: exactly 4 digits. */
export const isValidElectionYear = (v: string) => /^\d{4}$/.test(v.trim());

/** `<input type="date">` needs YYYY-MM-DD; the API may return a full ISO timestamp. */
const toForm = (el: Election): ElectionFormState => ({
  name: el.name,
  type: el.type,
  year: String(el.year),
  state_id: el.state_id?.toString() || '',
  tentative_next_date: el.tentative_next_date ? el.tentative_next_date.slice(0, 10) : ''
});

interface Options {
  /** Awaited after a create, update, go-live or finalize (the page reloads the top-bar election list). */
  onChanged?: () => void | Promise<void>;
}

/**
 * CONTROLLER: Election Manager (MVC)
 * Election lifecycle, list and the panel form. `dirty` compares the form with the opened/saved snapshot.
 */
export function useElectionManager({ onChanged }: Options = {}) {
  const { toast, toastError } = useToast();
  const [states, setStates] = useState<State[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmFinalize, setConfirmFinalize] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ElectionFormState>(INITIAL_ELECTION_FORM);
  const [savedForm, setSavedForm] = useState<ElectionFormState>(INITIAL_ELECTION_FORM);

  useEffect(() => {
    getStates().then(setStates).catch(() => {});
  }, []);

  const list = useResourceList<ElectionFilters>({
    key: 'elections',
    initialFilters: { status: '', type: '', stateId: null },
    onLoad: async (_page, search, filters) => {
      const data = await getElections({
        type: filters.type || undefined,
        status: filters.status || undefined
      });
      const filtered = search
        ? data.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
        : data;
      return { data: filtered, total: filtered.length };
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(INITIAL_ELECTION_FORM);
    setSavedForm(INITIAL_ELECTION_FORM);
    setFieldErrors({});
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (el: Election) => {
    const f = toForm(el);
    setForm(f);
    setSavedForm(f);
    setEditId(el.id);
    setFieldErrors({});
    setShowForm(true);
  };

  /** Drop unsaved edits (panel Cancel). */
  const revert = () => { setForm(savedForm); setFieldErrors({}); };

  /** Saves the form; resolves to the saved election's id (the new id on create) or null on failure. */
  const handleSave = async (e?: { preventDefault(): void }): Promise<string | null> => {
    e?.preventDefault();
    if (!form.name.trim() || !isValidElectionYear(form.year)) return null;
    const submitted = form;
    setSaving(true);
    setFieldErrors({});

    const base = {
      name: submitted.name,
      type: submitted.type,
      year: Number(submitted.year.trim()),
    };

    try {
      let savedId: string;
      if (editId) {
        // Edit always sends both fields so clearing them (VS to LS, no date) reaches the server as null.
        await updateElection(editId, {
          ...base,
          state_id: submitted.state_id ? Number(submitted.state_id) : null,
          tentative_next_date: submitted.tentative_next_date || null,
        });
        savedId = editId;
        // The submitted values are the saved baseline; edits typed while saving stay dirty.
        setSavedForm(submitted);
        toast('Election updated successfully');
      } else {
        const created = await createElection({
          ...base,
          ...(submitted.state_id ? { state_id: Number(submitted.state_id) } : {}),
          ...(submitted.tentative_next_date ? { tentative_next_date: submitted.tentative_next_date } : {}),
        });
        savedId = created.id;
        setForm(INITIAL_ELECTION_FORM);
        setSavedForm(INITIAL_ELECTION_FORM);
        toast('New election registered');
      }
      list.refresh();
      await onChanged?.();
      return savedId;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Operation failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (id: string) => {
    try {
      await finalizeElection(id);
      toast('Election finalized and archived');
      list.refresh();
      await onChanged?.();
    } catch (err) {
      toastError(err, 'Finalization failed');
    }
  };

  const goLive = async (id: string) => {
    try {
      await updateElection(id, { status: 'Live' });
      toast('Election is now live');
      list.refresh();
      await onChanged?.();
    } catch (err) {
      toastError(err, 'Failed to go live');
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  return {
    fieldErrors,
    ...list,
    states,
    saving,
    confirmFinalize,
    setConfirmFinalize,
    showForm,
    setShowForm,
    editId,
    form,
    setForm,
    dirty,
    revert,
    startCreate,
    startEdit,
    handleSave,
    handleFinalize,
    goLive,
    resetForm
  };
}
