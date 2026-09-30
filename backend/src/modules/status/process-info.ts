import { readFileSync } from 'fs';
import { join } from 'path';

let cachedVersion: string | undefined;
function appVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    cachedVersion = JSON.parse(readFileSync(join(__dirname, '../../../package.json'), 'utf8')).version ?? 'unknown';
  } catch {
    cachedVersion = 'unknown';
  }
  return cachedVersion!;
}

export function buildProcessInfo(startedAt: number, now = Date.now(), env: Record<string, string | undefined> = process.env) {
  const mem = process.memoryUsage();
  const sha = env.RENDER_GIT_COMMIT || env.GIT_SHA;
  return {
    startedAt: new Date(startedAt).toISOString(),
    uptimeSeconds: Math.round((now - startedAt) / 1000),
    nodeVersion: process.version,
    appVersion: appVersion(),
    gitSha: sha ? sha.slice(0, 12) : null,
    memory: { rssMb: Math.round(mem.rss / 1048576), heapUsedMb: Math.round(mem.heapUsed / 1048576) },
  };
}

/** Only `connection_limit` / `pool_timeout` from the URL; host, user and password never leave. */
export function poolConfig(databaseUrl: string | undefined): { connectionLimit: number | null; poolTimeoutSeconds: number | null } {
  const out = { connectionLimit: null as number | null, poolTimeoutSeconds: null as number | null };
  if (!databaseUrl) return out;
  const num = (raw: string | undefined) => {
    const n = Number(raw);
    return raw !== undefined && Number.isFinite(n) ? n : null;
  };
  try {
    const q = new URL(databaseUrl).searchParams;
    out.connectionLimit = num(q.get('connection_limit') ?? undefined);
    out.poolTimeoutSeconds = num(q.get('pool_timeout') ?? undefined);
  } catch {
    /* unparsable URL: report nothing */
  }
  return out;
}
