import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTIFACTS, fileEnv, MOCK, SCRAPER } from './env';

const PIDS = join(ARTIFACTS, 'pids.json');
/** Written by global setup once preflight passed; global teardown cleans the DB only when it exists. */
export const SETUP_OK = join(ARTIFACTS, 'setup-ok');

/** Our sim process (npm run sim:… / ts-node of the simulation or worker)? A stale pid may now be anything else. */
function isSimProcess(pid: number): boolean {
  try {
    const cmd = execSync(`ps -o command= -p ${pid}`, { encoding: 'utf8' });
    return /sim:(mock-eci|live)|mock-eci-server\.ts|src\/live\/run\.ts/.test(cmd);
  } catch { return false; } // gone
}

function start(name: string, script: string): ChildProcess {
  mkdirSync(ARTIFACTS, { recursive: true });
  const log = createWriteStream(join(ARTIFACTS, `${name}.log`));
  // Own process group, so stopSim can kill npm and the ts-node child together.
  const child = spawn('npm', ['run', script], { cwd: SCRAPER, env: fileEnv(), detached: true });
  child.stdout?.pipe(log);
  child.stderr?.pipe(log);
  return child;
}

function remember(pids: (number | undefined)[]): void {
  const old = existsSync(PIDS) ? (JSON.parse(readFileSync(PIDS, 'utf8')) as number[]) : [];
  writeFileSync(PIDS, JSON.stringify([...old, ...pids.filter((p): p is number => !!p)]));
}

/** Starts the mock ECI (waits until it answers) and the worker. */
export async function startSim(): Promise<void> {
  const mock = start('mock-eci', 'sim:mock-eci');
  remember([mock.pid]);
  const deadline = Date.now() + 90_000;
  for (;;) {
    try { if ((await fetch(`${MOCK}/status`)).ok) break; } catch { /* not yet */ }
    if (Date.now() > deadline) throw new Error(`mock ECI did not start; see ${join(ARTIFACTS, 'mock-eci.log')}`);
    await new Promise(r => setTimeout(r, 500));
  }
  const worker = start('worker', 'sim:live');
  remember([worker.pid]);
}

/** Kills the process groups started by startSim (also those of a crashed run). */
export function stopSim(): void {
  if (!existsSync(PIDS)) return;
  for (const pid of JSON.parse(readFileSync(PIDS, 'utf8')) as number[]) {
    if (!isSimProcess(pid)) continue;
    try { process.kill(-pid, 'SIGTERM'); } catch { /* gone */ }
  }
  writeFileSync(PIDS, '[]');
}

/** Waits (up to 10 s) until nothing answers on the mock ECI port, e.g. after stopSim killed a crashed run's mock. */
export async function waitMockGone(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    try { await fetch(`${MOCK}/status`); } catch { return; }
    await new Promise(r => setTimeout(r, 500));
  }
}
