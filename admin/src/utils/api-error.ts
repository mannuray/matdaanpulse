import { ApiError } from '../services/api-client';

/** One toast string: "<fallback>: <message>" plus one line per field error. */
export function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.fields.length > 0) {
      return [`${fallback}: ${err.message}`, ...err.fields.map((f) => `• ${f.field}: ${f.message}`)].join('\n');
    }
    return `${fallback}: ${err.message}`;
  }
  return fallback;
}
