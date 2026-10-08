import { useApi } from '../data/useApi';
import { recallElectionId } from '../data/lastElection';
import { getElections } from '../../model/api/election.service';
import { pickLatestElection } from '../../model/derive/electionPick';
import type { Election } from '../../model/types';

function remembered(type: 'LS' | 'VS', elections: Election[]): string | null {
  const id = recallElectionId(type);
  return id && elections.some(e => e.id === id) ? id : null;
}

export function useDefaultElectionId(): { id: string | null; loading: boolean } {
  const { data, loading, error } = useApi(() => getElections(), []);
  if (loading) return { id: null, loading: true };
  if (error || !data) return { id: null, loading: false };
  const id = remembered('LS', data)
    ?? remembered('VS', data)
    ?? pickLatestElection(data, 'LS')?.id
    ?? pickLatestElection(data)?.id
    ?? null;
  return { id, loading: false };
}
