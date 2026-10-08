import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getCandidate, updateCandidate, changeCandidatePerson, splitCandidate, type CandidateAffidavit,
} from '../services/candidate.service';
import { getPersons, updatePerson } from '../services/person.api';
import { getParties } from '../services/party.service';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import { recordLoadErrorKind, type RecordLoadErrorKind } from './useRecordQuery';
import type { Candidate, Party, PersonWithStats } from '../types';

/** The create and edit form. The affidavit fields are text as typed; `candidateAffidavit` turns them into numbers. */
export interface CandidateForm {
  name: string;
  party_id: string;
  age: string;
  assets: string;
  liabilities: string;
  criminal_cases: string;
}

/** The record page's form: the create fields, the Incumbent toggle, and the person's photo (saved on the person). */
export interface CandidateEditForm extends CandidateForm {
  is_incumbent: boolean;
  photo_url: string;
}

type AffidavitForm = Pick<CandidateForm, 'age' | 'assets' | 'liabilities' | 'criminal_cases'>;

/** Independents use the real `IND` party row (seeds, and migration 001's unique index keyed on party_id <> 'IND'). */
export const INDEPENDENT = 'IND';

export const EMPTY_AFFIDAVIT: AffidavitForm = { age: '', assets: '', liabilities: '', criminal_cases: '' };
const EMPTY_FORM: CandidateEditForm = { name: '', party_id: '', is_incumbent: false, photo_url: '', ...EMPTY_AFFIDAVIT };

/** Age / criminal cases: empty, or a whole number of 0 or more. */
export const isWholeNumberOrEmpty = (v: string) => {
  const t = v.trim();
  return t === '' || /^\d+$/.test(t);
};

/** Rupee text as typed ("₹2,45,00,000", "24500000"): ₹, commas and spaces dropped. */
const rupeeDigits = (v: string) => v.replace(/[₹,\s]/g, '');
/** Assets / liabilities: empty, or whole rupees (₹, commas and spaces allowed; no decimals or words). */
export const isRupeesOrEmpty = (v: string) => {
  const t = rupeeDigits(v);
  return t === '' || /^\d+$/.test(t);
};

/** True when the affidavit can be saved (the fields show an inline error otherwise; the backend takes whole numbers only). */
export const candidateNumbersValid = (f: AffidavitForm) =>
  isWholeNumberOrEmpty(f.age) && isWholeNumberOrEmpty(f.criminal_cases) && isRupeesOrEmpty(f.assets) && isRupeesOrEmpty(f.liabilities);

const wholeOrNull = (v: string) => (v.trim() === '' ? null : Number(v.trim()));
const rupeesOrNull = (v: string) => (rupeeDigits(v) === '' ? null : Number(rupeeDigits(v)));

/** The affidavit as PUT/POST /admin/candidates take it: top-level numbers; blank is null, "0" stays 0. */
export function candidateAffidavit(f: AffidavitForm): CandidateAffidavit {
  return {
    age: wholeOrNull(f.age),
    assets: rupeesOrNull(f.assets),
    liabilities: rupeesOrNull(f.liabilities),
    criminal_cases: wholeOrNull(f.criminal_cases),
  };
}

const toForm = (c: Candidate): CandidateEditForm => {
  // Everything as text, so retyping a stored value (50 → "50") does not count as an edit; 0 shows as "0".
  const text = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));
  return {
    name: c.name || '',
    // A stored null party is shown as Independent; it is written as IND only if the user saves.
    party_id: c.party_id || INDEPENDENT,
    is_incumbent: !!c.is_incumbent,
    photo_url: c.person?.photo_url || '',
    age: text(c.age),
    assets: text(c.assets),
    liabilities: text(c.liabilities),
    criminal_cases: text(c.criminal_cases),
  };
};

/** Names compared for "Possible duplicates": case and spacing do not matter. */
const sameName = (a: string, b: string) => a.trim().replace(/\s+/g, ' ').toUpperCase() === b.trim().replace(/\s+/g, ' ').toUpperCase();

/** See RecordLoadErrorKind: 'not_found' (404 or 400) or a retryable 'failed'. */
export type LoadError = RecordLoadErrorKind;

/**
 * CONTROLLER: Candidate Edit (MVC)
 * The candidacy form (name, party, incumbent, affidavit) and its person: change person, split into a new person,
 * and same-name persons that may be duplicates. `dirty` compares the form with the loaded/saved snapshot.
 */
export function useCandidateEdit(id?: string) {
  const { toast, toastError } = useToast();

  // Data State
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState<string | null>(null);

  // photo_url is the person's photo: shown and edited here, saved with PUT /admin/persons/:id.
  const [form, setForm] = useState<CandidateEditForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<CandidateEditForm>(EMPTY_FORM);
  const formRef = useRef(form);
  formRef.current = form;

  // Person State
  const [personSearch, setPersonSearch] = useState('');
  const [personMatches, setPersonMatches] = useState<PersonWithStats[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const [sameNamePersons, setSameNamePersons] = useState<PersonWithStats[]>([]);

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
    } catch (err) {
      const kind = recordLoadErrorKind(err);
      setLoadError(kind);
      // "Not found" is said on the page ("Candidate not found"); only other failures toast.
      if (kind === 'failed') toastError(err, 'Failed to load candidate data');
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
    const base = saved;
    const { photo_url: _p, ...fields } = submitted;
    const { photo_url: _b, ...baseFields } = base;
    const fieldsChanged = JSON.stringify(fields) !== JSON.stringify(baseFields);
    const photoChanged = submitted.photo_url !== base.photo_url;
    setSaving(true);
    setFieldErrors({});
    setPhotoError(null);
    try {
      if (fieldsChanged) {
        try {
          // Only the keys the backend accepts (it refuses metadata, gender, education, person_id…).
          await updateCandidate(id, {
            name: submitted.name,
            party_id: submitted.party_id || INDEPENDENT,
            is_incumbent: submitted.is_incumbent,
            ...candidateAffidavit(submitted),
          });
        } catch (err) {
          setFieldErrors(fieldErrorMap(err));
          toastError(err, 'Failed to update profile');
          return false;
        }
      }
      if (photoChanged && candidate?.person_id) {
        try {
          await updatePerson(candidate.person_id, { photo_url: submitted.photo_url || null });
        } catch (err) {
          // The candidate fields (if any) are saved; only the photo stays unsaved, so Save retries just that.
          setSaved({ ...submitted, photo_url: base.photo_url });
          setPhotoError(err instanceof Error && err.message ? `Photo not saved: ${err.message}` : 'Photo not saved');
          toastError(err, 'Failed to save photo');
          return false;
        }
      }
      toast(photoChanged && !fieldsChanged ? 'Photo updated' : 'Candidate profile updated');
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
    } finally {
      setSaving(false);
    }
  };

  // 3. Change person: the person search (the record's own person is never offered).
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!personSearch || personSearch.trim().length < 2) {
      setPersonMatches([]);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      try {
        const response = await getPersons(1, 10, personSearch.trim());
        setPersonMatches(response.data);
      } catch {
        setPersonMatches([]);
      }
    }, 400);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [personSearch]);
  const personId = candidate?.person_id;
  const personResults = useMemo(() => personMatches.filter((p) => p.id !== personId), [personMatches, personId]);

  // 4. Possible duplicates: other persons with this ballot name (or the person's name). One lookup per record.
  const ballotName = candidate?.name;
  const personName = candidate?.person?.name;
  useEffect(() => {
    if (!ballotName || !personId) { setSameNamePersons([]); return; }
    let cancelled = false;
    getPersons(1, 20, ballotName.trim())
      .then((r) => {
        if (cancelled) return;
        setSameNamePersons((r.data ?? []).filter((p) =>
          p.id !== personId && (sameName(p.name, ballotName) || (!!personName && sameName(p.name, personName)))));
      })
      .catch(() => { if (!cancelled) setSameNamePersons([]); });
    return () => { cancelled = true; };
  }, [ballotName, personName, personId]);

  // Person actions resolve truthy only when something changed (the page then refreshes the list).
  const changePerson = async (newPersonId: string): Promise<boolean> => {
    if (!id || isLinking) return false;
    setIsLinking(true);
    try {
      const merge_id = (await changeCandidatePerson(id, newPersonId))?.merge_id;
      const target = personMatches.find((p) => p.id === newPersonId)?.name ?? 'another person';
      const from = candidate?.person?.name ?? candidate?.name ?? 'the old person';
      toast(merge_id
        ? `Merged ${from} into ${target}. A super admin can undo it from ${target}'s merge history.`
        : `Contest moved to ${target}`);
      setPersonSearch('');
      await loadData();
      return true;
    } catch (err) {
      toastError(err, 'Change person failed');
      return false;
    } finally {
      setIsLinking(false);
    }
  };

  /** Move this contest to a new person record; resolves the new person's id (null when refused or failed). */
  const split = async (): Promise<string | null> => {
    if (!id || isLinking) return null;
    setIsLinking(true);
    try {
      const { person_id } = await splitCandidate(id);
      toast('Contest moved to a new person record');
      await loadData();
      return person_id;
    } catch (err) {
      toastError(err, 'Split failed');
      return null;
    } finally {
      setIsLinking(false);
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  /** Drop unsaved edits (panel Cancel). */
  const reset = () => { setForm(saved); setFieldErrors({}); setPhotoError(null); };

  return {
    fieldErrors, photoError,
    candidate, parties, loading, loadError, saving, form, setForm, dirty, reset, refresh: loadData,
    personSearch, setPersonSearch, personResults, isLinking, sameNamePersons,
    handleSave, changePerson, split
  };
}
