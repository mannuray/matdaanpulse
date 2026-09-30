import { useState, useEffect } from 'react';
import { getPartiesPaginated, createParty } from '../services/geo.service';
import { getElections } from '../services/election.service';
import { getStates } from '../services/geo.service';
import { useResourceList } from './useResourceList';
import { useToast } from '../context/ToastContext';
import type { Election, State } from '../types';

interface PartyFilters {
  stateId: number | '';
  electionId: string;
  symbol: 'all' | 'has_logo' | 'has_eci' | 'missing';
}

/**
 * CONTROLLER: Party Manager (MVC)
 * Composes generic list logic with party-specific actions and master data.
 */
export function usePartyManager() {
  const { toast, toastError } = useToast();
  const [elections, setElections] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getElections().then(setElections).catch(() => {});
    getStates().then(setStates).catch(() => {});
  }, []);

  const list = useResourceList<PartyFilters>({
    key: 'parties',
    initialFilters: { stateId: '', electionId: '', symbol: 'all' },
    onLoad: async (page, search, filters) => {
      const response = await getPartiesPaginated(
        page, 
        25, 
        search || undefined, 
        filters.electionId || undefined, 
        filters.stateId ? Number(filters.stateId) : undefined
      );
      
      let data = response.data;
      if (filters.symbol === 'has_logo') data = data.filter(p => !!p.symbol_url);
      else if (filters.symbol === 'has_eci') data = data.filter(p => !!p.eci_symbol_url);
      else if (filters.symbol === 'missing') data = data.filter(p => !p.symbol_url && !p.eci_symbol_url);

      return { data, total: response.pagination.total };
    }
  });

  const handleCreate = async (data: Parameters<typeof createParty>[0]) => {
    setSaving(true);
    try {
      await createParty(data);
      toast('Party registered successfully');
      list.refresh();
      return true;
    } catch (err) {
      toastError(err, 'Registration failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    ...list,
    elections,
    states,
    saving,
    handleCreate
  };
}
