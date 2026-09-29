import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { LayerId } from '../../model/types/dashboard';
import { dashboardReducer, effectiveLayer, initialUiState, parseUiParams, serializeUiParams, type DashboardAction, type DashboardUiState } from './dashboardStore';

interface StoreValue { state: DashboardUiState; dispatch: Dispatch<DashboardAction> }
const StoreContext = createContext<StoreValue | null>(null);

export function DashboardStoreProvider({ allowedLayers, knownSeats, children }: { allowedLayers: LayerId[]; knownSeats: Set<string> | null; children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const [raw, dispatch] = useReducer(dashboardReducer, undefined, () => ({ ...initialUiState, ...parseUiParams(params, knownSeats) }));

  // URL → state (back/forward, pasted links, late-loading seat list). Idempotent after our own writes.
  useEffect(() => {
    dispatch({ type: 'syncFromUrl', params: parseUiParams(params, knownSeats) });
  }, [params, knownSeats]);

  // state → URL (the REQUESTED layer is written, not the effective one). Opening focus or a seat pushes history so Back closes it.
  useEffect(() => {
    const next = serializeUiParams(raw, params);
    if (next.toString() === params.toString()) return;
    const pushes = next.get('focus') !== params.get('focus') || next.get('seat') !== params.get('seat');
    setParams(next, { replace: !pushes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw.layer, raw.selectedSeat, raw.focus]);

  const allowedKey = allowedLayers.join(',');
  const state = useMemo(
    () => ({ ...raw, layer: effectiveLayer(raw.layer, allowedLayers) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [raw, allowedKey],
  );
  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useDashboardStore(): StoreValue {
  const v = useContext(StoreContext);
  if (!v) throw new Error('useDashboardStore must be used inside DashboardStoreProvider');
  return v;
}
