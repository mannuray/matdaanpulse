import { useState } from 'react';
import { getPerson, updatePerson, mergePersons, undoMerge } from '../services/person.api';
import { PersonService } from '../services/person.service';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../services/api-client';
import { blankToNull } from '../utils/record-payload';
import { recordLoadErrorKind, type RecordLoadErrorKind } from './useRecordQuery';
import { useRecordForm } from './useRecordForm';
import { usePersonSearch } from './usePersonSearch';
import type { PersonWithCandidates } from '../types';

export type PersonForm = ReturnType<typeof PersonService.prepareFormState>;

const EMPTY_FORM: PersonForm = { name: '', date_of_birth: '', gender: '', education: '', photo_url: '', bio: '', wikipedia_url: '', caste: '', religion: '' };

/** Empty, or a real calendar date as YYYY-MM-DD (what a date input produces). */
export function isValidDob(v: string): boolean {
  if (v === '') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** See RecordLoadErrorKind: 'not_found' (404 or 400) or a retryable 'failed'. */
export type LoadError = RecordLoadErrorKind;

/**
 * CONTROLLER: Person Edit (MVC)
 * Master record state and deduplication (merging). `dirty` compares the form with the loaded/saved snapshot.
 */
export function usePersonEdit(id?: string) {
  const { toast, toastError } = useToast();

  const rf = useRecordForm<PersonWithCandidates, PersonForm>({
    id,
    load: getPerson,
    toForm: PersonService.prepareFormState,
    empty: EMPTY_FORM,
    canSave: (f, person) => !!person && isValidDob(f.date_of_birth),
    save: async (pid, submitted) => {
      // Emptied fields clear the value (null), never store ''. Name is required (Save is disabled without it).
      // Every field is a column (bio, wikipedia_url, caste and religion too); the backend refuses `metadata`.
      await updatePerson(pid, { ...blankToNull(submitted), name: submitted.name });
    },
    messages: { loadFailed: 'Failed to load person record', saveFailed: 'Failed to update record', saved: 'Person record updated' },
  });
  const person = rf.record;

  const [mergeSearch, setMergeSearch] = useState('');
  const mergeResults = usePersonSearch(mergeSearch, { excludeId: id, limit: 20 });
  const [merging, setMerging] = useState(false);

  /** Merge a duplicate record INTO the person being viewed: the duplicate's contests move here and it is deleted. */
  const handleMerge = async (duplicateId: string, duplicateName: string): Promise<boolean> => {
    if (!id) return false;
    if (!window.confirm(`Merge "${duplicateName}" into "${person?.name}"? This action is permanent.`)) return false;

    setMerging(true);
    try {
      // mergePersons(sourceId, targetId): the backend deletes the source.
      await mergePersons(duplicateId, id);
      toast('Records merged. You can undo it from Merge history.');
      setMergeSearch('');
      void rf.refresh();
      return true;
    } catch (err) {
      toastError(err, 'Merge failed');
      return false;
    } finally {
      setMerging(false);
    }
  };

  /**
   * Undo a merge into this person (SUPER_ADMIN; the page confirms first). Resolves the restored person's id, and
   * whether this person is gone: one with no contests of its own is deleted once they move back. Null when refused
   * (409, e.g. a contest moved since; the toast shows the server's reason) or failed.
   */
  const [undoing, setUndoing] = useState(false);
  const handleUndo = async (mergeId: string, duplicateName?: string): Promise<{ restoredId: string; keeperGone: boolean } | null> => {
    if (!id || undoing) return null;
    setUndoing(true);
    try {
      const res = await undoMerge(mergeId);
      toast(duplicateName ? `Merge undone: ${duplicateName} is its own record again` : 'Merge undone');
      try {
        rf.applyRecord(await getPerson(id));
        rf.setLoadError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { restoredId: res.person_id, keeperGone: true };
        rf.setLoadError(recordLoadErrorKind(err));
      }
      return { restoredId: res.person_id, keeperGone: false };
    } catch (err) {
      toastError(err, 'Could not undo merge');
      return null;
    } finally {
      setUndoing(false);
    }
  };

  return {
    fieldErrors: rf.fieldErrors,
    person, loading: rf.loading, loadError: rf.loadError, saving: rf.saving,
    form: rf.form, setForm: rf.setForm, dirty: rf.dirty, reset: rf.reset,
    mergeSearch, setMergeSearch, mergeResults, merging, undoing,
    handleSave: rf.save, handleMerge, handleUndo, refresh: rf.refresh,
  };
}
