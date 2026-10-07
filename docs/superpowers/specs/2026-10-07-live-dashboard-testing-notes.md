# Live dashboard testing: handoff notes

Status: **not started.** Written on 2026-10-07 for a fresh session. These are notes, not an approved spec or plan.
Resume at §6: agree the scope and the open questions, then write the test plan.

## 1. Why

The next counting day is **27 February 2027** (Goa, Uttarakhand, Punjab, Manipur, Uttar Pradesh). The live pipeline
was built and unit-tested on 2026-10-03. Since then:

- the public dashboard has changed: Regions became a map layer (2026-10-05), the election picker was rebuilt, and
  party lineage now feeds comparisons;
- every state's data has been reseeded.

The whole path has **not** been tested end to end from a viewer's point of view: ECI site → worker → ingest API →
DB → versioned snapshot → CDN → open dashboards. That includes at production scale and with the admin Live Console
drills. Counting day allows no fixes mid-way (no backend pushes during counting, per `docs/LIVE_RUNBOOK.md`), so
everything has to be proven beforehand.

## 2. What exists

- **Design:** `docs/superpowers/specs/2026-10-03-live-ingest-design.md`. **Runbook:** `docs/LIVE_RUNBOOK.md`
  (T-7 days, T-1 day drills, counting day, after, simulation). **Hosting and caching:** `docs/DEPLOYMENT.md` §2.2
  (CDN-ready live) and §5.8 (live worker).
- **Ingest API** (`backend/src/modules/ingest`):
  - machine keys (`mpk_…`), shards and leases (30 s heartbeat, takeover within 90 s);
  - holds from admin seat corrections, rejected seats, refusals (`no_lease` / `inactive_source`), tally check,
    alerts (webhook);
  - `GET /api/v1/health/ingest`.
- **Viewer path:**
  - `GET /elections/:id/live` returns `{version, status, updatedAt, declared, total}`. It uses `s-maxage=5` while
    Live.
  - `results?v=<version>` returns an immutable snapshot (results, tally, vote share from one query). The version is
    bumped by DB triggers (migration 015).
  - Frontend: `model/live/poller.ts` + `viewmodels/data/useLiveSnapshot.ts` (pauses in hidden tabs, shows an error
    with Retry after 3 failures); seat state and rounds come from the snapshot.
- **Admin Live Console:** feed, shards, holds, seat corrections, over SSE through Redis pub/sub.
- **Worker** (`scraper/src/live/`):
  - `npm run live` and `npm run live:check` (`READY` / `NOT READY`);
  - adapters `eci-web` (ECI's `ResultAcGen…` site) and `mock-eci`;
  - config example `scraper/live.config.example.json`.
- **Simulation** (`scraper/src/simulation/`): clones Bihar 2025 into a fictional Live election and replays it
  through the same ingest API. Commands: `sim:mock-eci` (port 4444), `sim:setup`, `sim:live`, `sim:replay`
  (`ROUND_DELAY_MS`), `sim:smoke` (automated end-to-end), `sim:reset`, `sim:cleanup`.
- **Existing tests:**
  - backend and worker unit tests;
  - `sim:smoke`;
  - one Playwright test (`frontend/e2e/dashboard.spec.ts`, "live: an admin seat correction reaches an open
    dashboard within 20 s without reload", on Kerala 2021).

## 3. Known gaps and risks

1. **Simulation built before the reseed and the redesign.**
   - The simulation was written on 2026-10-03, against Bihar 2025 as it was then.
   - The dashboard has changed since: regions layer, picker, lineage.
   - `sim:smoke` checks the API, not what a viewer sees.
2. **No viewer-level checks of the live states:**
   - before the first result (Live, 0 declared);
   - leading/trailing mid-count, with partial rounds;
   - each seat state (declared, countermanded, adjourned, held after a correction);
   - the map colouring leads vs wins, and alliance tallies "leading + won" against the majority line;
   - the ticker and stats strip;
   - seat and person pages during counting;
   - the switch to Finalized;
   - the picker pinning Live elections.
   - Check all of this on phones, in dark mode, on a slow network, in a background tab, and across a Render
     restart.
3. **The real ECI adapter is untested against this year's pages.**
   - ECI changes its results site between elections.
   - Archived copies of a finished site (Wayback, e.g. `ResultAcGenMay2026`, `AcResultGenOct2024`) can test parsing
     of final pages, but not mid-count pages.
   - The 2027 site URL and state codes are known only near the date.
4. **Scale is unproven.**
   - The design depends on the CDN answering the polls (origin load must not grow with viewers).
   - The planned move to **Cloudflare** (domain, Tiered Cache, `s-maxage`) is not done yet (DEPLOYMENT D13).
     Vercel currently serves the frontend, and the API on Render (Free plan) gets requests directly.
   - There is no load test of the polling path and no measured origin request rate.
5. **The admin drills haven't been run on real hosting:**
   - worker failover between cloud and laptop;
   - source switch, correction hold and release, pause and resume, two shards on two machines;
   - the alert webhook.
   - The live worker host (Render background worker or Fly.io in Singapore) is not deployed yet.
6. **2027 prerequisites:**
   - the five elections need records: delimitation `'2008'`, map, result date, manifest with alliances and
     majority;
   - candidates must come from ECI's final nominations lists (the roster the worker matches against);
   - party aliases must be set for ECI's spellings.
   - `live:check` must print `READY` for each election.

## 4. Candidate test layers (to agree)

1. **Local end to end, viewer side:** mock ECI + simulation + Playwright on the redesigned dashboard. Step through
   rounds and assert each state in §3.2 (screenshots for review). Refresh the simulation for the current data first.
2. **Adapter against real pages:** `live:check` and parser fixtures from archived ECI result sites (2024, 2026).
   Re-check against the 2027 site as soon as ECI publishes it.
3. **Production-like rehearsal:** the real stack (Render API, Neon, Upstash, CDN) with a fictional Live election.
   Run the worker on its real host and the runbook's T-1 drills. Use a Neon branch or a clearly separate test
   election, and clean up after; production data must not be touched.
4. **Load:** many simulated viewers polling `/live` and `results?v=` through the CDN, ramping to the expected
   counting-day peak. Measure origin requests per second, DB load, p95 latency, and behaviour across a Render
   restart. This needs the Cloudflare move first, or a decision to test through Vercel/Render as they are.
5. **Dress rehearsal:** the full runbook against a replay of a real past counting day, timed like the real one.

## 5. Open questions

- **Where to rehearse:** local only, or a production-like environment (a Neon branch + Render preview/second
  service)? What is the budget for a paid tier during the election window? (Memory: $0 off-season; paying only during
  election windows is acceptable to discuss.)
- **Simulation data:** keep the Bihar 2025 clone, or switch to a 2027-shaped state (e.g. UP 2022: 403 seats, the
  largest load)?
- **Load test:** which tool (k6 / autocannon), what target (peak concurrent viewers, polls per second), run from
  where?
- **When to do the Cloudflare and domain move:** before the load test, and well before February.
- **Mid-count data:** is there a source of real mid-count ECI pages for parser fixtures (Wayback snapshots taken
  during a counting day), or does mock ECI stand in?

## 6. Process when resumed

1. **Brainstorm:** confirm the goal and scope (§4 layers) and answer §5. Bring up the visual companion only if a
   question needs a picture.
2. **Write the test plan** in this folder (`YYYY-MM-DD-live-dashboard-testing-design.md` → plan). Order it so the
   cheapest, most informative layer comes first (layer 1).
3. **Fix what the tests find,** test first. Record findings and decisions in `docs/LIVE_RUNBOOK.md` and
   `docs/FEATURES.md`.
4. **Keep production safe:** a Neon backup before anything touches production; no test elections left behind;
   ingest keys revoked after drills.
