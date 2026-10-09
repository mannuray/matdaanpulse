import { describe, it, expect } from 'vitest';
import { matchRoute, routeKey } from '../routes';

const E = '11111111-1111-4111-8111-111111111111';

describe('matchRoute', () => {
  it.each([
    ['/', '', { kind: 'home' }],
    ['/about', '', { kind: 'about' }],
    ['/about/', '', { kind: 'about' }],
    [`/election/${E}`, '', { kind: 'election', electionId: E }],
    [`/election/${E.toUpperCase()}/`, '', { kind: 'election', electionId: E }],
    [`/election/${E}/constituency/BR-123`, '', { kind: 'constituency', electionId: E, constId: 'BR-123' }],
    [`/election/${E}/constituency/A%26B`, '', { kind: 'constituency', electionId: E, constId: 'A&B' }],
    [`/person/${E}`, '', { kind: 'person', personId: E }],
    ['/party/BJP', '', { kind: 'party', partyId: 'BJP', state: null }],
    ['/party/CPI(M)', '?state=wb', { kind: 'party', partyId: 'CPI(M)', state: 'WB' }],
    ['/party/CPI%28M%29', '?state=WB&x=1', { kind: 'party', partyId: 'CPI(M)', state: 'WB' }],
    ['/party/BJP', '?state=Bihar', { kind: 'party', partyId: 'BJP', state: null }],
    ['/sitemap.xml', '', { kind: 'sitemapIndex' }],
    ['/party/A+B', '', { kind: 'party', partyId: 'A+B', state: null }],
    [`/sitemaps/election-${E}.xml`, '', { kind: 'sitemapElection', electionId: E }],
  ])('%s%s', (path, search, expected) => {
    expect(matchRoute(path, search)).toEqual(expected);
  });

  it.each([
    '/election/not-a-uuid',
    `/election/${E}/constituency/bad%ZZ`,
    `/election/${E}/constituency/has space`,
    '/person/123',
    '/party/%3Cscript%3E',
    '/sitemaps/election-x.xml',
    '/sitemaps/parties.xml',
    "/party/O'NEIL",
    '/party/ABCDEFGHIJKLMNOPQRSTU',
    '/nope',
    `/election/${E}/extra/segments/here`,
  ])('%s is not found', path => {
    expect(matchRoute(path, '')).toEqual({ kind: 'notFound' });
  });
});

describe('routeKey', () => {
  it('variants of one page share a key; only ?state= survives', () => {
    const k = (p: string, s = '') => routeKey(matchRoute(p, s));
    expect(k(`/election/${E}`, '?fbclid=abc&utm_source=wa')).toBe(`/election/${E}`);
    expect(k(`/election/${E.toUpperCase()}/`)).toBe(`/election/${E}`);
    expect(k(`/election/${E}/constituency/A%26B`)).toBe(`/election/${E}/constituency/A%26B`);
    expect(k('/party/CPI%28M%29', '?state=wb&fbclid=1')).toBe('/party/CPI(M)?state=WB');
    expect(k('/', '?utm_source=x')).toBe('/');
    expect(k('/sitemap.xml')).toBe('/sitemap.xml');
    expect(k(`/sitemaps/election-${E}.xml`)).toBe(`/sitemaps/election-${E}.xml`);
    expect(k('/random/a')).toBe(k('/random/b'));
  });
});
