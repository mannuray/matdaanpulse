/**
 * End to end: needs the backend (3082) and mock ECI (4444) running and sim:setup done; flip the sim election to Live first.
 * Starts the worker in-process, advances 24 rounds quickly, and checks /live reports every seat declared.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { IngestClient } from '../live/client';
import { runForever } from '../live/loop';
import { adaptersFor } from '../live/registry';
import { BACKEND_BASE, MOCK_ECI_PORT, SIM_ELECTION_ID, TOTAL_ROUNDS } from './config';

const liveUrl = `${BACKEND_BASE}/elections/${SIM_ELECTION_ID}/live`;
const sleep = (ms: number) => new Promise(x => setTimeout(x, ms));

async function readLive(): Promise<{ declared: number; total: number; status: string }> {
  const res = await fetch(liveUrl);
  if (!res.ok) throw new Error(`GET /live failed: HTTP ${res.status}`);
  return (await res.json() as any).data;
}
async function mock(path: string): Promise<void> {
  const res = await fetch(`http://localhost:${MOCK_ECI_PORT}${path}`, { method: 'POST' });
  if (!res.ok) throw new Error(`mock ${path} failed: HTTP ${res.status}`);
}
function fail(msg: string): never { console.error(`SMOKE FAILED: ${msg}`); process.exit(1); }

async function main() {
  const start = await readLive();
  if (start.declared > 0 || start.status !== 'Live') {
    fail(`election is ${start.status} with ${start.declared} seats declared; run sim:cleanup then sim:setup and set the election Live`);
  }
  await mock('/reset');

  const key = readFileSync(join(__dirname, '../../.sim-ingest-key'), 'utf8').trim();
  const client = new IngestClient({ baseUrl: BACKEND_BASE, key });
  const totals: Record<string, number> = {};
  const origSeats = client.seats.bind(client);
  client.seats = async (id, body) => {
    const r: any = await origSeats(id, body);
    for (const [k, v] of Object.entries(r?.counts ?? {})) totals[k] = (totals[k] ?? 0) + (v as number);
    return r;
  };
  const ac = new AbortController();
  const worker = runForever(SIM_ELECTION_ID, 'rest', { client, adapters: adaptersFor({ log: m => console.warn(m) }), adapterOpts: { 'mock-eci': { intervalMs: '1500' } }, holder: 'smoke', log: m => console.log(m) }, ac.signal);

  const samples: number[] = [];
  const sample = async () => {
    const d = (await readLive()).declared;
    if (samples.length && d < samples[samples.length - 1]) fail(`declared decreased: ${samples.join(',')},${d}`);
    samples.push(d);
    console.log(`declared ${d}/${start.total}`);
  };
  for (let r = 1; r <= TOTAL_ROUNDS; r++) { await mock('/advance-round'); await sleep(2500); await sample(); }
  const deadline = Date.now() + 120_000;
  let live = await readLive();
  while (live.declared < live.total && Date.now() < deadline) { await sleep(3000); await sample(); live = await readLive(); }
  ac.abort(); await worker;

  console.log(`declared samples: ${samples.join(',')}`);
  console.log(`post outcomes: ${JSON.stringify(totals)}`);
  if (live.declared !== live.total) fail(`declared ${live.declared}/${live.total}`);
  if (!samples.some(d => d > 0)) fail('declared never rose above 0 during the count');
  if ((totals.rejected ?? 0) > 0) fail(`${totals.rejected} seats rejected`);
  console.log(`stale total: ${totals.stale ?? 0}`);
  console.log('SMOKE OK');
}
main().catch(e => { console.error(e); process.exit(1); });
