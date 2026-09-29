import { useMemo, type RefCallback } from 'react';
import { fitCount, compactList } from '../../viewmodels/tiles/fit';
import { useElementHeight } from './useElementHeight';

export function useFitRows<T extends { seats: number }>(rows: T[], rowHeight: number, gap = 4, footer = 22) {
  const [ref, height] = useElementHeight<HTMLDivElement>();
  const list = useMemo(() => {
    const { count } = fitCount({ available: height, itemHeight: rowHeight, gap, footerHeight: footer, total: rows.length });
    return compactList(rows, count);
  }, [rows, height, rowHeight, gap, footer]);
  return { ref: ref as RefCallback<HTMLDivElement>, ...list };
}
