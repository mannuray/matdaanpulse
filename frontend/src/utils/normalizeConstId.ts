/**
 * Normalize a constituency ID for cross-election matching.
 * VS IDs contain a const_no which is stable across elections even when names
 * have spelling variations (e.g. BACHWARA vs BACHHWARA). For VS, normalize to
 * just the const_no. For LS (no const_no), use the name portion.
 */
export function normalizeConstId(id: string): string {
  const stripped = id.replace(/^[A-Z]{2}_(?:VS\d*_)?/, '');
  // If it starts with a number (VS const_no), use only the number for matching
  const numMatch = stripped.match(/^(\d+)_/);
  if (numMatch) return numMatch[1];
  return stripped;
}
