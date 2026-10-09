import { describe, it, expect } from 'vitest';
import { makeGet, seoApi } from '../api';
import { buildSitemap } from '../sitemap';
import { BASE, apiFrom, election, lsElection, parties, results, seats, E_ID, LS_ID, P_ID, P2_ID } from './fixtures';

const api = (routes: Record<string, unknown>) => seoApi(makeGet(BASE, apiFrom(routes), new AbortController().signal));
const routes = {
  '/elections': [election, lsElection],
  [`/elections/${E_ID}`]: election,
  [`/elections/${LS_ID}`]: lsElection,
  [`/constituencies?election_id=${E_ID}`]: seats,
  [`/elections/${E_ID}/results`]: results,
  '/parties': parties,
};

describe('sitemaps', () => {
  it('index lists each shown election only', async () => {
    const s = (await buildSitemap({ kind: 'sitemapIndex' }, api(routes)))!;
    expect(s.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true);
    expect(s.xml).not.toContain('parties.xml');
    expect(s.xml).toContain(`<loc>https://matdaanpulse.in/sitemaps/election-${E_ID}.xml</loc>`);
    expect(s.xml).not.toContain(LS_ID);
    expect(s.ttl).toBe(86_400);
  });

  it('index refreshes every 10 minutes while an election is counting', async () => {
    const s = (await buildSitemap({ kind: 'sitemapIndex' }, api({ ...routes, '/elections': [{ ...election, status: 'Live' }] })))!;
    expect(s.ttl).toBe(600);
  });

  it('election sitemap: election, every seat, each person once', async () => {
    const s = (await buildSitemap({ kind: 'sitemapElection', electionId: E_ID }, api(routes)))!;
    expect(s.xml).toContain(`<loc>https://matdaanpulse.in/election/${E_ID}</loc>`);
    expect(s.xml).toContain(`<loc>https://matdaanpulse.in/election/${E_ID}/constituency/BR-123</loc>`);
    expect(s.xml).toContain(`<loc>https://matdaanpulse.in/election/${E_ID}/constituency/BR-124</loc>`);
    expect(s.xml.match(new RegExp(`/person/${P_ID}<`, 'g'))).toHaveLength(1);
    expect(s.xml).toContain(`/person/${P2_ID}<`);
    expect(s.xml.match(/<url>/g)).toHaveLength(8);
  });

  it('NOTA rows add no person URL', async () => {
    const withNota = [...results, { const_id: 'BR-123', party_id: 'NOTA', candidate_name: 'NOTA', votes: 10, status: 'LOST', margin: 0, person_id: 'nota-person' }];
    const s = (await buildSitemap({ kind: 'sitemapElection', electionId: E_ID }, api({ ...routes, [`/elections/${E_ID}/results`]: withNota })))!;
    expect(s.xml).not.toContain('nota-person');
  });

  it('hidden-house election sitemap is a 404', async () => {
    expect(await buildSitemap({ kind: 'sitemapElection', electionId: LS_ID }, api(routes))).toBeNull();
  });

  it('election sitemap lists each party that contested it once, never IND/NOTA', async () => {
    const extra = [...results, { const_id: 'BR-124', party_id: 'IND', candidate_name: 'X', votes: 5, status: 'LOST', margin: 0, person_id: null },
      { const_id: 'BR-124', party_id: 'CPI(M)', candidate_name: 'Y', votes: 6, status: 'LOST', margin: 0, person_id: null },
      { const_id: 'BR-123', party_id: 'BJP', candidate_name: 'Z', votes: 1, status: 'LOST', margin: 0, person_id: null }];
    const s = (await buildSitemap({ kind: 'sitemapElection', electionId: E_ID }, api({ ...routes, [`/elections/${E_ID}/results`]: extra })))!;
    expect(s.xml.match(/\/party\/BJP</g)).toHaveLength(1);
    expect(s.xml).toContain('<loc>https://matdaanpulse.in/party/CPI(M)</loc>');
    expect(s.xml).not.toContain('/party/IND');
  });

  it('page routes are not sitemaps', async () => {
    expect(await buildSitemap({ kind: 'home' }, api(routes))).toBeNull();
  });
});
