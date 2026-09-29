export interface FitResult {
  count: number;
  overflow: number;
}

/**
 * How many fixed-height rows fit in `available` px. When not all rows fit,
 * space for a "+N more" footer is reserved. Never returns 0 rows for a
 * non-empty list, so a tile always shows something.
 */
export function fitCount({ available, itemHeight, total, gap = 0, footerHeight = 0 }: {
  available: number;
  itemHeight: number;
  total: number;
  gap?: number;
  footerHeight?: number;
}): FitResult {
  if (total <= 0) return { count: 0, overflow: 0 };
  const step = itemHeight + gap;
  const allHeight = total * itemHeight + (total - 1) * gap;
  if (available > 0 && allHeight <= available) return { count: total, overflow: 0 };
  const rows = Math.floor((available - footerHeight + gap) / step);
  const count = Math.min(total, Math.max(1, rows));
  return { count, overflow: total - count };
}
