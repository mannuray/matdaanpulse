import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LayerId } from '../../model/types/dashboard';
import { dashboardReducer, effectiveLayer, initialUiState, parseUiParams, serializeUiParams, type DashboardAction, type DashboardUiState } from './dashboardStore';

interface StoreValue { state: DashboardUiState; dispatch: Dispatch<DashboardAction> }
const StoreContext = createContext<StoreValue | null>(null);

export function DashboardStoreProvider({ allowedLayers, knownSeats, children }: { allowedLayers: LayerId[]; knownSeats: Set<string> | null; children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  /** True while the current history entry (focus/seat open) was pushed by this store, so closing can pop it. */
  const pushedRef = useRef(false);
  const [raw, dispatch] = useReducer(dashboardReducer, undefined, () => ({ ...initialUiState, ...parseUiParams(params, knownSeats) }));

  // URL → state (back/forward, pasted links, late-loading seat list). Idempotent after our own writes.
  useEffect(() => {
    dispatch({ type: 'syncFromUrl', params: parseUiParams(params, knownSeats) });
  }, [params, knownSeats]);

  // state → URL (the REQUESTED layer is written, not the effective one).
  // Opening focus/seat from closed pushes one history entry; closing that entry goes Back (so Back never re-opens it);
  // every other change (layer, switching tiles, closing a pasted link) replaces.
  useEffect(() => {
    const isOpen = (p: URLSearchParams) => Boolean(p.get('focus') || p.get('seat'));
    const next = serializeUiParams(raw, params);
    if (next.toString() === params.toString()) {
      if (!isOpen(params)) pushedRef.current = false; // closed by browser Back / URL change
      return;
    }
    const wasOpen = isOpen(params);
    const willOpen = isOpen(next);
    if (!wasOpen && willOpen) {
      pushedRef.current = true;
      setParams(next);
    } else if (wasOpen && !willOpen && pushedRef.current) {
      pushedRef.current = false;
      navigate(-1);
    } else {
      setParams(next, { replace: true });
    }
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
