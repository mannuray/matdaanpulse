import { ApiError } from '../services/api-client';

/** One toast string: "<fallback>: <message>" plus one line per field error. */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.fields.length > 0) {
      return [`${fallback}: ${err.message}`, ...err.fields.map((f) => `• ${f.field}: ${f.message}`)].join('\n');
    }
    return `${fallback}: ${err.message}`;
  }
  if (err instanceof Error) {
    if (err.message === 'Unauthorized') return 'Session expired \u2014 please sign in again';
    if (err instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(err.message)) {
      return 'Network error \u2014 check your connection';
    }
    if (err.message) return `${fallback}: ${err.message}`;
  }
  return fallback;
}
