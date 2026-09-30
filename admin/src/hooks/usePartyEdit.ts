import { useState, useEffect, useCallback } from 'react';
import { getParty, updateParty } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import type { Party } from '../types';

/**
 * CONTROLLER: Party Edit (MVC)
 * Manages party master identity, and branding (colors/logos).
 */
export function usePartyEdit(id?: string) {
  const { toast } = useToast();
  
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [form, setForm] = useState({
    name: '',
    color: '',
    symbol_url: '',
    eci_symbol_url: '',
    abbreviation: '',
    leader_name: '',
    founded_year: '' as string | number,
    headquarters: '',
    website: '',
    wikipedia_url: '',
    description: ''
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getParty(id);
      setParty(data);
      setForm({
        name: data.name || '',
        color: data.color || '',
        symbol_url: data.symbol_url || '',
        eci_symbol_url: data.eci_symbol_url || '',
        abbreviation: data.abbreviation || '',
        leader_name: data.leader_name || '',
        founded_year: data.founded_year || '',
        headquarters: data.headquarters || '',
        website: data.website || '',
        wikipedia_url: data.wikipedia_url || '',
        description: data.description || ''
      });
    } catch {
      toast('Failed to load party data', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!id) return false;
    setSaving(true);
    try {
      await updateParty(id, {
        ...form,
        founded_year: form.founded_year ? Number(form.founded_year) : null
      });
      toast('Party profile updated');
      loadData();
      return true;
    } catch {
      toast('Update failed', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    party, loading, saving, form, setForm,
    handleSave, refresh: loadData
  };
}
