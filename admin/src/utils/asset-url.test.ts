import { describe, it, expect } from 'vitest';
import { assetUrl, resolveAssetUrl } from './asset-url';

describe('assetUrl', () => {
  it('passes absolute URLs through', () => expect(assetUrl('https://x.blob.vercel-storage.com/a.png')).toBe('https://x.blob.vercel-storage.com/a.png'));
  it('empty for null/blank', () => { expect(assetUrl(null)).toBe(''); expect(assetUrl('')).toBe(''); expect(assetUrl(undefined)).toBe(''); });
  it('prefixes site-relative paths with the public site', () =>
    expect(resolveAssetUrl('/symbols/logos/BJP.svg', 'https://www.matdaanpulse.in/')).toBe('https://www.matdaanpulse.in/symbols/logos/BJP.svg'));
  it('leaves other values alone', () => expect(resolveAssetUrl('data:image/png;base64,xx', 'https://s')).toBe('data:image/png;base64,xx'));
});
