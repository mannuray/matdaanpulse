import { execSync } from 'node:child_process';
import { request as pwRequest } from '@playwright/test';
import { ARTIFACTS, fileEnv, SCRAPER } from './env';
import { preflight } from './preflight';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { SETUP_OK, startSim, stopSim, waitMockGone } from './procs';
import { setStatus } from './sim';

export default async function globalSetup(): Promise<void> {
  mkdirSync(ARTIFACTS, { recursive: true });
  rmSync(SETUP_OK, { force: true });
  stopSim(); // leftovers of a crashed run
  await waitMockGone();
  await preflight();
  // Playwright runs global teardown even when setup throws: teardown touches the DB only after this marker.
  writeFileSync(SETUP_OK, new Date().toISOString());
  const opts = { cwd: SCRAPER, env: fileEnv(), stdio: 'inherit' as const };
  execSync('echo y | npm run sim:cleanup', opts);
  execSync('npm run sim:setup', opts);
  const request = await pwRequest.newContext();
  await setStatus(request, 'Upcoming');
  await setStatus(request, 'Live'); // computes the baseline, as on counting day (admin-elections.controller computeIfLive)
  await request.dispose();
  await startSim();
}
