import { describe, it, expect } from 'vitest';

/** Every non-test source file under src/, as text (Vite ?raw). Keys look like '../components/ui/Button.tsx'. */
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Class names only the deleted legacy stylesheet defined (plus the deleted scoped reset). */
const LEGACY_CLASS = /^(btn(-[a-z]+)?|form-(input|select|label|group|grid(-2)?|actions)|spinner(-xs)?|admin-[a-z-]+|mf-[a-z-]+|card-(elevated|plain|title-tiny)|stat-[a-z-]+|badge-[a-z]+|alert-[a-z]+|dialog-overlay|login-[a-z]+|toast-[a-z]+|page-header|page-title|fade-in|row-hover|striped|filter-bar|map-tab(-[a-z]+)?|lc-[a-z-]+|json-editor(-[a-z]+)?|loading-overlay|color-swatch|tw-ui)$/;
/** The legacy :root variables (Tailwind's are var(--color-*), var(--font-sans), var(--tw-*)). */
const LEGACY_VAR = /var\(--(bg-|text-(primary|secondary|muted|on-accent)|accent|border|success|warning|danger|space-|weight-|font-(main|mono)|radius\)|radius-lg|shadow\))/;
/** Must match the @source lines in tailwind.css. */
const SCANNED = ['../components/', '../pages/', '../context/', '../App.tsx'];

/** Every whitespace-separated token inside a quoted string literal on one line. */
function stringTokens(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) out.push(...m[2].split(/\s+/).filter(Boolean));
  return out;
}

describe('legacy CSS is gone (Review Focus 5)', () => {
  it('found the sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(Object.keys(sources)).toContain('../App.tsx');
  });

  it('no source uses a legacy class name or tw-ui', () => {
    const hits = Object.entries(sources).flatMap(([file, src]) => stringTokens(src).filter((t) => LEGACY_CLASS.test(t)).map((t) => `${file}: ${t}`));
    expect(hits).toEqual([]);
  });

  it('no source reads a legacy CSS variable', () => {
    expect(Object.entries(sources).filter(([, src]) => LEGACY_VAR.test(src)).map(([file]) => file)).toEqual([]);
  });

  it('every file with Tailwind classes sits under an @source path (or its classes would silently vanish)', () => {
    const outside = Object.entries(sources)
      .filter(([file, src]) => /className=/.test(src) && !SCANNED.some((p) => file.startsWith(p)))
      .map(([file]) => file);
    expect(outside).toEqual([]);
  });

  it('the old legacy components are deleted', () => {
    expect(Object.keys(sources).filter((f) => /AdminPageHeader|common\/FieldError|useDashboardManager|pages\/UserManager/.test(f))).toEqual([]);
  });
});
