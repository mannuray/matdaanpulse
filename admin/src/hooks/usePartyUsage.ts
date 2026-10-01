import { useCallback, useEffect, useState } from 'react';
import { getPartyUsage } from '../services/geo.service';
import type { PartyUsage } from '../types';

/**
 * Per-election candidate counts and wins of one party (the record page's Usage card and header meta).
 * Loaded on its own: a failure here only blanks the Usage card, never the form.
 */
export function usePartyUsage(id: string) {
  const [usage, setUsage] = useState<PartyUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    getPartyUsage(id)
      .then((u) => { if (!cancelled) setUsage(u); })
      .catch(() => { if (!cancelled) { setUsage(null); setFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, reload]);

  const retry = useCallback(() => setReload((n) => n + 1), []);
  return { usage, loading, failed, retry };
}
