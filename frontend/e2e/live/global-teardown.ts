import { execSync } from 'node:child_process';
import { fileEnv, SCRAPER } from './env';
import { existsSync, rmSync } from 'node:fs';
import { SETUP_OK, stopSim } from './procs';

export default async function globalTeardown(): Promise<void> {
  stopSim();
  // No marker: preflight refused (e.g. a non-local DATABASE_URL, a stray mock) — leave every database alone.
  if (!existsSync(SETUP_OK)) return;
  rmSync(SETUP_OK, { force: true });
  if (process.env.KEEP_SIM === '1') return;
  execSync('echo y | npm run sim:cleanup', { cwd: SCRAPER, env: fileEnv(), stdio: 'inherit' });
}
