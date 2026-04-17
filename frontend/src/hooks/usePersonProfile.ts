import { useMemo } from 'react';
import { useApi } from './useApi';
import { getPerson } from '../services/api';

export function usePersonProfile(id: string | undefined) {
  const { data: person, loading, error } = useApi(
    () => id ? getPerson(id) : Promise.resolve(null),
    [id]
  );

  const profile = useMemo(() => {
    if (!person) return null;

    const sortedCandidates = [...person.candidates].sort(
      (a, b) => (b.election_year || 0) - (a.election_year || 0)
    );
    
    const electionsContested = new Set(sortedCandidates.map((c) => c.election_id)).size;
    const wins = sortedCandidates.filter((c) => c.status === 'WON').length;

    return {
      ...person,
      sortedCandidates,
      stats: {
        electionsContested,
        wins,
      }
    };
  }, [person]);

  return {
    person: profile,
    loading,
    error
  };
}
