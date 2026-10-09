import { describe, it, expect } from 'vitest';
import { esc, jsonLd, int, pct, link, abs, table, breadcrumbs, seatLabel, houseWord } from '../html';

describe('html helpers', () => {
  it('escapes every HTML-significant character', () => {
    expect(esc(`<a href="x">Tom & 'Jerry'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;Tom &amp; &#39;Jerry&#39;&lt;/a&gt;');
    expect(esc(null)).toBe('');
    expect(esc(42)).toBe('42');
  });

  it('JSON-LD cannot close its script element', () => {
    const out = jsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out.startsWith('<script type="application/ld+json">')).toBe(true);
    expect(out.match(/<\/script>/g)).toHaveLength(1);
    expect(out).toContain('\\u003c/script>');
  });

  it('formats numbers the Indian way', () => {
    expect(int(123456)).toBe('1,23,456');
    expect(int(null)).toBe('—');
    expect(pct(48.44)).toBe('48.4%');
    expect(pct(undefined)).toBe('—');
  });

  it('links escape href and text; no href gives plain text', () => {
    expect(link('/party/CPI(M)', 'A&B')).toBe('<a href="/party/CPI(M)">A&amp;B</a>');
    expect(link(null, '<x>')).toBe('&lt;x&gt;');
  });

  it('builds absolute URLs, tables and breadcrumbs', () => {
    expect(abs('/about')).toBe('https://matdaanpulse.in/about');
    expect(table(['A'], [['<b>1</b>']])).toBe('<table><thead><tr><th>A</th></tr></thead><tbody><tr><td><b>1</b></td></tr></tbody></table>');
    expect(breadcrumbs([{ name: 'Home', path: '/' }, { name: 'X', path: '/x' }])).toEqual({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://matdaanpulse.in/' },
        { '@type': 'ListItem', position: 2, name: 'X', item: 'https://matdaanpulse.in/x' },
      ],
    });
  });

  it('labels seats and houses', () => {
    expect(seatLabel({ name: 'Hajipur', type: 'GEN' })).toBe('Hajipur');
    expect(seatLabel({ name: 'Lalganj', type: 'SC' })).toBe('Lalganj (SC)');
    expect(houseWord('VS')).toBe('Assembly');
    expect(houseWord('LS')).toBe('Lok Sabha');
  });
});
