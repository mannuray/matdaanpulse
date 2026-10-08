import { getParty, updateParty } from '../services/party.service';
import { blankToNull } from '../utils/record-payload';
import { type RecordLoadErrorKind } from './useRecordQuery';
import { useRecordForm } from './useRecordForm';
import type { EciRecognition, Party } from '../types';

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
  /** '' = not set (saved as null). */
  eci_recognition: EciRecognition | '';
}

const EMPTY_FORM: PartyForm = {
  name: '', color: '', symbol_url: '', eci_symbol_url: '', abbreviation: '', leader_name: '',
  founded_year: '', headquarters: '', website: '', wikipedia_url: '', description: '', eci_recognition: '',
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
  eci_recognition: data.eci_recognition || '',
});

/** Empty, or a 4-digit year. */
export const isValidYear = (v: string) => v.trim() === '' || /^\d{4}$/.test(v.trim());

/** See RecordLoadErrorKind: 'not_found' (404 or 400) or a retryable 'failed'. */
export type LoadError = RecordLoadErrorKind;

/**
 * CONTROLLER: Party Edit (MVC)
 * Party identity and branding. `dirty` compares the form with the last loaded/saved snapshot.
 */
export function usePartyEdit(id?: string) {
  const rf = useRecordForm<Party, PartyForm>({
    id,
    load: getParty,
    toForm,
    empty: EMPTY_FORM,
    canSave: (f) => isValidYear(f.founded_year),
    save: async (pid, submitted) => {
      const year = submitted.founded_year.trim();
      // Emptied fields clear the column (null), never store ''.
      // Name is required (Save is disabled without it), so it is sent as typed.
      await updateParty(pid, { ...blankToNull(submitted), name: submitted.name, founded_year: year ? Number(year) : null });
    },
    messages: { loadFailed: 'Failed to load party data', saveFailed: 'Update failed', saved: 'Party profile updated' },
  });

  return {
    fieldErrors: rf.fieldErrors,
    party: rf.record, loading: rf.loading, loadError: rf.loadError, saving: rf.saving,
    form: rf.form, setForm: rf.setForm, dirty: rf.dirty, reset: rf.reset,
    handleSave: rf.save, refresh: rf.refresh,
  };
}
