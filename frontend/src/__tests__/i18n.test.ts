import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import ta from '../i18n/locales/ta.json';
import mr from '../i18n/locales/mr.json';
import { DATA_NOTES } from '../model/about/about';
import { FEEDBACK_KINDS } from '../model/api/feedback.service';

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
  keys.add('studio_tab_alliances');
  for (const tab of ['overview', 'battle', 'swing', 'history', 'demographics', 'states', 'insights']) keys.add(`map_tab_${tab}`);
  for (const k of ['overview', 'overview_others', 'battle', 'swing', 'history', 'reserved', 'spoilers', 'threeway', 'states']) keys.add(`studio_insight_${k}`);
  for (const k of ['stronghold', 'loyal', 'swing', 'anti_incumbency', 'new']) keys.add(`studio_chip_${k}`);
  for (const k of ['won', 'leading', 'lost', 'trailing', 'pending']) keys.add(`studio_status_${k}`);
  for (const k of ['final', 'live', 'upcoming']) keys.add(`studio_status_label_${k}`);
  for (const k of ['vote_vs_seats', 'closest', 'biggest', 'margin_dist', 'wasted', 'reserved', 'seat_summary', 'net_swing', 'flipped', 'dominance', 'dominance_by_party', 'swing_seats', 'anti_incumbency', 'incumbent_win_rate', 'incumbent_defeats', 'party_switchers', 'switch_directions', 'margin_trend', 'party_trend', 'category_breakdown', 'win_rate_by_category', 'margin_by_category', 'vote_split', 'classification', 'states_by_alliance', 'vote_vs_seats_alliances', 'vote_vs_seats_parties', 'closest_battles', 'state_leaderboard', 'sweep_states', 'competitive_states', 'split_title', 'notable_switchers', 'margin_dist_blocs']) keys.add(`studio_sum_${k}`);
  for (const k of ['seats', 'seat_pct', 'vote_pct', 'disparity', 'avg_margin', 'median_margin', 'close', 'gained', 'lost', 'net', 'win_rate', 'total', 'gen', 'sc', 'st', 'wasted_pct', 'total_votes', 'wasted', 'contested', 'won', 'count', 'margin', 'spoiler_votes', 'result']) keys.add(`studio_col_${k}`);
  for (const k of ['efficiency_gap', 'recontested', 'incumbents_lost', 'lost_rate', 'win_rate', 'switchers', 'switchers_won', 'success_rate', 'analyzed', 'two_way', 'three_way', 'multi_cornered', 'spoiler_affected', 'three_way_short', 'win_rate_short']) keys.add(`studio_row_${k}`);
  for (const q of ['real', 'partial', 'estimated']) { keys.add(`about_quality_${q}`); keys.add(`about_quality_${q}_desc`); }
  for (const n of DATA_NOTES) keys.add(`about_note_${n}`);
  for (const k of FEEDBACK_KINDS) keys.add(`about_feedback_kind_${k}`);
  return keys;
}

describe('i18n', () => {
  it('every key used in source exists in en.json', () => {
    // A plural key is stored as `<key>_one` / `<key>_other`.
    const missing = [...usedKeys()].filter(k => !(k in en) && !(`${k}_other` in en));
    expect(missing).toEqual([]);
  });

  it.each([['hi', hi], ['ta', ta], ['mr', mr]] as const)('%s has the same keys as en', (_lang, locale) => {
    expect(Object.keys(locale).sort()).toEqual(Object.keys(en).sort());
  });
});
