import { useEffect, useState } from 'react';
import { getParties } from '../services/party.service';
import type { Party } from '../types';

/** The full party list (GET /parties) for pickers: empty until it loads, and empty if it fails. */
export function useParties(): Party[] {
  const [parties, setParties] = useState<Party[]>([]);
  useEffect(() => {
    let cancelled = false;
    getParties()
      .then((p) => { if (!cancelled) setParties(p); })
      .catch(() => { /* pickers fall back to an empty list */ });
    return () => { cancelled = true; };
  }, []);
  return parties;
}
