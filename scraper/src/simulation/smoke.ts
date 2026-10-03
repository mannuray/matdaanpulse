/**
 * End to end: needs the backend (3082) and mock ECI (4444) running and sim:setup done; flip the sim election to Live first.
 * Starts the worker in-process, advances 24 rounds quickly, and checks /live reports every seat declared.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { IngestClient } from '../live/client';
import { runForever } from '../live/loop';
import { ADAPTERS } from '../live/registry';
import { BACKEND_BASE, MOCK_ECI_PORT, SIM_ELECTION_ID, TOTAL_ROUNDS } from './config';

async function main() {
  const key = readFileSync(join(__dirname, '../../.sim-ingest-key'), 'utf8').trim();
  const client = new IngestClient({ baseUrl: BACKEND_BASE, key });
  const ac = new AbortController();
  const worker = runForever(SIM_ELECTION_ID, 'rest', { client, adapters: ADAPTERS, adapterOpts: { 'mock-eci': { intervalMs: '1500' } }, holder: 'smoke', log: m => console.log(m) }, ac.signal);
  await fetch(`http://localhost:${MOCK_ECI_PORT}/reset`, { method: 'POST' });
  for (let r = 1; r <= TOTAL_ROUNDS; r++) { await fetch(`http://localhost:${MOCK_ECI_PORT}/advance-round`, { method: 'POST' }); await new Promise(x => setTimeout(x, 2500)); }
  const deadline = Date.now() + 120_000;
  let live: any;
  do { await new Promise(x => setTimeout(x, 3000)); live = (await (await fetch(`${BACKEND_BASE}/elections/${SIM_ELECTION_ID}/live`)).json()).data; console.log(`declared ${live.declared}/${live.total}`); }
  while (live.declared < live.total && Date.now() < deadline);
  ac.abort(); await worker;
  if (live.declared !== live.total) { console.error('SMOKE FAILED'); process.exit(1); }
  console.log('SMOKE OK');
}
main().catch(e => { console.error(e); process.exit(1); });
