/** Advances the mock ECI server one round every ROUND_DELAY_MS until TOTAL_ROUNDS; the worker (npm run sim:live) does the ingest. */
import { DEFAULT_ROUND_DELAY_MS, MOCK_ECI_PORT, TOTAL_ROUNDS } from './config';

const delay = Number(process.env.ROUND_DELAY_MS ?? DEFAULT_ROUND_DELAY_MS);
async function main() {
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const res = await fetch(`http://localhost:${MOCK_ECI_PORT}/advance-round`, { method: 'POST' });
    console.log(`round ${(await res.json()).round}/${TOTAL_ROUNDS}`);
    if (r < TOTAL_ROUNDS) await new Promise(x => setTimeout(x, delay));
  }
}
main().catch(e => { console.error(e); process.exit(1); });
