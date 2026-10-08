import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARTIFACTS, fileEnv, MOCK, SCRAPER } from './env';

const PIDS = join(ARTIFACTS, 'pids.json');

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
    try { process.kill(-pid, 'SIGTERM'); } catch { /* gone */ }
  }
  writeFileSync(PIDS, '[]');
}
