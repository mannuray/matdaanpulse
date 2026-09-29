/**
 * PURE UTILITY: Live-console override form validation.
 * Mirrors backend OverridePayload (class-validator): votes/margin are integers >= 0,
 * status is one of the known result statuses.
 */
export const OVERRIDE_STATUSES = ['LEADING', 'WON', 'TRAILING', 'LOST'] as const;
export type OverrideStatus = (typeof OVERRIDE_STATUSES)[number];

export interface OverrideForm {
  votes: string;
  margin: string;
  status: string;
}

export interface OverridePayload {
  result_id: string;
  votes: number;
  margin: number;
  status: OverrideStatus;
}

export type OverrideValidation =
  | { ok: true; payload: OverridePayload }
  | { ok: false; error: string };

function parseNonNegativeInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

export function validateOverride(resultId: string | null, form: OverrideForm): OverrideValidation {
  if (!resultId) return { ok: false, error: 'No result selected' };
  const votes = parseNonNegativeInt(form.votes);
  if (votes === null) return { ok: false, error: 'Votes must be a whole number of 0 or more' };
  const margin = parseNonNegativeInt(form.margin);
  if (margin === null) return { ok: false, error: 'Margin must be a whole number of 0 or more' };
  if (!(OVERRIDE_STATUSES as readonly string[]).includes(form.status)) {
    return { ok: false, error: 'Select a valid status' };
  }
  return { ok: true, payload: { result_id: resultId, votes, margin, status: form.status as OverrideStatus } };
}
