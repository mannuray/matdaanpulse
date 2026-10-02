/** A form's string fields after `blankToNull`: '' (or whitespace only) becomes null. */
export type BlankToNull<T> = { [K in keyof T]: T[K] extends string ? Exclude<T[K], ''> | null : T[K] };

/**
 * Save payload for a record form: every string field that is empty or whitespace only is sent as null, so an emptied
 * field clears the column instead of storing ''. Other values (and non-blank strings) pass through unchanged.
 * Shared by the Party, Person, Candidate and Constituency record pages.
 */
export function blankToNull<T extends object>(form: T): BlankToNull<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(form)) out[k] = typeof v === 'string' && v.trim() === '' ? null : v;
  return out as BlankToNull<T>;
}
