export interface OldConst { id: string; constNo: number; name: string }
export interface OldCand { id: string; constId: string; partyId: string; name: string; resultId: string }
export interface ExistingSeed { electionSql: string; constituencies: OldConst[]; candidates: OldCand[]; manifestJson: string | null }

type Val = string | number | boolean | null;

/** Values of one `(…)` tuple line from a generated INSERT … VALUES block. */
export function parseTuples(line: string): Val[] {
  const s = line.trim().replace(/,$/, '');
  if (!s.startsWith('(') || !s.endsWith(')')) throw new Error(`not a tuple: ${line}`);
  const out: Val[] = [];
  let i = 1;
  while (i < s.length - 1) {
    while (s[i] === ' ' || s[i] === ',') i++;
    if (s[i] === "'") {
      let v = ''; i++;
      for (;;) {
        if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue; }
        if (s[i] === "'") { i++; break; }
        if (i >= s.length) throw new Error(`unterminated string: ${line}`);
        v += s[i++];
      }
      out.push(v);
    } else {
      const m = /^[^,)]+/.exec(s.slice(i))!;
      const tok = m[0].trim();
      i += m[0].length;
      out.push(tok === 'NULL' ? null : tok === 'TRUE' ? true : tok === 'FALSE' ? false : Number(tok));
    }
  }
  return out;
}

function block(sql: string, table: string): Val[][] {
  const start = sql.indexOf(`INSERT INTO ${table} (`);
  if (start < 0) return [];
  const lines = sql.slice(start).split('\n').slice(1);
  const rows: Val[][] = [];
  for (const l of lines) { if (!l.trim().startsWith('(')) break; rows.push(parseTuples(l)); }
  return rows;
}

export function readExistingSeed(sql: string): ExistingSeed {
  const e0 = sql.indexOf('INSERT INTO elections');
  const electionSql = sql.slice(e0, sql.indexOf('ON CONFLICT (id) DO NOTHING;', e0) + 'ON CONFLICT (id) DO NOTHING;'.length);
  const constituencies = block(sql, 'constituencies').map(r => ({ id: r[0] as string, constNo: r[5] as number, name: r[4] as string }));
  const results = new Map(block(sql, 'results').map(r => [r[1] as string, r[0] as string]));
  const candidates = block(sql, 'candidates').map(r => {
    const resultId = results.get(r[0] as string);
    if (!resultId) throw new Error(`candidate ${r[0]} has no result row`);
    return { id: r[0] as string, constId: r[3] as string, partyId: r[4] as string, name: r[5] as string, resultId };
  });
  const mm = /^UPDATE elections SET manifest_url = '((?:[^']|'')*)' WHERE id = /m.exec(sql);
  return { electionSql, constituencies, candidates, manifestJson: mm ? mm[1].replace(/''/g, "'") : null };
}
