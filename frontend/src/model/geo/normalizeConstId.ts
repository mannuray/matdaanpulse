import { STATE_CODE_TO_ST_NAME } from './regionMatching';

/**
 * Normalize a constituency ID for cross-election matching.
 *
 * - VS ids (`WB_VS21_210_NANDIGRAM`, `BR_VS_195_AGIAON`) contain a const_no that
 *   is stable across elections even when names are spelled differently
 *   (BACHWARA vs BACHHWARA), so they normalize to `<STATE>:<const_no>`.
 * - LS ids are bare names (`AGRA`, `AHMEDABAD_EAST`) and normalize to themselves.
 *   Names that exist in more than one state carry a state prefix
 *   (`BR_AURANGABAD` / `MH_AURANGABAD`); the prefix is kept (`BR:AURANGABAD`)
 *   so same-named seats in different states never merge.
 *
 * Only known state codes count as a prefix, so bare names are never split.
 */
export function normalizeConstId(id: string): string {
  const m = id.match(/^([A-Z]{2})_(.+)$/);
  if (!m || !STATE_CODE_TO_ST_NAME[m[1]]) return id;
  const [, code, rawRest] = m;
  const rest = rawRest.replace(/^VS\d*_/, '');
  const numMatch = rest.match(/^(\d+)_/);
  if (numMatch) return `${code}:${numMatch[1]}`;
  return `${code}:${rest}`;
}
