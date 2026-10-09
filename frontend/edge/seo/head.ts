import { abs, esc, jsonLd } from './html';
import { SITE_NAME } from './site';
import type { SeoPage } from './types';

export function renderHead(p: SeoPage): string {
  const url = p.path === null ? null : abs(p.path);
  const meta = (attr: 'name' | 'property', key: string, value: string) => `<meta ${attr}="${key}" content="${esc(value)}" />`;
  return [
    `<title>${esc(p.title)}</title>`,
    meta('name', 'description', p.description),
    url ? `<link rel="canonical" href="${esc(url)}" />` : '',
    p.noindex ? '<meta name="robots" content="noindex" />' : '',
    meta('property', 'og:type', p.ogType),
    meta('property', 'og:site_name', SITE_NAME),
    meta('property', 'og:locale', 'en_IN'),
    meta('property', 'og:title', p.title),
    meta('property', 'og:description', p.description),
    url ? meta('property', 'og:url', url) : '',
    meta('property', 'og:image', p.image),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', SITE_NAME),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', p.title),
    meta('name', 'twitter:description', p.description),
    meta('name', 'twitter:image', p.image),
    ...p.jsonLd.map(jsonLd),
  ].filter(Boolean).join('\n    ');
}

/** Function replacers: data containing `$&` / `$1` must be inserted literally. */
export function injectIntoShell(shell: string, p: SeoPage): string {
  const head = renderHead(p);
  return shell
    .replace(/<title>[\s\S]*?<\/title>/, () => head)
    .replace('<div id="root"></div>', () => `<div id="root">${p.body}</div>`);
}
