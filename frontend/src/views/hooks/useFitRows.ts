import { useMemo, type RefCallback } from 'react';
import { fitCount, compactList } from '../../viewmodels/tiles/fit';
import { useElementHeight } from './useElementHeight';

/** Rows without a `seats` field (e.g. watchlist rows) count as 0 seats in the footer sum. */
export function useFitRows<T extends object>(rows: T[], rowHeight: number, gap = 4, footer = 22, reserved = 0) {
  const [ref, height] = useElementHeight<HTMLDivElement>();
  const list = useMemo(() => {
    const { count } = fitCount({ available: height - reserved, itemHeight: rowHeight, gap, footerHeight: footer, total: rows.length });
    return compactList(rows.map(r => ({ ...r, seats: (r as { seats?: number }).seats ?? 0 })) as (T & { seats: number })[], count);
  }, [rows, height, rowHeight, gap, footer, reserved]);
  return { ref: ref as RefCallback<HTMLDivElement>, ...list };
}
