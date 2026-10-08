import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '../../..');
export const SCRAPER = join(ROOT, 'scraper');
export const ARTIFACTS = join(HERE, '../artifacts/live');
export const API = 'http://localhost:3082/api/v1';
export const MOCK = 'http://localhost:4444';
/** scraper/src/simulation/config.ts */
export const SIM = 'e1e1e1e1-2027-4000-a000-000000000027';
export const TOTAL_ROUNDS = 24;

/** Root .env then backend/.env (first wins), overridden by process.env. */
export function fileEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const f of [join(ROOT, '.env'), join(ROOT, 'backend/.env')]) {
    try {
      for (const line of readFileSync(f, 'utf8').split('\n')) {
        const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
        if (m && !(m[1] in env)) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    } catch { /* absent */ }
  }
  return { ...env, ...(process.env as Record<string, string>) };
}

export async function adminToken(): Promise<string> {
  const env = fileEnv();
  if (env.E2E_ADMIN_TOKEN) return env.E2E_ADMIN_TOKEN;
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) throw new Error('no admin credentials: set E2E_ADMIN_TOKEN or ADMIN_EMAIL/ADMIN_PASSWORD');
  const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }) });
  if (!res.ok) throw new Error(`admin login failed: HTTP ${res.status}`);
  return ((await res.json()) as { data: { access_token: string } }).data.access_token;
}
