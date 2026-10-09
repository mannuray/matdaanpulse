import { describe, it, expect, vi } from 'vitest';
import { makeGet, NotFound, seoApi } from '../api';
import { BASE, apiFrom, election, E_ID } from './fixtures';

const signal = () => new AbortController().signal;

describe('makeGet', () => {
  it('unwraps the success envelope', async () => {
    const get = makeGet(BASE, apiFrom({ [`/elections/${E_ID}`]: election }), signal());
    await expect(get(`/elections/${E_ID}`)).resolves.toEqual(election);
  });

  it('passes an unwrapped body through', async () => {
    const f = (async () => new Response(JSON.stringify([1, 2]), { status: 200 })) as typeof fetch;
    await expect(makeGet(BASE, f, signal())('/x')).resolves.toEqual([1, 2]);
  });

  it('404 and 400 are NotFound; other failures are plain errors', async () => {
    const status = (s: number) => (async () => new Response('{}', { status: s })) as typeof fetch;
    await expect(makeGet(BASE, status(404), signal())('/x')).rejects.toBeInstanceOf(NotFound);
    await expect(makeGet(BASE, status(400), signal())('/x')).rejects.toBeInstanceOf(NotFound);
    const err = await makeGet(BASE, status(503), signal())('/x').catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(NotFound);
  });

  it('sends the shared abort signal', async () => {
    const s = signal();
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    await makeGet(BASE, f as unknown as typeof fetch, s)('/x');
    expect(f).toHaveBeenCalledWith(`${BASE}/x`, expect.objectContaining({ signal: s }));
  });
});

describe('seoApi', () => {
  it('optional reads resolve to null instead of failing', async () => {
    const api = seoApi(makeGet(BASE, apiFrom({}), signal()));
    await expect(api.manifest(E_ID)).resolves.toBeNull();
    await expect(api.seatAnalysis(E_ID, 'BR-1')).resolves.toBeNull();
  });

  it('encodes party ids and the state filter', async () => {
    const f = vi.fn(async () => new Response('{}', { status: 200 }));
    const api = seoApi(makeGet(BASE, f as unknown as typeof fetch, signal()));
    await api.partyRecord('CPI(M)', 'WB');
    expect(f.mock.calls[0][0]).toBe(`${BASE}/parties/CPI(M)/record?state=WB`);
  });
});
