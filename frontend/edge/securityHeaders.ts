/**
 * The `/*` headers of public/_headers. Cloudflare Pages does not apply _headers to Function responses, so the
 * function sets them itself; src/__tests__/securityHeaders.test.ts checks the two stay identical.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://matdaanpulse-media.s3.ap-south-1.amazonaws.com; font-src 'self'; connect-src 'self' https://matdaanpulse-api.onrender.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};
