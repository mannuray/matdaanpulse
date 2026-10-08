import { getPartyUsage } from '../services/party.service';
import { useRecordQuery } from './useRecordQuery';

/**
 * Per-election candidate counts and wins of one party (the record page's Usage card and header meta).
 * Loaded on its own: a failure here only blanks the Usage card, never the form.
 */
export function usePartyUsage(id: string) {
  const q = useRecordQuery(getPartyUsage, id);
  return { usage: q.data, loading: q.loading, failed: q.failed, retry: q.retry };
}
