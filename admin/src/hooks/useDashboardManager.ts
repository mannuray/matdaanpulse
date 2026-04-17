import { useState, useEffect, useMemo } from 'react';
import { getElections } from '../services/election.service';
import { getUsers } from '../services/user.service';
import type { Election } from '../types';

/**
 * CONTROLLER: Dashboard Manager (MVC)
 * Centralizes system-wide statistics and status overview logic.
 */
export function useDashboardManager() {
  const [elections, setElections] = useState<Election[]>([]);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getElections(),
      getUsers().catch(() => []),
    ])
      .then(([el, users]) => {
        setElections(el);
        setUserCount(users.length);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      })
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const live = elections.filter((e) => e.status === 'Live');
    const upcoming = elections.filter((e) => e.status === 'Upcoming');
    const finalized = elections.filter((e) => e.status === 'Finalized');

    return [
      { 
        label: 'Total Elections', 
        value: elections.length, 
        color: 'var(--accent)', 
        sub: `${live.length} live, ${upcoming.length} upcoming` 
      },
      { 
        label: 'Live Now', 
        value: live.length, 
        color: 'var(--danger)', 
        sub: live.map((e) => e.name).join(', ') || 'None' 
      },
      { 
        label: 'Finalized', 
        value: finalized.length, 
        color: 'var(--success)', 
        sub: 'Archived elections' 
      },
      { 
        label: 'Admin Users', 
        value: userCount, 
        color: '#8b5cf6', 
        sub: 'Active accounts' 
      },
    ];
  }, [elections, userCount]);

  const liveElections = useMemo(() => elections.filter((e) => e.status === 'Live'), [elections]);
  const upcomingElections = useMemo(() => elections.filter((e) => e.status === 'Upcoming'), [elections]);

  return {
    loading,
    error,
    stats,
    liveElections,
    upcomingElections,
    refresh: () => {
       // Logic to refresh if needed
    }
  };
}
