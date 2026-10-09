import { SITE_ORIGIN } from './site';

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Every API value placed in HTML (text or attribute) goes through this. */
export const esc = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);

/** JSON-LD as a data block; `<` is escaped so a value can never close the script element. */
export const jsonLd = (data: object): string =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

export const int = (n?: number | null): string => (n == null ? '—' : Math.round(n).toLocaleString('en-IN'));
export const pct = (n?: number | null): string => (n == null ? '—' : `${n.toFixed(1)}%`);
export const link = (href: string | null, text: string): string => (href ? `<a href="${esc(href)}">${esc(text)}</a>` : esc(text));
export const abs = (path: string): string => `${SITE_ORIGIN}${path}`;

/** Plain readable markup for the moment before the app mounts (React replaces it). */
export const shell = (inner: string): string =>
  `<main style="max-width:960px;margin:0 auto;padding:16px;font-family:system-ui,sans-serif;line-height:1.5">${inner}</main>`;

/** `rows` cells are already-escaped HTML. */
export const table = (head: string[], rows: string[][]): string =>
  `<table><thead><tr>${head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
  `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

export const breadcrumbs = (items: { name: string; path: string }[]): object => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
});

export const seatLabel = (s: { name: string; type: string }): string => (s.type && s.type !== 'GEN' ? `${s.name} (${s.type})` : s.name);
export const houseWord = (t: 'LS' | 'VS'): string => (t === 'LS' ? 'Lok Sabha' : 'Assembly');
