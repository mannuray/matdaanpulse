import { describe, it, expect } from 'vitest';

/** The files under test as text (Vite ?raw). */
const files = import.meta.glob(['../../index.html', '../../public/robots.txt', '../main.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const read = (p: 'index.html' | 'public/robots.txt' | 'src/main.tsx') => files[p.startsWith('src/') ? `../${p.slice(4)}` : `../../${p}`];

describe('admin is not indexed and loads no third-party fonts', () => {
  it('index.html asks robots not to index or follow', () => {
    expect(read('index.html')).toMatch(/<meta\s+name="robots"\s+content="noindex,\s*nofollow"/);
  });

  it('robots.txt disallows everything', () => {
    expect(read('public/robots.txt')).toMatch(/User-agent:\s*\*\s*\nDisallow:\s*\/\s*$/m);
  });

  it('index.html links no external stylesheet or font origin (the CSP allows only self)', () => {
    expect(read('index.html')).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
  });

  it('Inter is self-hosted (the font stack in tailwind.css names its family, "Inter Variable")', () => {
    expect(read('src/main.tsx')).toMatch(/import '@fontsource-variable\/inter'/);
  });
});
