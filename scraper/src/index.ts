/**
 * Scraper service entry point.
 *
 * LIVE ECI INGESTION IS NOT IMPLEMENTED. The scheduler, ECI adapter and normalizer in this
 * package are placeholders only — nothing here fetches live results or writes to the DB.
 *
 * What does work:
 *   - Historical seed generators:   src/generate-*-seed(s).ts  → database/seed_*.sql
 *   - Live-counting simulation:     src/simulation/  (mock ECI server + replay via the admin
 *                                    bulk-override API). See README "Live simulation".
 */
console.error(
  [
    'Live ECI ingestion is not implemented — this entry point does nothing.',
    'To exercise the live pipeline end-to-end, use the simulation instead:',
    '  npx ts-node src/simulation/setup.ts',
    '  npx ts-node src/simulation/mock-eci-server.ts',
    '  npx ts-node src/simulation/replay.ts',
  ].join('\n'),
);
process.exit(1);
