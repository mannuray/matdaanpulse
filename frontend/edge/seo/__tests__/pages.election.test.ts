import { describe, it, expect } from 'vitest';
import { makeGet, seoApi } from '../api';
import { homePage, aboutPage, notFoundPage, fallbackPage } from '../pages/simple';
import { electionPage, groupTally } from '../pages/election';
import { BASE, apiFrom, alliances, election, lsElection, manifest, results, seats, E_ID, LS_ID } from './fixtures';

const api = (routes: Record<string, unknown>) => seoApi(makeGet(BASE, apiFrom(routes), new AbortController().signal));
const full = {
  '/elections': [election, lsElection],
  [`/elections/${E_ID}`]: election,
  [`/elections/${E_ID}/manifest`]: manifest,
  [`/elections/${E_ID}/alliances`]: alliances,
  [`/constituencies?election_id=${E_ID}`]: seats,
  [`/elections/${E_ID}/results`]: results,
  [`/elections/${LS_ID}`]: lsElection,
};

describe('groupTally', () => {
  it('sums alliance members (won + leading) and keeps others alone, biggest first, zero seats dropped', () => {
    const t = [...alliances, { party_id: 'X', party_name: 'X', color: '', won: 0, leading: 0 }];
    expect(groupTally(t, manifest.draft.alliances)).toEqual([
      { name: 'NDA', seats: 174 }, { name: 'MGB', seats: 31 }, { name: 'AIMIM', seats: 5 },
    ]);
  });
});

describe('electionPage', () => {
  it('finished election: tally title, description, seat list with winners, day-long TTL', async () => {
    const p = await electionPage(api(full), E_ID);
    expect(p.status).toBe(200);
    expect(p.title).toBe('Bihar Vidhan Sabha 2025 Results — NDA 174, MGB 31 | MatdaanPulse');
    expect(p.description).toBe('Bihar Vidhan Sabha 2025: NDA 174, MGB 31, AIMIM 5 of 2 seats. Party-wise tally, constituency map and the winner of every seat.');
    expect(p.path).toBe(`/election/${E_ID}`);
    expect(p.ttl).toBe(86_400);
    expect(p.body.indexOf('Hajipur')).toBeLessThan(p.body.indexOf('Lalganj'));
    expect(p.body).toContain(`<a href="/election/${E_ID}/constituency/BR-123">123. Hajipur</a> — Awadhesh Singh (BJP)`);
    expect(p.body).toContain('Some &lt;Name&gt; $&amp; (INC)');
  });

  it('counting election: live wording, declared count and a 60 s TTL', async () => {
    const live = { ...election, status: 'Live' };
    const tally = alliances.map((a, i) => (i === 0 ? { ...a, won: 80, leading: 9 } : a));
    const p = await electionPage(api({ ...full, [`/elections/${E_ID}`]: live, [`/elections/${E_ID}/alliances`]: tally }), E_ID);
    expect(p.title).toBe('Bihar Vidhan Sabha 2025 Live Results — NDA 174, MGB 31 | MatdaanPulse');
    expect(p.description).toBe('Counting live: NDA 174, MGB 31, AIMIM 5 (won + leading) of 2 seats; 2 declared. Constituency-wise live results.');
    expect(p.ttl).toBe(60);
  });

  it('upcoming election with no seats won says nothing about winners', async () => {
    const up = { ...election, status: 'Upcoming' };
    const p = await electionPage(api({ ...full, [`/elections/${E_ID}`]: up, [`/elections/${E_ID}/alliances`]: [], [`/elections/${E_ID}/results`]: [] }), E_ID);
    expect(p.title).toBe('Bihar Vidhan Sabha 2025 — Constituencies & Candidates | MatdaanPulse');
    expect(p.description).toBe('Bihar Vidhan Sabha 2025: all 2 constituencies, candidates and past results.');
    expect(p.body).not.toMatch(/won|—\s*\(/);
    expect(p.ttl).toBe(3_600);
  });

  it('hidden house (Lok Sabha) is a 404', async () => {
    const p = await electionPage(api(full), LS_ID);
    expect(p.status).toBe(404);
    expect(p.noindex).toBe(true);
  });
});

describe('simple pages', () => {
  it('home lists only shown elections and has WebSite JSON-LD', async () => {
    const p = await homePage(api(full));
    expect(p.body).toContain('Bihar Vidhan Sabha 2025');
    expect(p.body).not.toContain('Lok Sabha 2024');
    expect(p.path).toBe('/');
    expect(p.jsonLd[0]).toMatchObject({ '@type': 'WebSite', url: 'https://matdaanpulse.in/' });
  });

  it('about, not found and fallback', () => {
    expect(aboutPage()).toMatchObject({ status: 200, path: '/about', noindex: false });
    expect(notFoundPage()).toMatchObject({ status: 404, path: null, noindex: true, body: '', ttl: 300 });
    expect(fallbackPage()).toMatchObject({ status: 200, path: null, noindex: false, body: '', ttl: 30 });
  });
});
