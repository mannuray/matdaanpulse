import { ValidateBy, ValidationOptions, buildMessage, isURL } from 'class-validator';

export const MAX_URL_LENGTH = 2048;

/**
 * True for absolute http(s) URLs (and, with allowRelative, site-relative paths
 * like /symbols/logos/BJP.svg). Everything else — javascript:, data:, //host,
 * over-long values — is rejected, so stored links can be rendered as <a href>
 * / <img src> without becoming stored XSS (review S-M2).
 */
export function isSafeUrl(value: unknown, allowRelative = false): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_URL_LENGTH) return false;
  if (allowRelative && /^\/(?![/\\])[^\s\\]*$/.test(value)) return true;
  return isURL(value, { protocols: ['http', 'https'], require_protocol: true, require_valid_protocol: true });
}

/** DTO decorator: http(s) URL, max 2048 chars (optionally a site-relative path). */
export function IsSafeUrl(opts: { allowRelative?: boolean } = {}, validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isSafeUrl',
      validator: {
        validate: (value) => isSafeUrl(value, opts.allowRelative),
        defaultMessage: buildMessage(
          (each) => `${each}$property must be an http(s) URL${opts.allowRelative ? ' or a path starting with /' : ''} (max ${MAX_URL_LENGTH} chars)`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
