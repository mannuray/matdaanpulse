import { useState, useEffect, useCallback, useRef } from 'react';
import { getPerson, updatePerson, mergePersons, getPersons, undoMerge } from '../services/person.api';
import { PersonService } from '../services/person.service';
import { useToast } from '../context/ToastContext';
import { ApiError, fieldErrorMap } from '../services/api-client';
import { blankToNull } from '../utils/record-payload';
import { recordLoadErrorKind, type RecordLoadErrorKind } from './useRecordQuery';
import type { PersonWithCandidates, PersonWithStats } from '../types';

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

  const [person, setPerson] = useState<PersonWithCandidates | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PersonForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<PersonForm>(EMPTY_FORM);
  const formRef = useRef(form);
  formRef.current = form;

  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeResults, setMergeResults] = useState<PersonWithStats[]>([]);
  const [merging, setMerging] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadPerson = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await getPerson(id);
      const next = PersonService.prepareFormState(data);
      setPerson(data);
      setForm(next);
      setSaved(next);
    } catch (err) {
      const kind = recordLoadErrorKind(err);
      setLoadError(kind);
      // "Not found" is said on the page ("Person not found"); only other failures toast.
      if (kind === 'failed') toastError(err, 'Failed to load person record');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadPerson();
  }, [loadPerson]);

  const handleSave = async () => {
    if (!id || !person || !isValidDob(form.date_of_birth)) return false;
    const submitted = form;
    setSaving(true);
    setFieldErrors({});
    try {
      // Emptied fields clear the value (null), never store ''. Name is required (Save is disabled without it).
      // Every field is a column (bio, wikipedia_url, caste and religion too); the backend refuses `metadata`.
      await updatePerson(id, { ...blankToNull(submitted), name: submitted.name });
      toast('Person record updated');
      // The submitted values are now the saved baseline; edits typed while saving stay dirty.
      setSaved(submitted);
      try {
        const data = await getPerson(id);
        setPerson(data);
        if (JSON.stringify(formRef.current) === JSON.stringify(submitted)) {
          const next = PersonService.prepareFormState(data);
          setForm(next);
          setSaved(next);
        }
      } catch { /* saved fine; the list refresh and next open will show server state */ }
      return true;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Failed to update record');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!mergeSearch || mergeSearch.trim().length < 2) {
      setMergeResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const response = await getPersons(1, 20, mergeSearch.trim());
        setMergeResults(response.data.filter(p => p.id !== id));
      } catch {
        setMergeResults([]);
      }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [mergeSearch, id]);

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
      loadPerson();
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
        const data = await getPerson(id);
        const next = PersonService.prepareFormState(data);
        setPerson(data);
        setForm(next);
        setSaved(next);
        setLoadError(null);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return { restoredId: res.person_id, keeperGone: true };
        setLoadError(recordLoadErrorKind(err));
      }
      return { restoredId: res.person_id, keeperGone: false };
    } catch (err) {
      toastError(err, 'Could not undo merge');
      return null;
    } finally {
      setUndoing(false);
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  /** Drop unsaved edits (panel Cancel). */
  const reset = () => { setForm(saved); setFieldErrors({}); };

  return {
    fieldErrors,
    person, loading, loadError, saving, form, setForm, dirty, reset,
    mergeSearch, setMergeSearch, mergeResults, merging, undoing,
    handleSave, handleMerge, handleUndo, refresh: loadPerson
  };
}
