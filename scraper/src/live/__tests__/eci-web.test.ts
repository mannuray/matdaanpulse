import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EciWebAdapter } from '../adapters/eci-web';
import { parseCandidateDetailPage, parseConstituencyListPage, parsePartywisePage } from '../../adapters/eci-vs-adapter';

const fx = (f: string) => readFileSync(join(__dirname, 'fixtures', f), 'utf8');
// Real ECI list page 6 (the one that lists seat 100, HABRA); the fake serves it as page 1.
const list = fx('eci-list-p6.htm'), cand = fx('eci-candidates-100.htm');

/** Build a roster from the fixtures themselves, so the real page layout is what gets mapped. */
function rosterFromFixtures() {
  const rows = parseConstituencyListPage(list);
  const habra = rows.find(r => r.constNo === 100)!;
  const cands = parseCandidateDetailPage(cand);
  const partyNames = [...new Set(cands.map(c => c.party))];
  const parties = partyNames.map((n, i) => ({ id: /none of the above/i.test(n) ? 'NOTA' : /^independent$/i.test(n) ? 'IND' : `P${i}`, name: n, abbreviation: null }));
  const pid = (n: string) => parties.find(p => p.name === n)!.id;
  return { rows, habra, parties, roster: { election: { id: 'e', type: 'VS', state_id: 25, year: 2026, status: 'Live' }, parties,
    seats: [{ const_id: 'WB_100', const_no: 100, name: habra?.name ?? 'HABRA', type: 'GEN', state_id: 25,
      candidates: cands.map((c, i) => ({ candidate_id: `c${i}`, name: c.name, party_id: pid(c.party) })) }] } };
}

function fakeFetch() {
  const calls: string[] = [];
  const fetchText = vi.fn(async (url: string, _ims?: string) => {
    calls.push(url);
    if (url.endsWith('statewiseS251.htm')) return { status: 200, text: list, lastModified: 'Mon, 05 May 2026 10:48:00 GMT' };
    if (url.includes('statewiseS25')) return { status: 404, text: '', lastModified: null };
    if (url.endsWith('candidateswise-S25100.htm')) return { status: 200, text: cand, lastModified: null };
    return { status: 404, text: '', lastModified: null };
  });
  return { fetchText, calls };
}

describe('parseCandidateDetailPage photo', () => {
  it('reads each candidate\'s photo URL from the real page', () => {
    const cands = parseCandidateDetailPage(cand);
    expect(cands[0].photo).toBe('https://results.eci.gov.in/uploads2/candprofile/E32/2026/AC/S25/DEBDA-2026-20260404123809.jpg');
    expect(cands.every(c => c.photo === null || /^https:\/\/results\.eci\.gov\.in\/.+\.jpe?g$/i.test(c.photo))).toBe(true);
  });
  it('gives null when a box has no photo', () => {
    const html = "<div class='cand-box'><div class='cand-info'><div class='status lost'><div>lost</div><div>10 <span>(- 5)</span></div></div><div class='nme-prty'><h5>A</h5><h6>B</h6></div></div></div>";
    expect(parseCandidateDetailPage(html)[0].photo).toBeNull();
  });
});

describe('EciWebAdapter on real ECI pages', () => {
  it('the fixture list page lists seat 100', () => {
    expect(parseConstituencyListPage(list).some(r => r.constNo === 100)).toBe(true);
  });
  it('maps the fixture seat completely and returns its full state once', async () => {
    const { roster } = rosterFromFixtures();
    const { fetchText } = fakeFetch();
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText });
    const report = await a.prepare(roster as any);
    expect(report.seats_mapped).toBe(1);
    const first = await a.poll();
    expect(first).toHaveLength(1);
    expect(first[0].const_id).toBe('WB_100');
    expect(Object.keys(first[0].votes)).toHaveLength(roster.seats[0].candidates.length);
    expect(first[0].state).toBe('declared');
    a.commit(['WB_100']);
    expect(await a.poll()).toEqual([]);   // unchanged list signature: no refetch, nothing sent
  });
  it('sends If-Modified-Since on the second poll and reuses the page on 304', async () => {
    const { roster } = rosterFromFixtures();
    const { fetchText } = fakeFetch();
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText });
    await a.prepare(roster as any); await a.poll(); a.commit(['WB_100']);
    fetchText.mockImplementationOnce(async () => ({ status: 304, text: '', lastModified: null }));
    await a.poll();
    expect(fetchText.mock.calls.some(c => c[1] === 'Mon, 05 May 2026 10:48:00 GMT')).toBe(true);
  });
  it('a seat in the roster that the source does not list yet is not sent', async () => {
    const { roster } = rosterFromFixtures();
    roster.seats.push({ const_id: 'WB_999', const_no: 999, name: 'NOWHERE', type: 'GEN', state_id: 25, candidates: [] } as any);
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText: fakeFetch().fetchText });
    await a.prepare(roster as any);
    expect((await a.poll()).map(s => s.const_id)).toEqual(['WB_100']);
  });
  it('parses the party-wise page', () => {
    const rows = parsePartywisePage(fx('eci-partywise.htm'));
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.every(r => r.party.includes(' - ') || /independent/i.test(r.party))).toBe(true);
  });
  it('tally maps party-wise rows; 404 gives null', async () => {
    const { roster } = rosterFromFixtures();
    const pw = fx('eci-partywise.htm');
    const ok = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText: async () => ({ status: 200, text: pw, lastModified: null }) });
    await ok.prepare(roster as any);
    expect(Array.isArray(await ok.tally())).toBe(true);
    const gone = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText: async () => ({ status: 404, text: '', lastModified: null }) });
    await gone.prepare(roster as any);
    expect(await gone.tally()).toBeNull();
  });
  it('poll without commit returns the seat again; after commit an unchanged list returns nothing', async () => {
    const { roster } = rosterFromFixtures();
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText: fakeFetch().fetchText });
    await a.prepare(roster as any);
    expect(await a.poll()).toHaveLength(1);
    expect(await a.poll()).toHaveLength(1);   // not committed: delivered state unknown
    a.commit(['WB_100']);
    expect(await a.poll()).toEqual([]);
  });
  it('commit(constIds) promotes only the given seats (a held / rejected / undelivered seat is sent again)', async () => {
    const { roster } = rosterFromFixtures();
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText: fakeFetch().fetchText });
    await a.prepare(roster as any);
    await a.poll();
    a.commit(['WB_OTHER_SEAT']);
    expect(await a.poll()).toHaveLength(1);
    a.commit([]);
    expect(await a.poll()).toHaveLength(1);
    a.commit(['WB_100']);
    expect(await a.poll()).toEqual([]);
  });
  it('tally logs party-wise rows it cannot map', async () => {
    const { roster } = rosterFromFixtures();
    const pw = fx('eci-partywise.htm');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText: async () => ({ status: 200, text: pw, lastModified: null }) });
    await a.prepare({ ...roster, parties: [] } as any);
    expect(await a.tally()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^\[eci-web\] tally: \d+ unmapped part/));
    warn.mockRestore();
  });
  it('a throwing candidate fetch does not reject poll(); other seats are still returned', async () => {
    const { roster } = rosterFromFixtures();
    const rows = parseConstituencyListPage(list);
    const other = rows.find(r => r.constNo !== 100)!;
    roster.seats.push({ const_id: 'WB_OTHER', const_no: other.constNo, name: other.name, type: 'GEN', state_id: 25, candidates: [] } as any);
    const base = fakeFetch().fetchText;
    const fetchText = vi.fn(async (url: string, ims?: string) => {
      if (url.endsWith(`candidateswise-S25${other.constNo}.htm`)) throw new Error('timeout');
      return base(url, ims);
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchText });
    await a.prepare(roster as any);
    expect((await a.poll()).map(s => s.const_id)).toEqual(['WB_100']);
    warn.mockRestore();
  });
  it('default fetch aborts via fetchTimeoutMs', async () => {
    const g = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 404 }));
    const t = vi.spyOn(AbortSignal, 'timeout');
    const a = new EciWebAdapter({ id: 'eci-web', baseUrl: 'https://eci', stateCode: 'S25', fetchTimeoutMs: 1234 });
    expect(await a.tally()).toBeNull();   // no roster yet: returns before fetching
    await a.prepare({ election: { id: 'e', type: 'VS', state_id: 25, year: 2026, status: 'Live' }, parties: [], seats: [] });
    expect(await a.tally()).toBeNull();
    expect(t).toHaveBeenCalledWith(1234);
    expect((g.mock.calls[0][1] as any).signal).toBeInstanceOf(AbortSignal);
    g.mockRestore(); t.mockRestore();
  });
});
