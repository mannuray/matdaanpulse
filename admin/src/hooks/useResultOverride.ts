import { useState, useEffect, useCallback } from 'react';
import { getElections, overrideResult } from '../services/election.service';
import { useToast } from '../context/ToastContext';
import type { Election } from '../types';

/**
 * CONTROLLER: Result Override (MVC)
 * Manages manual result corrections during live counting events.
 */
export function useResultOverride() {
  const { toast } = useToast();
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getElections().then(all => {
      setElections(all);
      const live = all.find(e => e.status === 'Live');
      if (live) setSelectedElectionId(live.id);
    }).catch(() => {});
  }, []);

  const handleOverride = async (payload: any) => {
    setSaving(true);
    try {
      await overrideResult(payload);
      toast('Override applied');
      return true;
    } catch {
      toast('Override failed', 'error');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    elections,
    selectedElectionId,
    setSelectedElectionId,
    saving,
    handleOverride
  };
}
