import { visibleElections } from '../../../src/model/config/houses';
import type { SeoApi } from '../api';
import { esc, link, shell } from '../html';
import { DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE, DEFAULT_TITLE, SITE_NAME, SITE_ORIGIN } from '../site';
import { TTL, type SeoPage } from '../types';

const base = (over: Partial<SeoPage>): SeoPage => ({
  status: 200, title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION, path: null, ogType: 'website',
  image: DEFAULT_OG_IMAGE, jsonLd: [], body: '', noindex: false, ttl: TTL.normal, ...over,
});

export async function homePage(api: SeoApi): Promise<SeoPage> {
  const list = visibleElections(await api.elections()).sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  const items = list.map(e => `<li>${link(`/election/${e.id}`, e.name)}${e.status === 'Live' ? ' — counting now' : ''}</li>`).join('');
  return base({
    path: '/',
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: `${SITE_ORIGIN}/` }],
    body: shell(`<h1>${esc(SITE_NAME)}</h1><p>${esc(DEFAULT_DESCRIPTION)}</p><h2>Elections</h2><ul>${items}</ul>`),
    ttl: list.some(e => e.status === 'Live') ? TTL.live : TTL.normal,
  });
}

export const aboutPage = (): SeoPage => base({
  title: `About ${SITE_NAME} — Data sources and data quality`,
  description: `Where ${SITE_NAME}'s election data comes from, how each dataset was checked, and its known limitations.`,
  path: '/about',
  ttl: TTL.final,
});

export const notFoundPage = (): SeoPage => base({ status: 404, title: `Page not found | ${SITE_NAME}`, noindex: true, ttl: TTL.notFound });

/** The API failed or timed out: generic tags, the app loads normally, cached only briefly. */
export const fallbackPage = (): SeoPage => base({ ttl: TTL.fallback });
