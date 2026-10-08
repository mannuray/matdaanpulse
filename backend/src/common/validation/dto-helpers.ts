import { IsByteLength, MaxLength } from 'class-validator';

/** Shared building blocks for request-body DTOs (the ValidationPipe runs whitelist + forbidNonWhitelisted). */

export const emptyToNull = ({ value }: { value: unknown }) => (value === '' ? null : value);

/**
 * Id-array cap for admin bulk bodies. Sized so a full array fits the global
 * 100 kb JSON limit (a UUID is ~39 bytes in JSON → ~2.5k per 100 kb), so an
 * oversize request gets a 400 validation error rather than a 413. The admin UI
 * sends at most one page (≤ 100 ids).
 */
export const MAX_IDS_PER_REQUEST = 2000;

/** Absolute http(s) links only (review S-M2): no javascript:/data: URLs in stored hrefs. */
export const HTTP_URL = { protocols: ['http', 'https'], require_protocol: true };


/** bcrypt hashes only the first 72 bytes; a longer password would silently match any value sharing that prefix. */
export const MAX_PASSWORD_BYTES = 72;
/** Password length cap: at most 72 characters and 72 UTF-8 bytes (bcrypt's input limit). */
export const PasswordMaxLength = (): PropertyDecorator => (target, key) => {
  MaxLength(MAX_PASSWORD_BYTES)(target, key);
  IsByteLength(0, MAX_PASSWORD_BYTES, { message: `$property must be at most ${MAX_PASSWORD_BYTES} bytes` })(target, key);
};
