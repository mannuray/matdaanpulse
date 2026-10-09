import { houseShown, visibleElections } from '../../src/model/config/houses';
import { partyPageHref } from '../../src/model/derive/partyRecord';
import type { SeoApi } from './api';
import { abs, esc } from './html';
import type { Route } from './routes';
import { TTL } from './types';

export interface Sitemap { xml: string; ttl: number }

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n';
const NS = 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';
/** Protocol limit per file; the largest election (UP, ~400 seats, ~5k candidates) is far below it. */
const MAX_URLS = 50_000;

const urlset = (paths: string[]): string =>
  `${XML_HEAD}<urlset ${NS}>\n${paths.slice(0, MAX_URLS).map(p => `  <url><loc>${esc(abs(p))}</loc></url>`).join('\n')}\n</urlset>\n`;
const index = (paths: string[]): string =>
  `${XML_HEAD}<sitemapindex ${NS}>\n${paths.map(p => `  <sitemap><loc>${esc(abs(p))}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;

async function sitemapIndex(api: SeoApi): Promise<Sitemap> {
  const list = visibleElections(await api.elections());
  return {
    xml: index(['/sitemaps/parties.xml', ...list.map(e => `/sitemaps/election-${e.id}.xml`)]),
    ttl: list.some(e => e.status === 'Live') ? TTL.sitemapLive : TTL.sitemap,
  };
}

/** The election, every seat, and every candidate's person page (from the results rows). */
async function electionSitemap(api: SeoApi, id: string): Promise<Sitemap | null> {
  const e = await api.election(id);
  if (!houseShown(e.type)) return null;
  const [seats, results] = await Promise.all([api.constituencies(id), api.results(id)]);
  const persons = [...new Set(results.map(r => r.person_id).filter((p): p is string => !!p))];
  return {
    xml: urlset([`/election/${e.id}`, ...seats.map(s => `/election/${e.id}/constituency/${s.id}`), ...persons.map(p => `/person/${p}`)]),
    ttl: e.status === 'Live' ? TTL.sitemapLive : TTL.sitemap,
  };
}

async function partiesSitemap(api: SeoApi): Promise<Sitemap> {
  const paths = (await api.parties()).map(p => partyPageHref(p.id)).filter((p): p is string => !!p);
  return { xml: urlset(paths), ttl: TTL.sitemap };
}

export function buildSitemap(route: Route, api: SeoApi): Promise<Sitemap | null> {
  switch (route.kind) {
    case 'sitemapIndex': return sitemapIndex(api);
    case 'sitemapElection': return electionSitemap(api, route.electionId);
    case 'sitemapParties': return partiesSitemap(api);
    default: return Promise.resolve(null);
  }
}
