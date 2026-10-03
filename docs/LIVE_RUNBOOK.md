# Live counting runbook

How to run live results ingest for a counting day. Design: `docs/superpowers/specs/2026-10-03-live-ingest-design.md`. Worker: `scraper/src/live/`. All worker commands run in `scraper/`.

Shorthand: `<id>` is the election id; `API` is the backend base URL (`…/api/v1`).

## 1. T-7 days

1. Election record is complete: `delimitation`, map, result date (Admin -> Elections).
2. Candidates are seeded from ECI's own candidate lists (the roster the worker matches against).
3. Admin -> Ingest keys (SUPER_ADMIN): create `worker-<host>` (the cloud worker) and `laptop` (backup). Each key (`mpk_...`) is shown once; store it in the host's secrets.
4. Live Console -> Feed -> Shards...: add one shard per region if the state is large; otherwise none (the implicit `rest` shard covers every seat).
5. Copy `scraper/live.config.example.json` to `live.config.json`; set `apiBaseUrl`, `holder`, the task's `election` id, and the `eci-web` options (`baseUrl`, `stateCode`, e.g. `https://results.eci.gov.in/ResultAcGenMay2026` / `S25`; `partyAliases` JSON if ECI party names differ from ours).
6. Run until it prints `READY`:
   `INGEST_KEY=mpk_... npm run live:check -- --election <id> --source eci-web` (add `--shard <name>` per shard). `NOT READY` lists what is unmapped; fix `partyAliases` or the roster.
7. Deploy the worker (see `docs/DEPLOYMENT.md` -> Live worker), left stopped.

## 2. T-1 day

Dry runs against the real ECI site, then drills. Do each drill and confirm the result in the Live Console.

1. Dry run: `npm run live -- --config live.config.json` against ECI with the feed Paused or on a test election; watch lag and rejected seats.
2. Drill (a), failover: stop the cloud worker; the laptop's loop takes the shard lease within 90 s.
3. Drill (b), source switch: switch Source to another and back (Apply asks for confirmation on a switch).
4. Drill (c), correction: correct a seat (seat editor) -> it shows "On hold until ..." -> a later round from the source releases it (or press Release in the Holds panel).
5. Drill (d): Pause (Source = Paused) -> Resume.
6. Drill (e): two shards on two machines, each holding its own lease.
7. Set `INGEST_ALERT_WEBHOOK_URL` on the backend and confirm a test alert arrives (an alert is posted once, then again after 15 minutes if it persists).

## 3. Counting day

1. At counting start: Elections -> status Live.
2. Live Console -> Feed -> Source = `eci-web` -> Apply.
3. Start the worker: `npm run live -- --config live.config.json` (env `INGEST_KEY`, `INGEST_API_URL`, `LIVE_HOLDER`).
4. Watch the Feed panel: per shard the job, lease, lag, recent counts, rejected seats and the tally badge. `GET /api/v1/health/ingest` gives the same for monitors.
5. Alerts:
   - **Lag**: check ECI is reachable from the worker; if it is down, switch Source (or start the laptop on another source) and Apply.
   - **Lease lapsed**: no worker holds the shard; start the laptop worker (it takes the lease within 90 s).
   - **Rejected seats**: fix the mapping (`partyAliases` in `live.config.json`, restart the worker) or correct the seat by hand (seat editor; the correction holds the seat).
   - **Tally mismatch**: compare with ECI's party-wise page; a mismatch with all seats matching usually means a mapped party or a held seat.
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
