const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'http://localhost:3080';

/** `base` + a site-relative path ("/symbols/…"); absolute and data: URLs unchanged. */
export function resolveAssetUrl(u: string | null | undefined, base: string): string {
  if (!u) return '';
  return u.startsWith('/') ? `${base.replace(/\/+$/, '')}${u}` : u;
}

/**
 * Where an image field points. Seeded party symbols are paths on the public site (/symbols/logos/X.svg), which the
 * admin's own host does not serve; uploads are absolute Blob URLs.
 */
export const assetUrl = (u: string | null | undefined) => resolveAssetUrl(u, PUBLIC_SITE_URL);
