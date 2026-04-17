import { useState, useEffect } from 'react';
import { getElections, createElection, updateElection, finalizeElection } from '../services/election.service';
import { getStates } from '../services/geo.service';
import { useResourceList } from './useResourceList';
import { useToast } from '../context/ToastContext';
import type { Election, State } from '../types';

interface ElectionFilters {
  status: string;
  type: '' | 'LS' | 'VS';
  stateId: number | null;
}

interface ElectionFormState {
  name: string;
  type: 'LS' | 'VS';
  year: number;
  state_id: string;
  tentative_next_date: string;
}

const INITIAL_FORM: ElectionFormState = {
  name: '',
  type: 'LS',
  year: new Date().getFullYear(),
  state_id: '',
  tentative_next_date: ''
};

/**
 * CONTROLLER: Election Manager (MVC)
 * Manages election lifecycle, registry data, and form state.
 */
export function useElectionManager() {
  const { toast } = useToast();
  const [states, setStates] = useState<State[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmFinalize, setConfirmFinalize] = useState<string | null>(null);

  // Form State moved to Controller
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ElectionFormState>(INITIAL_FORM);

  useEffect(() => {
    getStates().then(setStates).catch(() => {});
  }, []);

  const list = useResourceList<ElectionFilters>({
    key: 'elections',
    initialFilters: { status: '', type: '', stateId: null },
    onLoad: async (page, search, filters) => {
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
    setForm(INITIAL_FORM);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (el: Election) => {
    setForm({
      name: el.name,
      type: el.type,
      year: el.year,
      state_id: el.state_id?.toString() || '',
      tentative_next_date: el.tentative_next_date || ''
    });
    setEditId(el.id);
    setShowForm(true);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    
    const payload = {
      name: form.name,
      type: form.type,
      year: form.year,
      ...(form.state_id ? { state_id: Number(form.state_id) } : {}),
      ...(form.tentative_next_date ? { tentative_next_date: form.tentative_next_date } : {}),
    };

    try {
      if (editId) {
        await updateElection(editId, payload);
        toast('Election updated successfully');
      } else {
        await createElection(payload);
        toast('New election registered');
      }
      list.refresh();
      resetForm();
      return true;
    } catch (err) {
      toast('Operation failed', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (id: string) => {
    try {
      await finalizeElection(id);
      toast('Election finalized and archived');
      list.refresh();
    } catch {
      toast('Finalization failed', 'error');
    }
  };

  const goLive = async (id: string) => {
    try {
      await updateElection(id, { status: 'Live' });
      toast('Election is now LIVE');
      list.refresh();
    } catch {
      toast('Failed to go live', 'error');
    }
  };

  return {
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
    startCreate,
    startEdit,
    handleSave,
    handleFinalize,
    goLive,
    resetForm
  };
}
