import { useState, useEffect, useCallback, useRef } from 'react';
import { getPerson, updatePerson, mergePersons, getPersons } from '../services/person.api';
import { PersonService } from '../services/person.service';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import type { PersonWithCandidates, PersonWithStats } from '../types';

/**
 * CONTROLLER: Person Edit (MVC)
 * Manages master record state and deduplication (merging).
 */
export function usePersonEdit(id?: string) {
  const { toast, toastError } = useToast();
  
  // Data State
  const [person, setPerson] = useState<PersonWithCandidates | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  
  // Form State
  const [form, setForm] = useState({
    name: '',
    date_of_birth: '',
    gender: '',
    education: '',
    photo_url: '',
    bio: '',
    wikipedia_url: ''
  });

  // Merge State
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeResults, setMergeResults] = useState<PersonWithStats[]>([]);
  const [merging, setMerging] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // 1. Initial Load
  const loadPerson = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getPerson(id);
      setPerson(data);
      setForm(PersonService.prepareFormState(data));
    } catch (err) {
      toastError(err, 'Failed to load person record');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadPerson();
  }, [loadPerson]);

  // 2. Save Logic
  const handleSave = async () => {
    if (!id || !person) return false;
    setSaving(true);
    setFieldErrors({});
    try {
      await updatePerson(id, {
        ...form,
        metadata: {
          ...person.metadata,
          wikipedia_url: form.wikipedia_url
        }
      });
      toast('Person record updated');
      loadPerson();
      return true;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Failed to update record');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // 3. Merge Logic
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
  const handleMerge = async (duplicateId: string, duplicateName: string) => {
    if (!id) return;
    if (!window.confirm(`Merge "${duplicateName}" into "${person?.name}"? This action is permanent.`)) return;

    setMerging(true);
    try {
      // mergePersons(sourceId, targetId): the backend deletes the source.
      await mergePersons(duplicateId, id);
      toast('Records merged successfully');
      setMergeSearch('');
      loadPerson();
    } catch (err) {
      toastError(err, 'Merge failed');
    } finally {
      setMerging(false);
    }
  };

  return {
    fieldErrors,
    person, loading, saving, form, setForm,
    mergeSearch, setMergeSearch, mergeResults, merging,
    handleSave, handleMerge
  };
}
