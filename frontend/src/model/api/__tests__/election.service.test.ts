import { describe, it, expect, vi, afterEach } from 'vitest';
import { getConstituency } from '../election.service';

function captureUrls() {
  const urls: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    urls.push(url);
    return { ok: true, status: 200, statusText: '', headers: new Headers(), json: async () => ({ success: true, data: { id: 'S' } }) };
  }));
  return urls;
}

afterEach(() => vi.unstubAllGlobals());

describe('getConstituency', () => {
  it('asks for the seat detail at a live version (?v=, CDN-cacheable per version)', async () => {
    const urls = captureUrls();
    await getConstituency('e1', 'S', 7);
    expect(urls[0]).toMatch(/\/elections\/e1\/constituencies\/S\?v=7$/);
  });

  it('without a version: the plain URL', async () => {
    const urls = captureUrls();
    await getConstituency('e1', 'S');
    await getConstituency('e1', 'S', null);
    expect(urls[0]).toMatch(/\/elections\/e1\/constituencies\/S$/);
    expect(urls[1]).toMatch(/\/elections\/e1\/constituencies\/S$/);
  });
});
