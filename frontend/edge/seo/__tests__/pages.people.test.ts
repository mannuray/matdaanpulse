import { describe, it, expect } from 'vitest';
import { makeGet, seoApi } from '../api';
import { personPage } from '../pages/person';
import { partyPage } from '../pages/party';
import { buildPage } from '../pages';
import { BASE, apiFrom, party, partyRecord, person, E_ID, DL_ID, P_ID } from './fixtures';

const api = (routes: Record<string, unknown>) => seoApi(makeGet(BASE, apiFrom(routes), new AbortController().signal));

describe('personPage', () => {
  it('counts only shown houses and links every contest', async () => {
    const p = await personPage(api({ [`/candidates/persons/${P_ID}`]: person }), P_ID);
    expect(p.title).toBe('Awadhesh Singh — Election History, Wins & Constituencies | MatdaanPulse');
    expect(p.description).toBe('Awadhesh Singh (BJP): contested 1 election, won 1. Latest: Hajipur, 2025 — won.');
    expect(p.body).toContain(`<a href="/election/${E_ID}/constituency/BR-123">Hajipur</a>`);
    expect(p.body).not.toContain('Hajipur PC');
    expect(p.ogType).toBe('profile');
    expect(p.jsonLd[0]).toMatchObject({ '@type': 'Person', name: 'Awadhesh Singh', url: `https://matdaanpulse.in/person/${P_ID}`, image: person.photo_url });
  });

  it('a person with only hidden-house contests is a 404', async () => {
    const p = await personPage(api({ [`/candidates/persons/${P_ID}`]: { ...person, candidates: [person.candidates[1]] } }), P_ID);
    expect(p.status).toBe(404);
    expect(p.noindex).toBe(true);
  });

  it('a NOTA "person" is a 404', async () => {
    const nota = { ...person, name: 'NOTA', candidates: [{ ...person.candidates[0], name: 'NOTA', party_id: 'NOTA', party_abbreviation: 'NOTA', party_name: 'None of the Above' }] };
    expect((await personPage(api({ [`/candidates/persons/${P_ID}`]: nota }), P_ID)).status).toBe(404);
  });

  it('a person still contesting an upcoming election refreshes every minute', async () => {
    const pending = { ...person, candidates: [{ ...person.candidates[0], election_status: 'Upcoming', status: null, votes: 0 }] };
    expect((await personPage(api({ [`/candidates/persons/${P_ID}`]: pending }), P_ID)).ttl).toBe(60);
  });
});

describe('partyPage', () => {
  const routes = { '/parties/BJP': party, '/parties/BJP/record': partyRecord, '/parties/BJP/record?state=DL': partyRecord };

  it('national view: recent results, table links, Organization JSON-LD', async () => {
    const p = await partyPage(api(routes), 'BJP', null);
    expect(p.title).toBe('Bharatiya Janata Party (BJP) — Election Results & Seat History | MatdaanPulse');
    expect(p.description).toBe('Bharatiya Janata Party (BJP): won 89 of 243 seats in Bihar 2025; won 48 of 70 seats in Delhi 2025.');
    expect(p.path).toBe('/party/BJP');
    expect(p.body).toContain(`<a href="/election/${E_ID}">Bihar 2025</a>`);
    expect(p.jsonLd[0]).toMatchObject({ '@type': 'Organization', name: 'Bharatiya Janata Party', alternateName: 'BJP', foundingDate: '1980',
      sameAs: [party.wikipedia_url, party.website] });
  });

  it('state view keeps ?state= in the canonical and filters rows', async () => {
    const p = await partyPage(api(routes), 'BJP', 'DL');
    expect(p.path).toBe('/party/BJP?state=DL');
    expect(p.title).toBe('Bharatiya Janata Party (BJP) in Delhi — Election Results & Seat History | MatdaanPulse');
    expect(p.body).toContain(`<a href="/election/${DL_ID}">Delhi 2025</a>`);
    expect(p.body).not.toContain('Bihar 2025');
  });

  it('IND and NOTA have no party page', async () => {
    expect((await partyPage(api(routes), 'IND', null)).status).toBe(404);
    expect((await partyPage(api(routes), 'nota', null)).status).toBe(404);
  });
});

describe('buildPage', () => {
  it('dispatches by route kind', async () => {
    const a = api({ [`/candidates/persons/${P_ID}`]: person });
    expect((await buildPage({ kind: 'person', personId: P_ID }, a)).ogType).toBe('profile');
    expect((await buildPage({ kind: 'about' }, a)).path).toBe('/about');
    expect((await buildPage({ kind: 'notFound' }, a)).status).toBe(404);
  });
});
