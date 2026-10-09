import { describe, it, expect } from 'vitest';
import { renderHead, injectIntoShell } from '../head';
import type { SeoPage } from '../types';

const SHELL = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>MatdaanPulse</title>
    <script src="/theme-init.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/assets/index-abc.js"></script>
  </body>
</html>`;

const page = (over: Partial<SeoPage> = {}): SeoPage => ({
  status: 200, title: 'Hajipur Result | MatdaanPulse', description: 'BJP won.', path: '/election/x/constituency/BR-1',
  ogType: 'website', image: 'https://matdaanpulse.in/og/default.png', jsonLd: [{ '@type': 'Thing' }],
  body: '<main><h1>Hajipur</h1></main>', noindex: false, ttl: 60, ...over,
});

describe('renderHead', () => {
  it('emits title, description, canonical, OG and Twitter tags, and JSON-LD', () => {
    const h = renderHead(page());
    expect(h).toContain('<title>Hajipur Result | MatdaanPulse</title>');
    expect(h).toContain('<meta name="description" content="BJP won." />');
    expect(h).toContain('<link rel="canonical" href="https://matdaanpulse.in/election/x/constituency/BR-1" />');
    expect(h).toContain('<meta property="og:url" content="https://matdaanpulse.in/election/x/constituency/BR-1" />');
    expect(h).toContain('<meta property="og:image" content="https://matdaanpulse.in/og/default.png" />');
    expect(h).toContain('<meta property="og:site_name" content="MatdaanPulse" />');
    expect(h).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(h).toContain('<script type="application/ld+json">{"@type":"Thing"}</script>');
    expect(h).not.toContain('robots');
  });

  it('noindex pages say so and a null path has no canonical', () => {
    const h = renderHead(page({ noindex: true, path: null }));
    expect(h).toContain('<meta name="robots" content="noindex" />');
    expect(h).not.toContain('canonical');
    expect(h).not.toContain('og:url');
  });

  it('escapes titles and descriptions', () => {
    const h = renderHead(page({ title: '<x> "q"', description: 'a&b' }));
    expect(h).toContain('<title>&lt;x&gt; &quot;q&quot;</title>');
    expect(h).toContain('content="a&amp;b"');
  });
});

describe('injectIntoShell', () => {
  it('replaces the title with the head tags and fills #root', () => {
    const out = injectIntoShell(SHELL, page());
    expect(out).not.toContain('<title>MatdaanPulse</title>');
    expect(out).toContain('<title>Hajipur Result | MatdaanPulse</title>');
    expect(out).toContain('<div id="root"><main><h1>Hajipur</h1></main></div>');
    expect(out).toContain('<script type="module" src="/assets/index-abc.js"></script>');
  });

  it('does not expand $ patterns from data', () => {
    const out = injectIntoShell(SHELL, page({ title: 'A $& B $1', body: '<p>$&</p>' }));
    expect(out).toContain('<title>A $&amp; B $1</title>');
    expect(out).toContain('<div id="root"><p>$&</p></div>');
  });

  it('leaves #root empty for an empty body', () => {
    expect(injectIntoShell(SHELL, page({ body: '' }))).toContain('<div id="root"></div>');
  });
});
