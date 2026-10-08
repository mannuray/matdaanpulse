import { gunzipSync } from 'zlib';
import { SnapshotBodyCache } from './snapshot-body-cache';

describe('SnapshotBodyCache', () => {
  it('keeps the gzipped JSON body with one strong ETag per encoding', async () => {
    const c = new SnapshotBodyCache();
    const body = { success: true, data: { version: 7, results: [{ a: 1 }] } };
    const e = await c.put('e:7', body);
    expect(JSON.parse(gunzipSync(e.gzip).toString('utf8'))).toEqual(body);
    expect(e.etagGzip).toMatch(/^"[0-9a-f]+-[A-Za-z0-9+/]{27}"$/);
    expect(e.etagIdentity).not.toBe(e.etagGzip);
    expect(c.get('e:7')).toBe(e);
    expect(c.get('e:8')).toBeUndefined();
  });

  it('is bounded by bytes, evicting the least recently used', async () => {
    const big = (n: number) => ({ data: Array.from({ length: 400 }, (_, i) => `${n}-${i}-${Math.random()}`) });
    const probe = await new SnapshotBodyCache().put('x', big(0));
    const c = new SnapshotBodyCache(Math.floor(probe.gzip.length * 2.5));
    await c.put('a', big(1));
    await c.put('b', big(2));
    c.get('a'); // a is now the most recent
    await c.put('c', big(3));
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBeDefined();
    expect(c.get('c')).toBeDefined();
    expect(c.size.bytes).toBeLessThanOrEqual(Math.floor(probe.gzip.length * 2.5));
  });

  it('a body larger than the whole budget is returned but not kept', async () => {
    const c = new SnapshotBodyCache(10);
    const e = await c.put('a', { data: 'x'.repeat(1000) });
    expect(e.gzip.length).toBeGreaterThan(10);
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toEqual({ entries: 0, bytes: 0 });
  });
});
