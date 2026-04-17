import { useState, useEffect } from 'react';
import { getParties } from './api';

interface SymbolEntry {
  symbol_url: string | null;
  eci_symbol_url: string | null;
}

let cache: Map<string, SymbolEntry> | null = null;
let pending: Promise<Map<string, SymbolEntry>> | null = null;
const listeners = new Set<() => void>();

function load(): Promise<Map<string, SymbolEntry>> {
  if (!pending) {
    pending = getParties().then((parties) => {
      const m = new Map<string, SymbolEntry>();
      for (const p of parties) {
        if (p.symbol_url || p.eci_symbol_url) {
          m.set(p.id, { symbol_url: p.symbol_url, eci_symbol_url: p.eci_symbol_url });
        }
      }
      cache = m;
      listeners.forEach((fn) => fn());
      return m;
    }).catch(() => {
      pending = null;
      return new Map<string, SymbolEntry>();
    });
  }
  return pending;
}

/** Hook: returns party symbol map, triggers re-render when loaded */
export function usePartySymbols(): Map<string, SymbolEntry> | null {
  const [symbols, setSymbols] = useState<Map<string, SymbolEntry> | null>(cache);

  useEffect(() => {
    if (cache) { setSymbols(cache); return; }
    const update = () => setSymbols(cache);
    listeners.add(update);
    load();
    return () => { listeners.delete(update); };
  }, []);

  return symbols;
}
