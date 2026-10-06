export {};
/**
 * Recompute the stored seat analysis for every election (after a change to the comparison rules, e.g. party lineage).
 * Logs in as an admin and calls POST /admin/constituencies/analysis/compute/:id for each election, one at a time.
 * Env: API_BASE_URL (default http://localhost:3082/api/v1), ADMIN_EMAIL, ADMIN_PASSWORD.
 * Usage: npx ts-node src/recompute-analysis-cli.ts [--type VS]
 */
const BASE = process.env.API_BASE_URL ?? 'http://localhost:3082/api/v1';

async function call<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${r.status} ${JSON.stringify(body).slice(0, 200)}`);
  return (body.data ?? body) as T;
}

async function main() {
  const email = process.env.ADMIN_EMAIL, password = process.env.ADMIN_PASSWORD;
  if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
  const login = await call<{ access_token?: string; accessToken?: string; token?: string }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const token = login.access_token ?? login.accessToken ?? login.token;
  if (!token) throw new Error('login returned no token');
  const typeArg = process.argv.indexOf('--type');
  const type = typeArg > 0 ? process.argv[typeArg + 1] : undefined;
  const all = await call<{ id: string; name: string; type: string; status: string; year: number; state_id: number | null }[]>('/elections');
  const elections = all
    .filter(e => e.status !== 'Upcoming' && (!type || e.type === type));
  let done = 0;
  for (const e of elections as typeof all) {
    // The backend compares only with the history ids it is given (filtered to comparable elections): take them from the
    // election's manifest, as the dashboards do.
    const wrapped = await call<{ manifest_url?: string | Record<string, unknown> | null } | null>(`/elections/${e.id}/manifest`).catch(() => null);
    const raw = wrapped?.manifest_url ?? null;
    const manifest = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { history?: string[] } | null;
    // Older manifests carry no history: fall back to every earlier election of the state and type (the backend keeps
    // only the comparable ones, same delimitation).
    const history = manifest?.history?.length ? manifest.history
      : all.filter(x => x.type === e.type && x.state_id === e.state_id && x.year < e.year).sort((a, b) => a.year - b.year).map(x => x.id);
    const r = await call<unknown[] | { computed?: number }>(`/admin/constituencies/analysis/compute/${e.id}`,
      { method: 'POST', body: JSON.stringify({ history_election_ids: history, manifest: manifest ?? undefined }) }, token);
    done++;
    console.log(`${done}/${elections.length} ${e.name}: history ${history.length}, ${Array.isArray(r) ? r.length : r?.computed ?? '?'} seats`);
  }
}
main().catch(e => { console.error(e.message ?? e); process.exit(1); });
