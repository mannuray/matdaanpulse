import { useMemo, useState } from 'react';
import type { MlaView } from './usePartyPageVM';

export interface MlaSearchVM { query: string; setQuery(q: string): void; filtered: MlaView[] }

/** The party page's MLA search box: its own state, so a keystroke filters the list without rebuilding the page VM. */
export function useMlaSearch(mlas: MlaView[]): MlaSearchVM {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? mlas.filter(m => m.name.toLowerCase().includes(q) || m.constName.toLowerCase().includes(q)) : mlas;
  }, [mlas, query]);
  return useMemo(() => ({ query, setQuery, filtered }), [query, filtered]);
}
