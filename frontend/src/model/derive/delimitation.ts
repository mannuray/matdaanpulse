import type { Election } from '../types';

type ElectionKey = Pick<Election, 'id' | 'type' | 'state_id' | 'year' | 'delimitation'>;

/**
 * The delimitation this election's seats were redrawn to, when an earlier election of the same house and state was
 * fought on other boundaries (Assam 2026 after the 2023 order); else null. Seat history then starts at the redraw.
 */
export function redrawnTo(election: ElectionKey, elections: readonly ElectionKey[]): string | null {
  if (!election.delimitation) return null;
  const earlier = elections.some(e => e.id !== election.id && e.type === election.type && e.state_id === election.state_id
    && e.year < election.year && !!e.delimitation && e.delimitation !== election.delimitation);
  return earlier ? election.delimitation : null;
}
