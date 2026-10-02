// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('./auth.service', () => ({ getToken: () => 'tok', handleUnauthorized: vi.fn() }));
import { uploadImage } from './media.service';
import { checkImageFile } from '../utils/image-file';

afterEach(() => vi.restoreAllMocks());

describe('uploadImage', () => {
  it('posts multipart without a JSON content type, with auth', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: { url: 'https://b/x.png' } }), { status: 201 }));
    const out = await uploadImage(new File(['x'], 'x.png', { type: 'image/png' }), 'party-logo', 'BJP');
    expect(out.url).toBe('https://b/x.png');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/admin\/media$/);
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer tok');
    const fd = init.body as FormData;
    expect(fd.get('kind')).toBe('party-logo');
    expect(fd.get('owner_id')).toBe('BJP');
  });
});

describe('checkImageFile', () => {
  it('rejects non-images and oversize files per kind', () => {
    expect(checkImageFile(new File(['x'], 'a.gif', { type: 'image/gif' }), 'party-logo')).toMatch(/PNG, JPEG, WebP or SVG/);
    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    expect(checkImageFile(big, 'party-logo')).toMatch(/1 MB/);
    expect(checkImageFile(big, 'person-photo')).toBeNull();
  });
});
