import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  getCandidate, updateCandidate, 
  unlinkCandidatePerson, linkCandidatePerson, createCandidate 
} from '../services/candidate.service';
import { getPersons, createPerson } from '../services/person.api';
import { PersonService } from '../services/person.service';
import { getParties } from '../services/geo.service';
import { enrichCandidates } from '../services/ai.service';
import { useToast } from '../context/ToastContext';
import type { Candidate, Party, PersonWithStats } from '../types';

/**
 * CONTROLLER: Candidate Edit (MVC)
 * Manages candidate form state, master record linking, and AI enrichment.
 */
export function useCandidateEdit(id?: string) {
  const { toast } = useToast();
  
  // Data State
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Form State
  const [form, setForm] = useState({
    name: '',
    party_id: '',
    age: '' as string | number,
    gender: '',
    education: '',
    criminal_cases: '' as string | number,
    assets: '',
    photo_url: ''
  });

  // Linking State
  const [personSearch, setPersonSearch] = useState('');
  const [personResults, setPersonResults] = useState<PersonWithStats[]>([]);
  const [isLinking, setIsLinking] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  // Enrichment State
  const [enriching, setEnriching] = useState(false);

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
        age: meta.age || '',
        gender: meta.gender || '',
        education: meta.education || '',
        criminal_cases: meta.criminal_cases || 0,
        assets: meta.assets || '',
        photo_url: c.person ? c.person.photo_url || '' : ''
      });
    } catch (err) {
      toast('Failed to load candidate data', 'error');
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
          age: Number(form.age),
          gender: form.gender,
          education: form.education,
          criminal_cases: Number(form.criminal_cases),
          assets: form.assets
        }
      });
      toast('Candidate profile updated');
      loadData();
      return true;
    } catch (err) {
      toast('Failed to update profile', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // 3. Linking Logic
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!personSearch || personSearch.trim().length < 2) {
      setMergeResults([]);
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

    const setMergeResults = (val: any) => setPersonResults(val);

    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [personSearch]);

  const linkToPerson = async (personId: string) => {
    if (!id) return;
    setIsLinking(true);
    try {
      await linkCandidatePerson(id, personId);
      toast('Linked to master record');
      loadData();
    } catch {
      toast('Linking failed', 'error');
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
    } catch {
      toast('Operation failed', 'error');
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
    } catch {
      toast('Unlink failed', 'error');
    }
  };

  // 4. AI Enrichment
  const runEnrichment = async () => {
    if (!id || !candidate?.election_id) return;
    setEnriching(true);
    try {
      await enrichCandidates(candidate.election_id, [id]);
      toast('AI enrichment queued');
    } catch {
      toast('Enrichment failed', 'error');
    } finally {
      setEnriching(false);
    }
  };

  return {
    candidate, parties, loading, saving, form, setForm,
    personSearch, setPersonSearch, personResults, isLinking,
    handleSave, linkToPerson, createMasterRecord, unlink,
    enriching, runEnrichment
  };
}
