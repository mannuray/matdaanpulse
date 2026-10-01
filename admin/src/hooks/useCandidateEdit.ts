import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getCandidate, updateCandidate, 
  unlinkCandidatePerson, linkCandidatePerson 
} from '../services/candidate.service';
import { getPersons, createPerson } from '../services/person.api';
import { getParties } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { toOptionalNumber } from '../utils/numbers';
import type { Candidate, Party, PersonWithStats } from '../types';

/**
 * CONTROLLER: Candidate Edit (MVC)
 * Manages candidate form state, and master record linking.
 */
export function useCandidateEdit(id?: string) {
  const { toast, toastError } = useToast();
  
  // Data State
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State (the photo belongs to the linked person; it is shown read-only, never sent here)
  const [form, setForm] = useState({
    name: '',
    party_id: '',
    age: '' as string | number,
    gender: '',
    education: '',
    criminal_cases: '' as string | number,
    assets: ''
  });

  // Linking State
  const [personSearch, setPersonSearch] = useState('');
  const [personResults, setPersonResults] = useState<PersonWithStats[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // 1. Initial Load
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        getCandidate(id),
        getParties().catch(() => [])
      ]);
      setCandidate(c);
      setParties(p);
      
      const meta = (c.metadata || {}) as any;
      setForm({
        name: c.name || '',
        party_id: c.party_id || '',
        age: meta.age ?? '',
        gender: meta.gender ?? '',
        education: meta.education ?? '',
        criminal_cases: meta.criminal_cases ?? '',
        assets: meta.assets ?? ''
      });
    } catch (err) {
      toastError(err, 'Failed to load candidate data');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Save Logic
  const handleSave = async () => {
    if (!id) return false;
    setSaving(true);
    try {
      await updateCandidate(id, {
        name: form.name,
        party_id: form.party_id,
        metadata: {
          // Keep keys this form does not edit (e.g. affidavit links from the seed).
          ...(candidate?.metadata ?? {}),
          age: toOptionalNumber(form.age),
          gender: form.gender,
          education: form.education,
          criminal_cases: toOptionalNumber(form.criminal_cases),
          assets: form.assets
        }
      });
      toast('Candidate profile updated');
      loadData();
      return true;
    } catch (err) {
      toastError(err, 'Failed to update profile');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // 3. Linking Logic
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!personSearch || personSearch.trim().length < 2) {
      setPersonResults([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      try {
        const response = await getPersons(1, 10, personSearch.trim());
        setPersonResults(response.data);
      } catch {
        setPersonResults([]);
      }
    }, 400);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [personSearch]);

  const linkToPerson = async (personId: string) => {
    if (!id) return;
    setIsLinking(true);
    try {
      await linkCandidatePerson(id, personId);
      toast('Linked to master record');
      loadData();
    } catch (err) {
      toastError(err, 'Linking failed');
    } finally {
      setIsLinking(false);
    }
  };

  const createMasterRecord = async () => {
    if (!id || !candidate) return;
    setIsLinking(true);
    try {
      const person = await createPerson(candidate.name);
      await linkCandidatePerson(id, person.id);
      toast('Master record created and linked');
      loadData();
    } catch (err) {
      toastError(err, 'Operation failed');
    } finally {
      setIsLinking(false);
    }
  };

  const unlink = async () => {
    if (!id) return;
    if (!window.confirm('Unlink from master record?')) return;
    try {
      await unlinkCandidatePerson(id);
      toast('Unlinked successfully');
      loadData();
    } catch (err) {
      toastError(err, 'Unlink failed');
    }
  };

  return {
    candidate, parties, loading, saving, form, setForm,
    personSearch, setPersonSearch, personResults, isLinking,
    handleSave, linkToPerson, createMasterRecord, unlink
  };
}
