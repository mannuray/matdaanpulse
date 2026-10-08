# Live counting runbook

How to run live results ingest for a counting day. Design: `docs/superpowers/specs/2026-10-03-live-ingest-design.md`. Worker: `scraper/src/live/`. All worker commands run in `scraper/`.

Shorthand: `<id>` is the election id; `API` is the backend base URL (`…/api/v1`).

## 1. T-7 days

1. Election record is complete: `delimitation`, map, result date (Admin -> Elections).
2. Candidates are seeded from ECI's own candidate lists (the roster the worker matches against).
3. Admin -> Ingest keys (SUPER_ADMIN): create `worker-<host>` (the cloud worker) and `laptop` (backup). Each key (`mpk_...`) is shown once; store it in the host's secrets.
4. Live Console -> Feed -> Shards...: add one shard per region if the state is large; otherwise none (the implicit `rest` shard covers every seat).
5. Copy `scraper/live.config.example.json` to `live.config.json`; set `apiBaseUrl`, `holder`, the task's `election` id, and the `eci-web` options (`baseUrl`, `stateCode`, e.g. `https://results.eci.gov.in/ResultAcGenMay2026` / `S25`; `partyAliases` JSON if ECI party names differ from ours). Only the `rest` loop posts the party-wise tally (it is compared against every seat of the election); set `"tally": true` on a task only if a shard's source publishes its own tally.
   Every host needs its own holder name: set `LIVE_HOLDER` (or `holder`) per host, e.g. `cloud-1`, `laptop`. Two hosts with the same holder and key would share one lease.
6. Run until it prints `READY`:
   `INGEST_KEY=mpk_... npm run live:check -- --election <id> --source eci-web` (add `--shard <name>` per shard). `NOT READY` lists what is unmapped or rejected; fix `partyAliases` or the roster. `missing_result_rows` means a candidate has no `results` row (re-run the election's result seed or add the row) — such a seat would never be written.
7. Deploy the worker (see `docs/DEPLOYMENT.md` -> Live worker), left stopped.

## 2. T-1 day

Dry runs against the real ECI site, then drills. Do each drill and confirm the result in the Live Console.

0. Baseline: once the final candidate list is in, compute the election's seat-analysis baseline (admin Constituencies
   → "Compute all analysis", or `POST /admin/constituencies/analysis/compute/<id>`). `npm run live:check` must print
   READY with no `baseline:` line; any later candidate change makes it NOT READY until the baseline is recomputed.
   Going Live recomputes it automatically.
1. Dry run: `npm run live -- --config live.config.json` against ECI with the feed Paused or on a test election; watch lag and rejected seats.
2. Drill (a), failover: stop the cloud worker; the laptop's loop takes the shard lease within 90 s. A running worker renews its lease every 30 s during a cycle and before every chunk, so a slow poll does not lose it; if another job takes the shard, the worker logs `lease lost to <holder>` and stops that cycle.
3. Drill (b), source switch: switch Source to another and back (Apply asks for confirmation on a switch).
4. Drill (c), correction: correct a seat (seat editor) -> it shows "On hold until ..." -> a later round from the source releases it (or press Release in the Holds panel).
5. Drill (d): Pause (Source = Paused) -> Resume.
6. Drill (e): two shards on two machines, each holding its own lease.
7. Set `INGEST_ALERT_WEBHOOK_URL` on the backend and confirm a test alert arrives (an alert is posted once, then again after 15 minutes if it persists).

## 3. Counting day

1. At counting start: Elections -> status Live.
2. Live Console -> Feed -> Source = `eci-web` -> Apply.
3. Start the worker: `npm run live -- --config live.config.json` (env `INGEST_KEY`, `INGEST_API_URL`, `LIVE_HOLDER` — set it, one name per host). Each cycle logs its duration; `WARN slow cycle` (over 60 s) means the shard is too big for one worker: split it into shards.
4. Watch the Feed panel: per shard the job, lease, lag, recent counts, rejected seats and the tally badge. `GET /api/v1/health/ingest` gives counts for monitors (refreshed at most every 10 s, no holder names).
5. Alerts:
   - **Lag**: check ECI is reachable from the worker; if it is down, switch Source (or start the laptop on another source) and Apply. A Live shard with a source that has never posted lags from the moment the feed settings were last applied, so a worker that never started also raises it.
   - **Lease lapsed**: no worker holds the shard; start the laptop worker (it takes the lease within 90 s).
   - **Rejected seats**: a seat stays listed until the source next sends it in a form that is applied or unchanged (the worker re-sends rejected seats every poll). Fix the mapping (`partyAliases` in `live.config.json`, restart the worker) or correct the seat by hand (seat editor; the correction holds the seat, but the rejection stays listed until the source's data is accepted).
   - **Refused (`no_lease` / `inactive_source` ×N in last 5 min)**: a worker is posting without the lease or for the wrong source. `no_lease`: two hosts share a holder name or one lost its lease (check `LIVE_HOLDER`, stop the extra worker). `inactive_source`: a worker still runs the old source after a switch — stop it or switch it.
   - **Tally mismatch**: compare with ECI's party-wise page (the `rest` loop's tally covers the whole election); a mismatch with all seats matching usually means an unmapped party (the worker logs `tally: N unmapped parties`; add `partyAliases`) or a held seat.
6. Held seats show in the Holds panel; Release returns them to the feed.

## 4. After

1. Every seat is declared and the tally matches ECI.
2. Elections -> Finalize.
3. Stop workers (`Ctrl-C` releases the leases). Set Source = Paused.
4. Admin -> Ingest keys: revoke the keys.
5. Review manual corrections in Audit logs and note them. A correction after Finalize needs Elections -> Reopen for corrections (SUPER_ADMIN), then Finalize again.

## 5. Simulation

Practice without ECI: clones Bihar 2025 into a fictional Live election and replays it through the same ingest API.

1. `npm run sim:mock-eci` (mock ECI server on 4444).
2. `npm run sim:setup` (prints `SIM_INGEST_KEY`, writes `scraper/.sim-ingest-key`, sets the feed source to `mock-eci`).
3. Set the simulated election to Live (psql: `UPDATE elections SET status='Live' WHERE ...`).
4. `npm run sim:live` (the worker with the `mock-eci` adapter).
5. `npm run sim:replay` advances the rounds (`ROUND_DELAY_MS` sets the pace).
6. Or `npm run sim:smoke`, an automated end-to-end check; it needs a clean state: `sim:cleanup` -> `sim:setup` -> Live.
7. `npm run sim:cleanup` when done.

`sim:mock-eci` and the sim scripts read `DATABASE_URL` from the environment: run them with the root `.env` loaded
(`set -a && . ../.env && set +a`). The simulation election copies its source's `delimitation`, so it has comparable
history and a baseline (compute it with the admin compute endpoint once it is set up).

### Viewer e2e (layer 1): `npm run e2e:live`

An automated counting day seen by a viewer. Run it before every release that touches the live path, and weekly from
January 2027.

1. Postgres up; backend on :3082 started with `THROTTLE_PUBLIC_PER_MIN=100000` (e.g.
   `cd backend && THROTTLE_PUBLIC_PER_MIN=100000 npm run start`); frontend on :3080; admin credentials in `.env`
   (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) or `E2E_ADMIN_TOKEN`. Nothing may listen on :4444.
2. `cd frontend && npm run e2e:live` (about 5 minutes). It clones the sim election, sets it Live (baseline computed),
   starts the mock ECI and the worker, plays the 24 rounds and checks the dashboard against the backend snapshot at
   each checkpoint: before results, first leads, mid-count (too close, Battle, pulse, seat dialog, person page),
   countermanded / adjourned / held seats under their holds and released by the next round, partial declarations
   (standings, key leaders, constituency pages), all declared, Finalized (picker). Then a phone pass and a light-theme
   screenshot. It cleans up after itself; `KEEP_SIM=1` keeps the sim election.
3. Review the screenshots in `frontend/e2e/artifacts/live/` (mock and worker logs are next to them). The checks prove
   the numbers; the screenshots are for what checks cannot see (clipping, contrast, layout).

It refuses a non-local `DATABASE_URL`. Spec: `docs/superpowers/specs/2026-10-08-live-e2e-layer1-design.md`.

### Live map checks (simulation)

With a replay running (`ROUND_DELAY_MS=10000`–`15000`), check on the dashboard:
- **Overview:** solid / medium / faint-dashed seats, legend counts, and the "Too close · N" chip filtering the map;
- **Battle:** momentum colours, "N lead changes so far" and the chips;
- **Pulse:** violet on lead switches, red on upsets;
- **Seat dialog** on a narrowing seat: badges, the margin chart growing per round, the narrowed line;
- **Mobile** at 390×844: the legend wraps;
- **Light theme.**

Once every seat is declared, the map returns to the ordinary results look. A tab left in the background pauses
polling, so reload or refocus it before judging.

### Call thresholds (provisional)

The live analysis labels each counting seat `safe` / `likely` / `too_close` by lead ÷ estimated remaining votes
(`CALL_THRESHOLDS` in `backend/src/common/seat-analysis/live.ts`: too close below 0.05, likely below 0.2). Tuned on
2026-10-07 on a simulation run (`sim:smoke`, Bihar 2025 replayed in 24 synthetic rounds), with
`npx ts-node src/simulation/tune-calls.ts`:

| Label | Points | Flip rate (leader at that point ≠ final winner) |
|---|---|---|
| safe | 1,341 | 0.00% |
| likely | 1,353 | 0.00% |
| too_close | 1,630 | 6.01% |

The simulation splits a real final result into synthetic rounds, so leads rarely reverse. Re-check the thresholds
against real mid-count data as soon as there is some (the script works on any election's `seat_rounds`:
`--election <id>`).
