# Live readiness: 2027 counting day

**Pick this up when ECI announces the 2027 schedule** (Goa, Uttarakhand, Punjab, Manipur, Uttar Pradesh; counting
expected on 27 Feb 2027). Everything below was agreed or found on 2026-10-08, after the security, scale,
observability and API cleanup work shipped.

Related docs:
- testing handoff: `docs/superpowers/specs/2026-10-07-live-dashboard-testing-notes.md`;
- runbook (T-7, T-1, counting day, simulation): `docs/LIVE_RUNBOOK.md`;
- deployment: `docs/DEPLOYMENT.md`;
- ingest design: `docs/superpowers/specs/2026-10-03-live-ingest-design.md`.

## 1. Where things stand (2026-10-08)

**Production:**
- Render API: Singapore, Free plan, deploys only by CLI.
- Neon and Upstash.
- Frontend and admin on Vercel (`matdaanpulse.vercel.app`, `matdaanpulse-admin.vercel.app`).

**What has shipped:**
- **Live path:** viewers poll `/elections/:id/live`, then immutable `results?v=`. It's CDN-ready: `/live` and
  `/results` skip the throttlers, and a version that isn't ready yet returns 404 `GEN_0006`, which the poller retries.
- **Ingest:** machine keys are scoped to one election and expire (migration 026). Lease takeovers are audited and
  alerted. Failed key checks are rate-limited.
- **Admin auth:** revocable sessions (migration 027, `JWT_TTL` 8 h) and a login lockout.
- **Observability:**
  - flat JSON access log, which is the first middleware;
  - load shedding (`GEN_0005` pool full, `GEN_0009` stream cap) is a warn at most once a minute;
  - readiness returns 503 only when the DB fails (Redis down is 200 `degraded`);
  - tracing is sampled at 5%, but stays off until SigNoz is wired (decision: metrics later, via SigNoz).
- **Search:** typo-tolerant (migration 028, `pg_trgm`).
- **Layer 1 of live testing:** local viewer end to end, `cd frontend && npm run e2e:live`. It passes; rerun it before
  every release that touches the live path.

## 2. Decisions to make first

| # | Question | Options / notes |
|---|---|---|
| D1 | Where to rehearse | Local only, or a production-like copy (a Neon branch plus a second Render service). Production data must never be touched. |
| D2 | Budget for the election window | Off-season target is $0. DEPLOYMENT §3.1 plans Render **Starter** from about 2 weeks before counting until about 3 days after (~$7–10 for the month), plus Neon's paid plan for that month if its compute allowance runs out. |
| D3 | Simulation data | Keep the Bihar 2025 clone, or switch to a 2027-sized state: UP 2022 has 403 seats and is the heaviest load. |
| D4 | Load test | Tool (k6 or autocannon), target (peak concurrent viewers, polls/s), and where to run it from. |
| D5 | Cloudflare and domain move | Must happen before the load test (layer 4) and well before February. See §3.1. |
| D6 | Mid-count ECI pages | Is there a source of real mid-count pages (Wayback snapshots taken during a counting day), or does mock ECI stand in? |

## 3. Setup needed before testing on real hosting

### 3.1 Cloudflare and domain (owner: Mannu)

Follow DEPLOYMENT §5.4: domain `matdaanpulse.in`, Pages, API proxy, Cache Rule, then the origin shield and client
IP steps in order.

**Change the API origin in the CSP in the same change as `VITE_API_BASE_URL`,** or the browser blocks every API
call. It is named in four files:
- `frontend/vercel.json`
- `admin/vercel.json`
- `frontend/public/_headers`
- `admin/public/_headers`

`DEPLOYMENT.md` §5.0d step 6 has the details.

**SEO Function:** set the Pages env `SEO_API_BASE_URL` to the Cloudflare-fronted API before the origin shield goes on
(DEPLOYMENT §5.4 step 2). About a week before counting day (≈ 20 Feb 2027) switch the Cloudflare account to
**Workers Paid** ($5/month) and load-check a few page routes on `matdaanpulse.in`; the free plan's 100k Function
requests/day will not cover counting-day traffic.

### 3.2 Live worker host

The worker (`scraper`, `npm run live`, adapters `eci-web` / `mock-eci`) has no production host yet. The candidates
are a Render background worker or Fly.io in Singapore. The failover drills (cloud ↔ laptop, two shards on two
machines) need it.

### 3.3 Alerts

Set `INGEST_ALERT_WEBHOOK_URL` on Render. Without it, ingest alerts (lag, lost lease, rejected, refused, tally
mismatch, takeover) go nowhere. DEPLOYMENT lists it as optional; treat it as required for the window.

### 3.4 Ingest keys

The keys created before migration 026 still work, but they are tied to no election and never expire.
1. Create one key per 2027 election, with an expiry a few days after counting (Admin → Live Console → Keys).
2. Revoke the old keys.

### 3.5 Neon branch limit

The Neon project is at its branch limit. On 2026-10-08 it refused a backup branch for migration 028. Delete old
branches, including `backup-before-026-027-2026-10-08`, so that:
- each deploy with a migration can take a backup branch (no compute);
- a production-like rehearsal (D1) can use a Neon branch.

### 3.6 Render plan and monitoring

**Render plan:** the Free plan spins down after about 15 minutes idle and has 512 MB RAM, so it cannot carry
counting day. Switch to Starter on the DEPLOYMENT §3.1 schedule, with calendar reminders.

**Uptime monitor:** during the window, monitor `https://api.<domain>/api/v1/health/ready` every 5 minutes. It alerts
only when the DB is down; add a body-keyword alert on `"degraded"` to catch Redis too.

**Logs:**
- Optional: `ACCESS_LOG_SAMPLE=0.1` keeps 10% of successful public reads. Errors, writes and admin calls are always
  logged.
- `LOG_LEVEL` stays `info`.

### 3.7 SigNoz (later, optional before the window)

Metrics and traces are off (`OTEL_SDK_DISABLED=true`). To enable:
- set `OTEL_EXPORTER_OTLP_ENDPOINT` (plus headers);
- unset `OTEL_SDK_DISABLED`;
- tune `OTEL_TRACE_SAMPLE_RATIO` (default 0.05).

Health probes and preflights are never traced.

## 4. 2027 data prerequisites (`docs/SEEDING_PLAYBOOK.md`)

1. **Election records** for the five elections: delimitation `'2008'`, map file (`geo.map_url`), result date, and a
   published manifest with alliances, majority and `government`.
2. **Candidates** from ECI's final nominations lists, which are only available after scrutiny and withdrawal, near
   the date. This is the roster the worker matches against; every candidate is needed, at full depth
   (memory: 2027 full depth).
3. **Party aliases** for ECI's spellings.
4. **Baselines:** computed at T-1 (LIVE_RUNBOOK §2 step 0).
5. **`live:check`:** `cd scraper && npm run live:check` must print `READY` for each election.
6. **About page:** update `frontend/src/model/about/about.ts` when the 2027 data lands.

## 5. Open product item

On a phone, the first screen of a Live election has no Live / declared indicator. This was deferred on 2026-10-08
as a design question. Decide it, and build it if needed, before layer 3.

## 6. Test layers still to do

Layer 1 (local viewer end to end) is done.

| Layer | What | Needs | Pass when |
|---|---|---|---|
| 2. ECI adapter vs real pages | `live:check` plus parser fixtures from archived ECI result sites (2024, 2026: e.g. `AcResultGenOct2024`, `ResultAcGenMay2026`); re-check against the 2027 site as soon as ECI publishes it (URL and state codes appear near the date) | Nothing; can start now | Every archived final page parses; mid-count pages follow D6 |
| 3. Production-like rehearsal | Real stack (Render, Neon, Upstash, CDN) with a fictional Live election; worker on its real host; the runbook's T-1 drills: failover, source switch, correction hold and release, pause/resume, two shards, alert webhook | §3.1–3.5, D1 | Every drill behaves as the runbook says; clean-up leaves production untouched |
| 4. Load | Simulated viewers polling `/live` and `results?v=` through the CDN, ramping to the counting-day peak; measure origin requests/s, DB load, p95, and behaviour across a Render restart | Cloudflare (§3.1), D4 | Origin load stays flat as viewers grow; no 5xx beyond brief `GEN_0005` shedding |
| 5. Dress rehearsal | The full runbook against a replay of a real past counting day, timed like the real one | Layers 3–4 | The team runs counting day end to end without code changes |

Viewer states to check across layers 1, 3 and 5 (testing notes §3.2):
- Live with 0 declared;
- leading/trailing with partial rounds;
- each seat state: declared, countermanded, adjourned, held;
- map leads vs wins, and tallies against the majority line;
- the ticker and stats strip;
- seat and person pages mid-count;
- the switch to Finalized;
- the picker pinning Live elections.

Check them on phones, in dark mode, on a slow network, in a background tab, and across a Render restart.

## 7. Suggested order once the schedule is out

1. **Week 1:**
   - answer D1–D6;
   - start layer 2;
   - delete the old Neon branches (§3.5);
   - set the webhook (§3.3).
2. **Next:**
   - Cloudflare and domain (§3.1), with the CSP change;
   - worker host (§3.2);
   - the phone Live indicator (§5).
3. **Then:**
   - layer 3 (rehearsal), then layer 4 (load).
   - In parallel, seed the 2027 elections as data arrives (§4), with nominations last.
4. **About 2 weeks before counting:**
   - Render Starter, plus Neon's paid plan if needed (§3.6);
   - per-election ingest keys (§3.4);
   - layer 5 (dress rehearsal).
5. **T-7 and T-1:** follow `docs/LIVE_RUNBOOK.md`. No backend deploys on counting day.

## 8. Deploy rules learned on 2026-10-08

- **Frontend/admin and backend deploy separately.** A push to `main` deploys the frontend and admin on Vercel at
  once; the backend deploys only by CLI. When the clients need new backend routes, use this order:
  1. push the branch;
  2. take a Neon backup branch and apply the migrations;
  3. `render deploys create srv-dav07gl9fdbs73aluc2g --commit <branch sha> --wait`;
  4. smoke-test production;
  5. merge to `main` and push.
- **Migrations are idempotent** and are applied before the backend that needs them.
- **Gate every push on the real exit codes** of every suite: backend unit + DB (`REQUIRE_DB_TESTS=1 npx jest
  --runInBand`), frontend vitest/lint/tsc, admin vitest/tsc, scraper, plus `npm run e2e:live` and the party/detail
  e2e for anything on the live path.
- **Right after a Vercel push**, the old build can be served for a few seconds; re-check with a fresh load before
  calling a frontend fix broken.
