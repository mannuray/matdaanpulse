import { useState, useEffect, useCallback } from 'react';
import { getParty, updateParty } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import type { Party } from '../types';

export interface PartyForm {
  name: string;
  color: string;
  symbol_url: string;
  eci_symbol_url: string;
  abbreviation: string;
  leader_name: string;
  founded_year: string | number;
  headquarters: string;
  website: string;
  wikipedia_url: string;
  description: string;
}

const EMPTY_FORM: PartyForm = {
  name: '', color: '', symbol_url: '', eci_symbol_url: '', abbreviation: '', leader_name: '',
  founded_year: '', headquarters: '', website: '', wikipedia_url: '', description: '',
};

const toForm = (data: Party): PartyForm => ({
  name: data.name || '',
  color: data.color || '',
  symbol_url: data.symbol_url || '',
  eci_symbol_url: data.eci_symbol_url || '',
  abbreviation: data.abbreviation || '',
  leader_name: data.leader_name || '',
  founded_year: data.founded_year ?? '',
  headquarters: data.headquarters || '',
  website: data.website || '',
  wikipedia_url: data.wikipedia_url || '',
  description: data.description || '',
});

/**
 * CONTROLLER: Party Edit (MVC)
 * Party identity and branding. `dirty` compares the form with the last loaded/saved snapshot.
 */
export function usePartyEdit(id?: string) {
  const { toast, toastError } = useToast();

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PartyForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<PartyForm>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getParty(id);
      const next = toForm(data);
      setParty(data);
      setForm(next);
      setSaved(next);
    } catch (err) {
      toastError(err, 'Failed to load party data');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!id) return false;
    setSaving(true);
    setFieldErrors({});
    try {
      await updateParty(id, {
        ...form,
        founded_year: form.founded_year ? Number(form.founded_year) : null
      });
      toast('Party profile updated');
      loadData();
      return true;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Update failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  /** Drop unsaved edits (panel Cancel). */
  const reset = () => { setForm(saved); setFieldErrors({}); };

  return {
    fieldErrors,
    party, loading, saving, form, setForm, dirty, reset,
    handleSave, refresh: loadData
  };
}
