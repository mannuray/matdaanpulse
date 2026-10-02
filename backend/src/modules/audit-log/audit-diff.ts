/**
 * "Only the changed fields" for audit rows: compare two rows of the same table column by column.
 * Values are compared in their JSON form (Date → ISO string, Prisma Decimal → string, bigint → number), and
 * `metadata` is compared key by key so a one-key edit records just that key.
 */

import { toJsonSafe } from '../../common/util/json-safe';

const IGNORED = new Set(['updated_at']);

type Row = Record<string, unknown>;

const toJson = toJsonSafe;

function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Row).sort().map((k) => `${JSON.stringify(k)}:${stable((v as Row)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

const same = (a: unknown, b: unknown) => stable(a) === stable(b);

const isPlainObject = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

export function changedFields(before: Row, after: Row): { oldValue: Row; newValue: Row } | null {
  const oldValue: Row = {};
  const newValue: Row = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (IGNORED.has(key)) continue;
    const a = toJson(before[key]);
    const b = toJson(after[key]);
    if (key === 'metadata' && (a === null || isPlainObject(a)) && (b === null || isPlainObject(b))) {
      const am = (a as Row | null) || {};
      const bm = (b as Row | null) || {};
      const oldMeta: Row = {};
      const newMeta: Row = {};
      for (const k of new Set([...Object.keys(am), ...Object.keys(bm)])) {
        const av = am[k] === undefined ? null : am[k];
        const bv = bm[k] === undefined ? null : bm[k];
        if (!same(av, bv)) { oldMeta[k] = av; newMeta[k] = bv; }
      }
      if (Object.keys(newMeta).length) { oldValue.metadata = oldMeta; newValue.metadata = newMeta; }
      continue;
    }
    if (!same(a, b)) { oldValue[key] = a; newValue[key] = b; }
  }
  return Object.keys(newValue).length ? { oldValue, newValue } : null;
}

/** The set columns of a new row (null, undefined and empty metadata left out). */
export function createdFields(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (IGNORED.has(key) || value === null || value === undefined) continue;
    const v = toJson(value);
    if (key === 'metadata' && isPlainObject(v) && Object.keys(v).length === 0) continue;
    out[key] = v;
  }
  return out;
}
