import { isSafeUrl } from '../../../common/validation/safe-url';

/**
 * Helpers for turning free-form LLM output into typed values that fit the
 * Prisma column types. Gemini (with the google_search tool enabled) cannot be
 * forced into JSON mode, so prompts ask for a single JSON object and these
 * helpers extract it defensively.
 */

/**
 * Extract the first JSON object from a model response. Handles ```json fences,
 * leading/trailing prose, and returns null if nothing parseable is found.
 */
export function extractJsonObject(text: string | null | undefined): Record<string, unknown> | null {
  if (!text) return null;
  let body = text.trim();

  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();

  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end <= start) return null;

  try {
    const parsed = JSON.parse(body.slice(start, end + 1));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function asString(value: unknown, maxLength?: number): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').trim();
  if (!s) return undefined;
  return maxLength ? s.slice(0, maxLength) : s;
}

/**
 * Model output is untrusted (search grounding can carry prompt injection):
 * keep only absolute http(s) URLs up to 2048 chars, drop anything else.
 */
export function asHttpUrl(value: unknown): string | undefined {
  const s = asString(value);
  return s && isSafeUrl(s) ? s : undefined;
}

export function asInt(value: unknown, min?: number, max?: number): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN;
  if (!Number.isFinite(n)) return undefined;
  const i = Math.trunc(n);
  if (min !== undefined && i < min) return undefined;
  if (max !== undefined && i > max) return undefined;
  return i;
}

export function asStringArray(value: unknown, maxItems = 20, maxLength = 200): string[] {
  const arr = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,;\n]/) : [];
  return arr
    .map((v) => asString(v, maxLength))
    .filter((v): v is string => !!v)
    .slice(0, maxItems);
}

export function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

/** Shared instruction appended to every enrichment prompt. */
export const JSON_ONLY_INSTRUCTION =
  'Respond with ONLY a single JSON object (no markdown, no commentary). Use null for unknown values.';
