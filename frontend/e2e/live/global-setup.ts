import { execSync } from 'node:child_process';
import { request as pwRequest } from '@playwright/test';
import { fileEnv, SCRAPER } from './env';
import { preflight } from './preflight';
import { startSim, stopSim } from './procs';
import { setStatus } from './sim';

export default async function globalSetup(): Promise<void> {
  stopSim(); // leftovers of a crashed run
  await preflight();
  const opts = { cwd: SCRAPER, env: fileEnv(), stdio: 'inherit' as const };
  execSync('echo y | npm run sim:cleanup', opts);
  execSync('npm run sim:setup', opts);
  const request = await pwRequest.newContext();
  await setStatus(request, 'Upcoming');
  await setStatus(request, 'Live'); // computes the baseline, as on counting day (admin-elections.controller computeIfLive)
  await request.dispose();
  await startSim();
}
