import { useEffect, useMemo, useState } from 'react';
import { getPersons } from '../services/person.api';
import { useDebouncedValue } from './useDebouncedValue';
import type { PersonWithStats } from '../types';

/** Searches start at this many characters. */
export const PERSON_SEARCH_MIN = 2;

/**
 * Persons matching `query` (GET /persons?q=), searched once typing stops for `ms`. Under PERSON_SEARCH_MIN
 * characters the result is empty at once; `excludeId` (the record's own person) is never offered; a slow earlier
 * response never replaces a newer one; a failed search shows nothing.
 */
export function usePersonSearch(query: string, { excludeId, limit = 10, ms = 400 }: { excludeId?: string | null; limit?: number; ms?: number } = {}) {
  const trimmed = query.trim();
  const debounced = useDebouncedValue(trimmed, ms);
  const [matches, setMatches] = useState<PersonWithStats[]>([]);

  useEffect(() => {
    if (debounced.length < PERSON_SEARCH_MIN) { setMatches([]); return undefined; }
    let cancelled = false;
    getPersons(1, limit, debounced)
      .then((r) => { if (!cancelled) setMatches(r.data ?? []); })
      .catch(() => { if (!cancelled) setMatches([]); });
    return () => { cancelled = true; };
  }, [debounced, limit]);

  const tooShort = trimmed.length < PERSON_SEARCH_MIN;
  return useMemo(
    () => (tooShort ? [] : matches.filter((p) => p.id !== excludeId)),
    [tooShort, matches, excludeId],
  );
}
