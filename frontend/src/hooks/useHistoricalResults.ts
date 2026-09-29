import { useApi } from './useApi';
import { getResults, ElectionService } from '../services/election.service';
import type { ResultRow } from '../types';

/**
 * Fetch results for the historical elections listed in the manifest
 * (`manifest.history`, oldest → newest). Returns null until loaded or when
 * the manifest lists no history.
 */
export function useHistoricalResults(historyIds: string[] | undefined): ResultRow[][] | null {
  const key = (historyIds || []).join(',');
  const { data } = useApi<ResultRow[][] | null>(
    () => {
      const ids = key ? key.split(',') : [];
      if (ids.length === 0) return Promise.resolve(null);
      // A missing historical election shouldn't break the others.
      return Promise.all(ids.map(id => getResults(id).catch(() => [] as ResultRow[])));
    },
    [key],
    { key: key ? ElectionService.getCacheKey(key, 'history_results') : undefined }
  );
  return data;
}
