import { execSync } from 'node:child_process';
import { fileEnv, SCRAPER } from './env';
import { stopSim } from './procs';

export default async function globalTeardown(): Promise<void> {
  stopSim();
  if (process.env.KEEP_SIM === '1') return;
  execSync('echo y | npm run sim:cleanup', { cwd: SCRAPER, env: fileEnv(), stdio: 'inherit' });
}
