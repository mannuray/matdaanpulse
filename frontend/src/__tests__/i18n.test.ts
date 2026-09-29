import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import ta from '../i18n/locales/ta.json';
import mr from '../i18n/locales/mr.json';

const SRC = resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : sourceFiles(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

function usedKeys(): Set<string> {
  const keys = new Set<string>();
  // t('key'), tRef.current('key'), and template keys like t(`map_tab_${tab}`) are handled separately.
  const re = /\bt(?:Ref\.current)?\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
  for (const f of sourceFiles(SRC)) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(re)) keys.add(m[1]);
  }
  // Keys selected through a variable.
  keys.add('toast_leads');
  keys.add('toast_wins');
  for (const tab of ['overview', 'battle', 'swing', 'history', 'demographics', 'states', 'insights']) keys.add(`map_tab_${tab}`);
  return keys;
}

describe('i18n', () => {
  it('every key used in source exists in en.json', () => {
    const missing = [...usedKeys()].filter(k => !(k in en));
    expect(missing).toEqual([]);
  });

  it.each([['hi', hi], ['ta', ta], ['mr', mr]] as const)('%s has the same keys as en', (_lang, locale) => {
    expect(Object.keys(locale).sort()).toEqual(Object.keys(en).sort());
  });
});
