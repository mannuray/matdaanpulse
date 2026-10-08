import { Logger } from '@nestjs/common';
import type { AllianceIn, HeavyweightIn, HeavyweightReason, VoteSplitIn } from './seat-analysis';

type Json = Record<string, unknown>;
const arr = (v: unknown): Json[] => (Array.isArray(v) ? v.filter((x): x is Json => !!x && typeof x === 'object') : []);
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

const logger = new Logger('Manifest');

/**
 * The single place `elections.manifest_url` (JSON text in a column that is misnamed
 * "url") is parsed. Returns the manifest object (arrays and scalars are not manifests), or null when absent or not valid
 * JSON (logged, never thrown, so one bad row cannot break a page).
 */
export function parseManifest(raw: unknown): Json | null {
  if (raw === null || raw === undefined || raw === '') return null;
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      logger.warn('manifest_url is not valid JSON; treating the manifest as absent');
      return null;
    }
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
}

/** What the seat analysis reads from a manifest. A missing or bad manifest reads as empty. */
export function manifestBits(raw: string | null) {
  const m: Json = parseManifest(raw) ?? {};
  const alliances: AllianceIn[] = arr(m.alliances).map(a => ({ id: String(a.id ?? ''), parties: Array.isArray(a.parties) ? a.parties.map(String) : [] })).filter(a => a.id);
  const g = m.government as Json | undefined;
  const government = g && Array.isArray(g.parties) && g.parties.length ? g.parties.map(String) : null;
  const voteSplits: VoteSplitIn[] = arr(m.vote_splits).filter(v => str(v.spoiler) && str(v.hurts))
    .map(v => ({ spoiler: String(v.spoiler), hurts: String(v.hurts), ...(str(v.label) ? { label: String(v.label) } : {}) }));
  const hw = (list: unknown, reason: HeavyweightReason): HeavyweightIn[] =>
    arr(list).filter(x => str(x.name)).map(x => ({ person_id: str(x.person_id), name: String(x.name), party_id: str(x.party_id), reason }));
  return { alliances, government, voteSplits, heavyweights: [...hw(m.leaders, 'leader'), ...hw(m.cabinet, 'cabinet')] };
}

/** An election's date YYYY-MM-DD: its counting date (`tentative_next_date`), else 1 July of its year (the lineage comparison window). */
export function electionDate(tentativeNextDate: Date | null | undefined, year: number): string {
  return tentativeNextDate ? tentativeNextDate.toISOString().slice(0, 10) : `${year}-07-01`;
}
