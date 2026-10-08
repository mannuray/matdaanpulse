import { API, fileEnv, MOCK } from './env';

async function up(url: string): Promise<boolean> {
  try { return (await fetch(url)).ok; } catch { return false; }
}

/** Stops the run with a one-line fix when a prerequisite is missing; never runs against a remote database. */
export async function preflight(): Promise<void> {
  const db = fileEnv().DATABASE_URL ?? '';
  const host = /@([^:/?]+)/.exec(db)?.[1];
  if (!host || !['localhost', '127.0.0.1'].includes(host)) throw new Error(`preflight: DATABASE_URL host is "${host ?? 'unset'}"; the live e2e runs only against a local database`);
  if (!(await up(`${API}/health/ready`))) throw new Error('preflight: backend not ready on :3082 (start it with THROTTLE_PUBLIC_PER_MIN=100000)');
  if (!(await up('http://localhost:3080'))) throw new Error('preflight: frontend not running on :3080 (cd frontend && npm run dev)');
  if (await up(`${MOCK}/status`)) throw new Error('preflight: something already listens on :4444 (a stray mock ECI?); stop it first');
}
