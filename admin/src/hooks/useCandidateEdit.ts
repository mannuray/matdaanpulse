import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getCandidate, updateCandidate,
  unlinkCandidatePerson, linkCandidatePerson
} from '../services/candidate.service';
import { getPersons, createPerson } from '../services/person.api';
import { getParties } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../services/api-client';
import type { Candidate, Party, PersonWithStats } from '../types';

export interface CandidateForm {
  name: string;
  party_id: string;
  age: string | number;
  gender: string;
  education: string;
  criminal_cases: string | number;
  assets: string;
}

const EMPTY_FORM: CandidateForm = { name: '', party_id: '', age: '', gender: '', education: '', criminal_cases: '', assets: '' };

/** Age / criminal cases: empty, or a whole number of 0 or more. */
export const isWholeNumberOrEmpty = (v: string | number) => {
  const t = String(v).trim();
  return t === '' || /^\d+$/.test(t);
};

/** True when the form's numeric fields can be saved (the panels show an inline error otherwise). */
export const candidateNumbersValid = (f: Pick<CandidateForm, 'age' | 'criminal_cases'>) =>
  isWholeNumberOrEmpty(f.age) && isWholeNumberOrEmpty(f.criminal_cases);

const wholeOrNull = (v: string | number) => {
  const t = String(v).trim();
  return t === '' ? null : Number(t);
};
const textOrNull = (v: string) => (v.trim() === '' ? null : v);

/** The affidavit fields as stored in candidate metadata; emptied fields are sent as null, never ''. */
export function candidateMetadata(f: CandidateForm): Record<string, unknown> {
  return {
    age: wholeOrNull(f.age),
    gender: textOrNull(f.gender),
    education: textOrNull(f.education),
    criminal_cases: wholeOrNull(f.criminal_cases),
    assets: textOrNull(f.assets),
  };
}

const toForm = (c: Candidate): CandidateForm => {
  const meta = (c.metadata || {}) as Record<string, unknown>;
  // Everything as text, so retyping a stored value (50 → "50") does not count as an edit.
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    name: c.name || '',
    party_id: c.party_id || '',
    age: text(meta.age),
    gender: text(meta.gender),
    education: text(meta.education),
    criminal_cases: text(meta.criminal_cases),
    assets: text(meta.assets)
  };
};

/** 'not_found' only for a 404; anything else (network, 5xx) is a retryable failure. */
export type LoadError = 'not_found' | 'failed';

/**
 * CONTROLLER: Candidate Edit (MVC)
 * Manages candidate form state, and master record linking. `dirty` compares the form with the loaded/saved snapshot.
 */
export function useCandidateEdit(id?: string) {
  const { toast, toastError } = useToast();

  // Data State
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [saving, setSaving] = useState(false);

  // The photo belongs to the linked person; it is shown read-only, never sent here.
  const [form, setForm] = useState<CandidateForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<CandidateForm>(EMPTY_FORM);
  const formRef = useRef(form);
  formRef.current = form;

  // Linking State
  const [personSearch, setPersonSearch] = useState('');
  const [personResults, setPersonResults] = useState<PersonWithStats[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // 1. Initial Load
  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [c, p] = await Promise.all([
        getCandidate(id),
        getParties().catch(() => [])
      ]);
      setCandidate(c);
      setParties(p);

      const next = toForm(c);
      setForm(next);
      setSaved(next);
      // Unlinked: start the person search with the candidate's name (the old table "Find" link).
      setPersonSearch(c.person_id ? '' : c.name);
    } catch (err) {
      setLoadError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'failed');
      toastError(err, 'Failed to load candidate data');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 2. Save Logic
  const handleSave = async () => {
    if (!id || !form.name.trim() || !candidateNumbersValid(form)) return false;
    const submitted = form;
    setSaving(true);
    try {
      await updateCandidate(id, {
        name: submitted.name,
        party_id: submitted.party_id || null,
        metadata: {
          // Keep keys this form does not edit (e.g. affidavit links from the seed).
          ...(candidate?.metadata ?? {}),
          ...candidateMetadata(submitted)
        }
      });
      toast('Candidate profile updated');
      // The submitted values are now the saved baseline; edits typed while saving stay dirty.
      setSaved(submitted);
      try {
        const c = await getCandidate(id);
        setCandidate(c);
        if (JSON.stringify(formRef.current) === JSON.stringify(submitted)) {
          const next = toForm(c);
          setForm(next);
          setSaved(next);
        }
      } catch { /* saved fine; the list refresh and next open will show server state */ }
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

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  /** Drop unsaved edits (panel Cancel). */
  const reset = () => setForm(saved);

  return {
    candidate, parties, loading, loadError, saving, form, setForm, dirty, reset, refresh: loadData,
    personSearch, setPersonSearch, personResults, isLinking,
    handleSave, linkToPerson, createMasterRecord, unlink
  };
}
