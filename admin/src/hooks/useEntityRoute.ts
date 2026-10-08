import { useCallback, useMemo } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { confirmDiscardEdits } from '../context/UnsavedEditsContext';

/** Route id for create mode: `/parties/new`. */
export const NEW_ID = 'new';

export interface EntityRoute {
  /** Record id from `${base}/:id` ('new' in create mode), or null on the bare list. */
  id: string | null;
  isNew: boolean;
  /** Open a record (or NEW_ID). Asks first when dirty and the id changes; false if the user cancelled. */
  open: (id: string, opts?: { force?: boolean }) => boolean;
  /** Back to the list. Asks first when dirty; false if the user cancelled. */
  close: (opts?: { force?: boolean }) => boolean;
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/**
 * `/x` = list, `/x/:id` = list + panel. Mount the page at `x/*` so it stays mounted while records change.
 * Navigation keeps the query string (`?election=` …).
 */
export function useEntityRoute(base: string, dirty = false): EntityRoute {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const raw = matchPath({ path: `${base}/:id`, end: true }, pathname)?.params.id;
  const id = raw ? safeDecode(raw) : null;

  const open = useCallback((next: string, opts?: { force?: boolean }) => {
    if (next === id) return true;
    if (!opts?.force && !confirmDiscardEdits(dirty)) return false;
    navigate(`${base}/${encodeURIComponent(next)}${search}`);
    return true;
  }, [id, dirty, navigate, base, search]);

  const close = useCallback((opts?: { force?: boolean }) => {
    if (!opts?.force && !confirmDiscardEdits(dirty)) return false;
    navigate(`${base}${search}`);
    return true;
  }, [dirty, navigate, base, search]);

  return useMemo(() => ({ id, isNew: id === NEW_ID, open, close }), [id, open, close]);
}
