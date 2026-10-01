import { useState, useEffect, useCallback, useRef } from 'react';
import { getParty, updateParty } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { ApiError, fieldErrorMap } from '../services/api-client';
import type { Party } from '../types';

export interface PartyForm {
  name: string;
  color: string;
  symbol_url: string;
  eci_symbol_url: string;
  abbreviation: string;
  leader_name: string;
  founded_year: string;
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
  founded_year: data.founded_year != null ? String(data.founded_year) : '',
  headquarters: data.headquarters || '',
  website: data.website || '',
  wikipedia_url: data.wikipedia_url || '',
  description: data.description || '',
});

/** Empty, or a 4-digit year. */
export const isValidYear = (v: string) => v.trim() === '' || /^\d{4}$/.test(v.trim());

/** 'not_found' only for a 404; anything else (network, 5xx) is a retryable failure. */
export type LoadError = 'not_found' | 'failed';

/**
 * CONTROLLER: Party Edit (MVC)
 * Party identity and branding. `dirty` compares the form with the last loaded/saved snapshot.
 */
export function usePartyEdit(id?: string) {
  const { toast, toastError } = useToast();

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PartyForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<PartyForm>(EMPTY_FORM);
  const formRef = useRef(form);
  formRef.current = form;

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getParty(id);
      const next = toForm(data);
      setParty(data);
      setForm(next);
      setSaved(next);
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'failed');
      toastError(err, 'Failed to load party data');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!id || !isValidYear(form.founded_year)) return false;
    const submitted = form;
    setSaving(true);
    setFieldErrors({});
    try {
      const year = submitted.founded_year.trim();
      await updateParty(id, { ...submitted, founded_year: year ? Number(year) : null });
      toast('Party profile updated');
      // The submitted values are now the saved baseline; edits typed while saving stay dirty.
      setSaved(submitted);
      try {
        const data = await getParty(id);
        setParty(data);
        if (JSON.stringify(formRef.current) === JSON.stringify(submitted)) {
          const next = toForm(data);
          setForm(next);
          setSaved(next);
        }
      } catch { /* saved fine; the list refresh and next open will show server state */ }
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
    party, loading, loadError, saving, form, setForm, dirty, reset,
    handleSave, refresh: loadData
  };
}
