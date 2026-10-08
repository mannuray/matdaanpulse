import { useState, useEffect } from 'react';
import {
  getCandidate, updateCandidate, changeCandidatePerson, splitCandidate, type CandidateAffidavit,
} from '../services/candidate.service';
import { getPersons, updatePerson } from '../services/person.api';
import { useParties } from './useParties';
import { useToast } from '../context/ToastContext';
import { type RecordLoadErrorKind } from './useRecordQuery';
import { useRecordForm } from './useRecordForm';
import { usePersonSearch } from './usePersonSearch';
import type { Candidate, PersonWithStats } from '../types';


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
  const parties = useParties();
  const [photoError, setPhotoError] = useState<string | null>(null);

  // photo_url is the person's photo: shown and edited here, saved with PUT /admin/persons/:id.
  const rf = useRecordForm<Candidate, CandidateEditForm>({
    id,
    load: getCandidate,
    toForm,
    empty: EMPTY_FORM,
    canSave: (f) => !!f.name.trim() && candidateNumbersValid(f),
    save: async (cid, submitted, { base, record, setSaved }) => {
      setPhotoError(null);
      const { photo_url: _p, ...fields } = submitted;
      const { photo_url: _b, ...baseFields } = base;
      if (JSON.stringify(fields) !== JSON.stringify(baseFields)) {
        // Only the keys the backend accepts (it refuses metadata, gender, education, person_id…).
        // A failure here throws: field errors + 'Failed to update profile'.
        await updateCandidate(cid, {
          name: submitted.name,
          party_id: submitted.party_id || INDEPENDENT,
          is_incumbent: submitted.is_incumbent,
          ...candidateAffidavit(submitted),
        });
      }
      if (submitted.photo_url !== base.photo_url && record?.person_id) {
        try {
          await updatePerson(record.person_id, { photo_url: submitted.photo_url || null });
        } catch (err) {
          // The candidate fields (if any) are saved; only the photo stays unsaved, so Save retries just that.
          setSaved({ ...submitted, photo_url: base.photo_url });
          setPhotoError(err instanceof Error && err.message ? `Photo not saved: ${err.message}` : 'Photo not saved');
          toastError(err, 'Failed to save photo');
          return false;
        }
      }
    },
    messages: {
      loadFailed: 'Failed to load candidate data',
      saveFailed: 'Failed to update profile',
      saved: (submitted, base) => {
        const { photo_url: _p, ...fields } = submitted;
        const { photo_url: _b, ...baseFields } = base;
        const photoOnly = submitted.photo_url !== base.photo_url && JSON.stringify(fields) === JSON.stringify(baseFields);
        return photoOnly ? 'Photo updated' : 'Candidate profile updated';
      },
    },
  });
  const candidate = rf.record;

  // Change person: the person search (the record's own person is never offered).
  const [personSearch, setPersonSearch] = useState('');
  const personId = candidate?.person_id;
  const personResults = usePersonSearch(personSearch, { excludeId: personId });
  const [isLinking, setIsLinking] = useState(false);
  const [sameNamePersons, setSameNamePersons] = useState<PersonWithStats[]>([]);

  // Possible duplicates: other persons with this ballot name (or the person's name). One lookup per record.
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
      const target = personResults.find((p) => p.id === newPersonId)?.name ?? 'another person';
      const from = candidate?.person?.name ?? candidate?.name ?? 'the old person';
      toast(merge_id
        ? `Merged ${from} into ${target}. A super admin can undo it from ${target}'s merge history.`
        : `Contest moved to ${target}`);
      setPersonSearch('');
      await rf.refresh();
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
      await rf.refresh();
      return person_id;
    } catch (err) {
      toastError(err, 'Split failed');
      return null;
    } finally {
      setIsLinking(false);
    }
  };

  /** Drop unsaved edits (panel Cancel). */
  const reset = () => { rf.reset(); setPhotoError(null); };

  return {
    fieldErrors: rf.fieldErrors, photoError,
    candidate, parties, loading: rf.loading, loadError: rf.loadError, saving: rf.saving,
    form: rf.form, setForm: rf.setForm, dirty: rf.dirty, reset, refresh: rf.refresh,
    personSearch, setPersonSearch, personResults, isLinking, sameNamePersons,
    handleSave: rf.save, changePerson, split,
  };
}
