import type { Election } from '../types';

export type LifecycleKind = 'live' | 'finalize' | 'reopen';
export interface LifecycleAction { kind: LifecycleKind; label: string }

/**
 * The status changes `role` may make on an election, in the backend's rule: Upcoming → Live for SUPER_ADMIN and
 * EDITOR; Live → Finalized and Finalized → Live (reopen) for SUPER_ADMIN only. The list row and the edit dialog
 * both render from this.
 */
export function lifecycleActions(election: Pick<Election, 'status'>, role: string | null | undefined): LifecycleAction[] {
  const superAdmin = role === 'SUPER_ADMIN';
  switch (election.status) {
    case 'Upcoming':
      return superAdmin || role === 'EDITOR' ? [{ kind: 'live', label: 'Go live' }] : [];
    case 'Live':
      return superAdmin ? [{ kind: 'finalize', label: 'Finalize' }] : [];
    case 'Finalized':
      return superAdmin ? [{ kind: 'reopen', label: 'Reopen for corrections' }] : [];
    default:
      return [];
  }
}
