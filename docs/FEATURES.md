# Feature Tracker

## Completed

### Core Infrastructure
- [x] Express API with PostgreSQL backend
- [x] React + Vite frontend with TypeScript
- [x] Admin panel for election/candidate/result management
  - Client-side session expiry (expired JWT logs the user out)
  - Routes and sidebar nav gated by role
- [x] Admin candidate drill-down: election → constituency → candidates (replaces flat list)
- [x] Constituencies API: `GET /constituencies?election_id=UUID`
- [x] Candidate search API: `GET /candidates/search?q=name` (cross-election name search)
- [x] Candidate filtering: `GET /candidates?election_id=UUID&const_id=STR`
- [x] Person linking: admin UI suggests same-name candidates across elections, links via `person_id`
- [x] Person bio columns: `photo_url`, `gender`, `education`, `date_of_birth` on `persons` table — stable bio data shared across elections, editable from admin candidate form
- [x] Auto-link endpoint: `POST /admin/candidates/auto-link` (batch name+constituency matching)
- [x] Persons list page: `/persons` — browse all persons with candidate count, photo filter, name search
- [x] Person detail page: `/persons/:id` — edit bio, view election history, merge duplicates (SUPER_ADMIN)
- [x] Candidate filters: filter by linked/unlinked in candidate table (AI enriched/not enriched filters removed 2026-09-30)
- [x] Clickable person ID in candidate table → navigates to person detail page
- [x] Regions table: `regions` (state_id, name, code) with Bihar's 9 regions seeded
- [x] Person state/region tagging: `state_id` + `region_id` on `persons`, filterable via `GET /admin/persons?state_id=&region_id=`
- [x] Bihar person-region seed: 382 persons tagged by constituency→region mapping
- [x] SSE (Server-Sent Events) for the **admin** Live Console (`/admin/live/updates`, token-gated) with Redis pub/sub backend (public viewers poll instead — see "CDN-ready live" below)
  - Named events: `result-update`, `batch-update`, `ping` (`enrichment-progress` removed with the built-in AI)
- [x] i18n support via react-i18next — chosen language persisted in `localStorage` (`lang`)
- [x] Dark mode theming (including the map)

### Interactive Map
- [x] D3 choropleth with 543 Lok Sabha constituencies
- [x] State boundaries (merged from PC geometries)
- [x] Zoom + pan with scroll/drag
- [x] Tooltips on hover (candidate, party, margin)
- [x] Click to open constituency modal
- [x] Party color fills from election results
- [x] Filter layers: Live / Swing / Demographic
- [x] Reset zoom button
- [x] Pulse animation on recent lead changes (fires only when the seat's leader changes)
- [x] Live elections update the map, scoreboard and standings together from one polled snapshot (the SSE overlay and its 4 s debounced refresh were removed — pipeline review M5/M8/M9)

### Constituency Labels (Zoom-Responsive)
- [x] Text labels appear progressively by zoom level as user zooms in (Overview tab only)
- [x] Area-based threshold: hidden < 1500px², abbreviated 1500–4000px², full name > 4000px²
- [x] Abbreviation: first word if short, else first 3 chars + "."
- [x] Labels recalculate on zoom end for performance
- [x] Text outline (paint-order: stroke) for readability over any party color

### Map Tabs: Overview + Battle
- [x] Tab bar replacing old filter chips (Overview | Battle)
- [x] **Overview tab:** All constituencies colored by winning party (solid color)
- [x] **Battle tab:** Alliance chips (NDA, INDIA, Others) — toggle on/off
- [x] **Battle tab:** Party dropdown with search — add individual parties
- [x] **Battle tab:** Selected seats show party color with margin shading (white blend)
- [x] **Battle tab:** Unselected seats gray (#d4d4d4)
- [x] **Battle tab:** 5-tier margin legend (< 5K, 5–25K, 25–75K, 75–200K, 200K+)
- [x] Zoom level preserved across tab switches

### Alliance Tally
- [x] Stacked bar showing alliance seat counts
- [x] Majority mark indicator
- [x] Expandable alliance groups showing member parties
- [x] Add/remove tracked alliances and parties
- [x] Vote share percentages

### Dashboard
- [x] Election header with status badge + share buttons
- [x] Grid layout: map + tally/watchlist sidebar
- [x] Constituency quick-view modal
- [x] Full constituency detail page (navigate from modal)

### Enriched Constituency Detail
- [x] State name displayed in modal and detail page (via state_id FK)
- [x] Phase number (1-7) for 2024 Lok Sabha
- [x] Total electors (registered voters) per constituency
- [x] Total votes polled (computed from candidate results)
- [x] Voter turnout with progress bar
- [x] Vote share percentage per candidate in CandidateCard
- [x] NOTA as a party with candidates and results per constituency
- [x] Insight badges in constituency modal: flip status, spoiler impact, seat classification
  - Flip badge: "Flipped: MGB → NDA" with colored dots, or "Retained" gray chip
  - Spoiler badge: amber chip showing spoiler party votes vs winner margin
  - Seat type badge: two-way / three-way / multi-cornered classification

### Seat Vulnerability Shading (Party Standings Bar)
- [x] Stacked bar segments shaded by margin buckets (lighter = thinner margin, darker = safer)
- [x] LS buckets: <5K, 5–25K, 25–75K, 75–200K, 200K+; VS buckets: <1K, 1–5K, 5–15K, 15–50K, 50K+
- [x] Vulnerability insight label below bar (e.g. "NDA: 8 seats won by <5K")
- [x] Danger label when thin-margin flips could change majority
- [x] Graceful fallback to solid bar when region data unavailable

### Watchlist
- [x] VIP seats / leaders / cabinet tracking
- [x] Live result status for watched constituencies

### Map Tab: Demographics (SC/ST)
- [x] Third map tab "SC/ST" showing seat reservation categories
- [x] Color coding: SC (cyan #0891b2), ST (green #059669), GEN (gray #6b7280)
- [x] Legend with category names and seat counts (84 SC, 47 ST, 412 GEN)
- [x] Alliance/party chip filtering: select to see only their seats colored by category
- [x] Fixed SC/ST seat data in seed.sql using 2008 Delimitation Order (131 reserved seats)
- [x] Updated GeoJSON pc_category for all 543 constituencies
- [x] Backend returns `const_type` field in results API

### Map Tab: States (Mini-Map Drill-Down)
- [x] Fourth map tab "States" for state-level drill-down
- [x] State chip selector showing all 36 states/UTs with PC counts, sorted by size
- [x] Stacked scrollable mini-maps: each selected state rendered as its own zoomed-in D3 map
- [x] Auto-zoom via `d3.geoMercator().fitSize()` per state
- [x] Constituency coloring by winning party (same as Overview)
- [x] Tooltips on hover, click opens constituency modal
- [x] Per-state header with party-wise seat summary (top 5 parties)
- [x] Main SVG hidden in States tab, preserved for other tabs (no re-render)

### State Assembly Election Support (Bihar VS 2025)
- [x] ECI scraper for Vidhan Sabha results (`scraper/src/adapters/eci-vs-adapter.ts`)
- [x] Seed generator script (`scraper/src/generate-bihar-vs-seed.ts`)
- [x] Bihar AC GeoJSON with 243 assembly constituencies (`frontend/public/geo/bihar_ac.geojson`)
- [x] Seed SQL with 243 constituencies, ~1458 candidates, alliance manifest (`database/seed_bihar_vs_2025.sql`)
- [x] Dynamic GeoJSON loading: map URL from election manifest `geo.map_url`
- [x] Dynamic projection: `fitSize()` for state-level maps, India defaults for LS
- [x] Generalized GeoJSON properties: supports both `pc_name`/`pc_category` (LS) and `ac_name`/`ac_category` (VS)
- [x] VS-specific margin buckets (< 1K, 1–5K, 5–15K, 15–50K, 50K+)
- [x] VS region lookup: strips `VS_` prefix from `BR_VS_PATNA_SAHIB` to match GeoJSON `ac_name`
- [x] States tab hidden for VS elections (single-state map)
- [x] Dashboard passes `geoConfig` and `electionType` to InteractiveMap
- [x] NDA (202 seats: BJP 89, JDU 85, LJPRV 19, HAMS 5, RLM 4) vs MGB (35 seats)

### Two-Level VS Election Selector
- [x] State dropdown first, then election dropdown (replaces flat VS election list)
- [x] All states shown alphabetically with election count badge: "Bihar (4)"
- [x] States with 0 elections disabled and dimmed
- [x] Election dropdown sorted by year descending (newest first)
- [x] URL navigation auto-syncs state selection (navigating to `/election/{vs_id}` selects correct state)
- [x] LS tab unchanged (single dropdown)
- [x] `selectedStateId` + `setSelectedStateId` added to `ElectionContext`

### Election Summary Stats Card
- [x] Sidebar card below Watchlist with election analytics computed from results
- [x] Quick stats row: seats declared (counts `WON` status only), average margin, median margin
- [x] Margin distribution histogram (CSS bars) with LS/VS-specific buckets
- [x] Closest Battles: 10 narrowest-margin seats (collapsible)
- [x] Biggest Mandates: 5 largest-margin seats (collapsible)
- [x] Party-wise reserved seats (SC/ST breakdown) table (collapsible)
- [x] All data derived from existing `mapRegions` — no new API calls

### Bihar VS 2020 Historical Data
- [x] Seed generator (`scraper/src/generate-bihar-vs-2020-seed.ts`) with 243 constituencies
- [x] Seed SQL (`database/seed_bihar_vs_2020.sql`) — winner + runner-up per constituency, synthetic votes
- [x] Election ID: `b2c3d4e5-f6a7-8901-bcde-123456789020`
- [x] 2020 NDA alliance: BJP, JDU, LJP, HAMS; MGB: RJD, INC, CPI, CPIM, CPIML
- [x] Bihar 2025 manifest updated with `compare_with` pointing to 2020

### West Bengal VS Historical Data (2011, 2016, 2021)
- [x] Seed generator (`scraper/src/generate-wb-vs-seeds.ts`) — single script for all 3 years, reads JSON + GeoJSON
- [x] GeoJSON: `frontend/public/geo/wb_ac.geojson` (294 ACs with `ac_name`, `ac_no`, `ac_category`)
- [x] Party SQL (`database/seed_wb_parties.sql`) — 8 new parties: SUCI, GJM, GNLF, JKP, JKPN, DSPP, RSMP, RCPIR
- [x] **WB VS 2011** (`database/seed_wb_vs_2011.sql`) — 294 seats, real vote counts
  - Election ID: `d4e5f6a7-b8c9-0123-def0-345678901011`
  - Alliances: TMCALL (TMC+INC) vs Left Front (CPIM, CPI, AIFB, RSP, DSPP, SP)
- [x] **WB VS 2016** (`database/seed_wb_vs_2016.sql`) — 294 seats, real vote counts
  - Election ID: `d4e5f6a7-b8c9-0123-def0-345678901016`
  - Alliances: TMC (solo) vs Left+Congress (CPIM, INC, RSP, AIFB, CPI) vs NDA (BJP)
  - `compare_with` → 2011
- [x] **WB VS 2021** (`database/seed_wb_vs_2021.sql`) — 294 seats, full candidate list with real votes (no NOTA; losers' `margin` is 0)
  - Election ID: `d4e5f6a7-b8c9-0123-def0-345678901021`
  - Alliances: TMC (solo) vs NDA (BJP) vs Sanjukta Morcha (CPIM, INC, RSMP)
  - `compare_with` → 2016, `history` → [2011, 2016]
- [x] Name normalization: 17 JSON→GeoJSON mismatches resolved via `ac_no` lookup
- [x] Party mapping: AITC→TMC, CPM→CPIM, GOJAM→GJM, NIC→INC (data error), DCP(PC)/DSP(P)→DSPP

### Swing Analysis (Map Tab + Summary)
- [x] New map tab "Swing" — visible when `manifest.compare_with` has a previous election
- [x] Fetches previous election results client-side via `getResults(prevElectionId)`
- [x] Swing computation: per-constituency current vs previous winner, flipped detection
- [x] Map coloring: flipped seats in winner's color, held seats in gray
- [x] Alliance/party chip filtering on swing tab
- [x] Swing legend (Flipped / Held)
- [x] Footer shows flipped seat count
- [x] ElectionSummary "Swing" section: flipped seats table, net swing by alliance (gained/lost/net)

### Live Infrastructure (Redis Pub/Sub → SSE)
- [x] `RedisModule` with `RedisService` — dual ioredis clients (pub + sub) for Redis pub/sub
- [x] `LiveService` — publishes `result-update` and `tally-update` events to Redis channels
- [x] SSE endpoint `/api/v1/admin/live/updates?election_id=...&token=...` (admin only, see CDN-ready live) streams Redis events to the Live Console
- [x] 20s heartbeat ping to keep SSE connections alive; each connection's first frame carries `retry: 5000` (shared helper `backend/src/common/sse/shared-sse-stream.ts`; the live results stream is the only SSE endpoint)
- [x] Streams end cleanly on shutdown (SIGTERM) before the HTTP server closes
- [x] Admin `overrideResult()` auto-publishes `result-update` via `LiveService`
- [x] Channel naming: `election:{electionId}:events`

### CDN-ready live (viewer polling + versioned snapshots) — docs/DEPLOYMENT.md §2.2
- [x] Migration 015: `election_live_state(election_id, version, updated_at)`; statement-level triggers on `results` (insert/update/delete), `candidates` and `parties` (update) bump a monotonic per-election version inside the writing transaction — every writer (API overrides, simulation SQL, seeds, admin edits) moves it. Value = `GREATEST(version + 1, now in epoch ms)`, so a rebuilt DB never reuses a version a CDN may hold
- [x] `GET /api/v1/elections/:id/live` → `{ version, status, updatedAt, declared, total }`, `Cache-Control: public, max-age=0, s-maxage=5, stale-while-revalidate=10` while `Live` (`s-maxage=30` otherwise) (in-process 1 s memo + single-flight)
- [x] `GET /api/v1/elections/:id/results?v=<version>` → snapshot `{ version, results, summary, voteShare }` (the three lists from one query): current version `public, max-age=31536000, immutable`; older → `302` to the current version URL (`s-maxage=5`); newer (race) → current data, `no-store`. Without `v`: the unchanged rows array, `s-maxage=10, stale-while-revalidate=30`
- [x] Cache headers: `@CacheControl()` opt-in per controller (public GETs `s-maxage=60, stale-while-revalidate=300`); everything else and every error `no-store`
- [x] Success bodies no longer carry `requestId`/`timestamp` (headers `X-Request-ID` + `Date`; error bodies keep `requestId`) — identical data gives identical bytes/ETags
- [x] `CacheService.getOrSet` single-flight (concurrent misses of a key share one Redis read + one DB load); an invalidation during a load skips its write-back
- [x] Overrides: commit (trigger bumps version) → forget live memo → purge caches → publish admin SSE
- [x] CORS: public GET/HEAD answer `Access-Control-Allow-Origin: *` (CDN caches one copy for all sites); `Retry-After` and `X-Request-ID` exposed; preflights cached 2 h; 429s carry a standard `Retry-After`
- [x] `TRUST_CF_CONNECTING_IP=true`: client IP from Cloudflare's `CF-Connecting-IP` (only when the origin accepts Cloudflare traffic only)
- [x] Frontend poller (`frontend/src/model/live/poller.ts`, used by `useLiveSnapshot`): `/live` every 10 s + 0–3 s, paused while the tab is hidden and polled at once when visible; on a version change wait 0–2 s then fetch `results?v=`; exponential backoff with jitter (max 60 s) honouring `Retry-After`. Live elections only (status `Live` at page load). Ticker and map pulses come from diffing consecutive snapshots. GETs send no `Content-Type` (no CORS preflight)
- [x] Fix round 1 (review task-5): triggers bump only on snapshot-column changes (+ `constituencies.type`), deadlock-safe ordering, one-transaction `CREATE OR REPLACE TRIGGER` migration; snapshot version + rows read in one REPEATABLE READ transaction; summary / vote share / full results Redis keys carry the live version (direct-SQL writes need no purge); per-election cache invalidation (other elections' single-flight/write-back unaffected); `/live` carries `status` (poller: Upcoming 60 s `/live` only → Live 10 s with snapshots → Finalized final snapshot then stop; Upcoming pages poll from 3 days before `tentative_next_date`); forward-only poller; live dashboard error + Retry after 3 failures; `Authorization` requests `no-store` and admin GETs add `_=`; `X-RateLimit-*` dropped from cacheable responses
- [x] Admin live SSE moved to `GET /api/v1/admin/live/updates?election_id=&token=` — a 5-min single-election token from `POST /admin/live/sse-token` (SUPER_ADMIN/EDITOR; never accepted as a Bearer credential; redacted in logs), strict CORS allowlist, ≤ `SSE_MAX_CONNECTIONS` (200) per process else 503; the Live Console fetches a fresh token per (re)connect and reloads after a reconnect. The old public `/live/updates` is gone
- [x] Origin shield: `ORIGIN_SHARED_SECRETS` (rotatable list) → every request except `GET/HEAD /api/v1/health/live` needs `X-Origin-Secret` (set by a Cloudflare Transform Rule; constant-time compare; stripped before logging) else 403 `no-store`; `TRUST_CF_CONNECTING_IP=true` refuses to start without it
- [x] Load test: `cd scraper && npm run loadtest:viewers -- --viewers N --duration S [--base URL]` simulates viewers with the same algorithm and prints origin request counts from `/admin/status` before/after (DEPLOYMENT §5.6)
- [x] Final fix round: the public election DTOs expose `tentative_next_date` (HTTP-tested), so the poller's "Upcoming pages poll from 3 days before `tentative_next_date`; a far date stops polling" rule works against the real API; uptime monitor split by season (`/health/live` off-season, `/health/ready` in the election window) and a clarified deploy order (shield and CF client IP only after Cloudflare is live) in DEPLOYMENT; Node 24 (`engines`); `_redirects` for both SPAs; health probes excluded from System status counters and logged at debug; origin-shield 403s counted (`http.shieldRejected403`); the cache purge no longer deletes content-addressed snapshot keys; SSE slot release is idempotent and covers handler failure / early client abort; notifier never throws; `parseManifest` accepts objects only; `REQUIRE_DB_TESTS=1` makes the migration-015 trigger tests fail without a database (covering results INSERT/DELETE/UPDATE, candidate name, constituency type, party name/colour); `.env.example` has no default OTLP endpoint

### OpenTelemetry Observability (SigNoz)
- [x] OTLP SDK bootstrap (`backend/src/tracing.ts`) — loaded before NestJS, OTLP/HTTP export (port 4318); starts only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set and `OTEL_SDK_DISABLED` is not `true`
- [x] Instrumentation limited to HTTP, Express, ioredis and Prisma spans; W3C trace context only (no Jaeger propagator)
- [x] Log lines carry `requestId` and the OTel `trace_id`; `LOG_LEVEL` env (default `info`); 5xx errors logged with stack and recorded on the active span
- [x] `MetricsModule` (global) with `MetricsService` exposing named OTEL instruments
- [x] `sse.connections.active` — UpDownCounter tracking live SSE clients by election
- [x] `redis.publish.duration` — Histogram for publish latency (ms) by channel
- [x] `live.events.published.total` — Counter for events pushed to Redis
- [x] `redis.publish.errors.total` — Counter for failed Redis publishes
- [x] `live.parse.errors.total` — Counter for JSON parse failures in live stream
- [x] `admin.result.overrides.total` — Counter for admin result overrides by election + status
- [x] `live.streams.active` — ObservableGauge for shared stream count
- [x] OTel Collector config (`otel-collector-config.yaml`) exporting to SigNoz Cloud
- [x] Docker Compose `otel-collector` service (ports 4317/4318)

### Backend Hardening for Deployment (Render / Neon / Upstash)
Source: `docs/reviews/2026-09-30-backend-review.md`, plan `docs/DEPLOYMENT.md` §4.
- [x] Per-IP rate limits behind a proxy: `trust proxy` = `TRUST_PROXY_HOPS` (default 1); named throttlers `public` (600/min, CGNAT-friendly) and `auth` (5/min, `/auth/*`), env-configurable; live SSE and health are never throttled
- [x] Redis via `REDIS_URL` (`rediss://` TLS, Upstash) or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`; boot never waits for Redis
- [x] `CacheService.getOrSet` — a Redis outage falls back to the database instead of failing requests; publish failures after a committed write are logged, not returned
- [x] Cache invalidation after a write never fails the request: on a Redis error it warns and retries once in the background; if that also fails, cached views stay stale until their TTL (5 min; 10 min for analysis); live viewers are unaffected because the trigger-bumped version selects a versioned snapshot key, and the admin Live Console still gets the SSE event
- [x] Live SSE survives Redis blips: the subscriber queues SUBSCRIBE while disconnected and re-subscribes every served channel on reconnect; `/health/ready` is 503 while the subscriber is down
- [x] Health probes: `GET /api/v1/health/live` (no I/O, always 200) and `GET /api/v1/health/ready` (DB + Redis, 2 s timeouts, 503 when degraded, no error text); `/health` = ready
- [x] Graceful shutdown: SSE streams → HTTP server → Redis → Prisma → OTel
- [x] Prisma errors mapped to 409 / 404 / 400 with safe messages; oversized bodies 413
- [x] Body limit 100 kb, 5 MB only on `POST /admin/results/override-bulk` (requests without a Bearer header get 401 before the body is parsed); admin id arrays capped at 2000 so they fit 100 kb
- [x] Query DTOs on list endpoints (bounded `page`/`limit` ≤ 200, enums, UUIDs, ISO dates) — bad input is 400, not 500. Unknown query keys are rejected (400) except the cache-buster `_` (`?_=<timestamp>`), which is accepted and ignored on every route; empty values count as not sent
- [x] URL fields (`photo_url`, `website`, `wikipedia_url`) must be http(s) (validated in the request DTOs)
- [x] Public self-registration (`/auth/register`) off unless `ALLOW_REGISTRATION=true`; the last SUPER_ADMIN cannot be demoted or deleted
- [x] CORS origins trimmed, no credentials (Bearer auth), optional `CORS_ORIGIN_REGEX` for preview URLs
- [x] `X-Request-ID` accepted only if it matches `^[\w-]{1,64}$`; auth logs carry user ids, not emails

### Live Toast Notifications
- [x] New component `LiveToast` (`frontend/src/components/atoms/LiveToast.tsx`)
- [x] Fixed-position bottom-right toast stack (max 5 visible)
- [x] Auto-dismiss after 5 seconds with fade-out animation
- [x] Shows party dot + name + constituency + margin on a leader change or a `WON` declaration (legacy component; the studio dashboard shows live changes in its ticker, derived from snapshot diffs since CDN-ready live)
- [x] CSS: `toast-in` / `toast-out` slide animations

### Head-to-Head Comparator
- [x] Shows in ElectionSummary when exactly 2 alliances/parties selected in Battle mode
- [x] Side-by-side seat count comparison
- [x] Average margin per alliance
- [x] Top 5 closest battles between the two

### Electoral Roll Revision Impact
- [x] SIR revision data in manifest (pre/post elector counts per constituency)
- [x] Constituency modal shows revision card: electorate change, net change, % change
- [x] Impact tier (Low/Moderate/High) comparing net change against winning margin
- [x] Data extracted from ECI Format 4B PDF (Bihar 2025: 243 ACs)

### Insights Tab — Spoiler / Vote-Split Analysis (replaces Turnout)
- [x] Renamed "Turnout" tab to **"Insights"** across map and summary
- [x] Spoiler detection: 3rd-place votes > winner margin AND party matches `vote_splits` manifest config
- [x] Three-way contest detection: 3rd candidate has >15% vote share
- [x] Seat classification: two-way (top 2 ≥ 80%), three-way (3rd ≥ 15%), multi-cornered (3+ above 10%)
- [x] Map coloring: spoiler-affected seats = winner color + hatched SVG pattern, three-way = amber, two-way = gray
- [x] ElectionSummary: quick stats (analyzed, three-way, spoiler-affected), per-spoiler seat tables, seat classification
- [x] Manifest `vote_splits` config: `[{spoiler, hurts, label}]` — Bihar 2025 has AIMIM + BSP splits
- [x] `constCandidates` map (all candidates per constituency) built from existing results, passed to map + summary
- [x] Graceful fallback: elections without full candidate data show "not enough data" message
- [x] Competitiveness gradient fallback when no spoiler data available

### Live Console (Admin — Tabbed Result Override)
- [x] Replaces blind-form Result Override page with tabbed, at-a-glance console (the old `ResultOverride` page has been removed)
- [x] Backend `getLiveResults(electionId)` — returns all results grouped by constituency with `result_id`
- [x] New endpoint `GET /admin/elections/:id/live-results` (SUPER_ADMIN, EDITOR)
- [x] Override role widened from SUPER_ADMIN-only to include EDITOR
- [x] Tabbed view: constituencies split into tabs of ~50 rows (auto-chunked by `const_no` or manifest `live_tabs`, falling back to the published manifest when the draft has none)
- [x] Compact table per tab: `# | Constituency | Leader | Party | Votes | Margin | Status`
- [x] Row colors: green=WON, blue=LEADING, amber=thin margin (<1K), red=stale/no data
- [x] Click row to expand: shows all candidates with inline editable votes/margin/status (override inputs validated client-side before submit)
- [x] Find input: searches by name/ID/number, jumps to correct tab + highlights row
- [x] Stats bar: WON / Leading / Pending counts
- [x] SSE integration: rows flash on live scraper updates, data auto-refreshes
- [x] Election picker: live elections first, then all elections grouped

### Structured Manifest Editor (Admin)
- [x] Two-tab editor: Form (structured sections) and JSON (raw fallback)
- [x] 10 collapsible form sections: Alliances, Leaders, Cabinet, Tracked, VIP Seats, Milestones, Compare & History, Vote Splits, Geo, Live Tabs
- [x] Party multi-select chips with color dots from `getParties()` API
- [x] Constituency dropdowns populated from `getConstituencies(electionId)` API
- [x] Alliance color picker (native `<input type="color">`)
- [x] Election picker for compare_with and history arrays with reorder controls
- [x] Tab sync: Form edits serialize to JSON on tab switch; JSON parses to form (blocks switch on invalid JSON)
- [x] Publish saves pending edits first, so unsaved changes are never dropped
- [x] Revision field shown as read-only count (too large for form editing)
- [x] Types extended: `VoteSplitConfig`, `ManifestData.history`, `history_years`, `vote_splits`, `revision`

### Shared ElectionPicker Component (Admin)
- [x] Extracted `ElectionPicker` component (`admin/src/components/ElectionPicker.tsx`)
- [x] LS/VS toggle with state dropdown cascade (VS only) and election dropdown
- [x] `liveFirst` prop sorts Live-status elections to top of dropdown
- [x] Auto-sync: when `value` changes externally, derives type/state from election object
- [x] States sorted alphabetically with election count badge; 0-election states disabled
- [x] Elections sorted by year descending within each dropdown
- [x] Retrofitted into CandidateManager, LiveConsole, and ManifestEditor (replaced inline/flat dropdowns)

### Constituency Intelligence System (Admin)
- [x] Database migration: `constituency_analysis` table + `constituencies.metadata` JSONB column
- [x] Constituency metadata: manual tags (caste, religion, geography, region) stored as JSONB
- [x] Predefined tag palette with autocomplete (yadav_dominated, muslim_majority, urban, seemanchal, etc.)
- [x] Bulk tagging: multi-select constituencies and add/remove tags in bulk
- [x] Auto-computed analysis: dominance (stronghold/loyal/swing) + incumbency from historical results
  - Reuses same logic as frontend History tab, persisted server-side in `constituency_analysis` table
  - Triggered via "Compute" button, uses `manifest.history` election IDs
- [~] ~~AI enrichment pipeline (constituency briefings, demographics, key issues; candidate/person/party enrichment)~~ — **removed 2026-09-30**, see "Built-in AI and constituency briefing removed" below
- [x] Constituency Manager admin page (`/constituencies`)
  - ElectionPicker + search + tag filter
  - Table with checkbox multi-select, tags as colored chips
  - Expandable row: editable tags, region, incumbency info, demographics
  - Bulk actions: add/remove tags across selected constituencies
  - Compute button: triggers server-side dominance/incumbency analysis
- [x] Admin route `/constituencies` with sidebar nav link
- [x] Backend: `ConstituencyAnalysis` entity, extended `ConstituenciesService`, `AdminConstituenciesController`

### Admin redesign: shell + Live Console (2026-10)
- New shell: grouped sidebar (Counting / Data / Admin), top bar with a global election picker (remembered in `?election=` + localStorage), live-updates pill, health dot (`/health/ready`), keyboard-shortcuts dialog.
- Live Console split view: seat list with Pending / Leading / Won filters, search, and lock indicators. The seat editor has every candidate editable, an auto-calculated margin (leader − runner-up; others = gap to leader), statuses that follow the votes, editable rounds, **Save seat** (one bulk call) and **Declare won**. Keyboard: ↑/↓, Enter, Esc, /. Unsaved seat edits are kept while searching/filtering (the selection is held while the editor is dirty); switching election, a sidebar link, or closing/reloading the tab asks first. Declared seats keep their statuses when votes are corrected, with a warning if the winner is no longer ahead; saving a clean seat sends nothing.
- Seat locks: soft, advisory, held in Redis `lock:seat:{election}:{const}` (TTL 120 s, heartbeat 45 s). Endpoints `GET/POST /admin/live/locks` and `POST /admin/live/locks/release`, SSE `seat-lock`. Take-over is audited (`SEAT_LOCK_TAKEOVER`). With Redis down, locking is disabled and saving still works. A read-only viewer takes the lock as soon as the holder leaves (release event, or a retry every heartbeat after a TTL lapse); the seat list hides locks older than the TTL.
- Styling: Tailwind v4 (utilities only, preflight off) + Radix. The legacy `admin.css` sits in a lower `legacy` cascade layer until Phase 3.

### Admin redesign: entity pages (2026-10, phase 2)
- Candidates (`/candidates`, panel at `/candidates/:id`): one seat of the global election at a time (searchable Seat select, default lowest seat number), All / Linked / Unlinked chips with counts, name search in the seat. The panel holds the affidavit form (age and criminal cases must be whole numbers), the read-only person photo, person linking (search pre-filled with the candidate's name) and the same-name suggestions from other elections with "Link selected". A record of another election offers "Switch election".
- Constituencies (`/constituencies`, panel at `/constituencies/:id`): seats of the global election, 100 per page with a pager; a new search returns to page 1. The district and tag filters are labelled "(this page)" because the API only searches by name. Select-all and the bulk "Add tag" act on the visible rows only, and the selection clears when the page, search, filter or election changes. "Compute all analysis" asks for confirmation. The panel edits demographics (population whole number; literacy, urban and SC/ST % from 0 to 100 with one decimal; 0 is kept as 0, emptied fields are cleared), district, region, seat number (whole number, 1 or more), phase and tags (15 suggested tags plus free text), and shows seat history read-only.
- New candidate (`/candidates/new`): name, party (Independent = the `IND` party row), seat of the global election, affidavit fields. `POST /admin/candidates` checks the seat belongs to the election (404 otherwise) and, in the same transaction, adds the candidate's results row (0 votes, `TRAILING`) so it shows up in the Live Console.

### Party Symbols
- [x] DB: `eci_symbol_url` column on `parties` table (migration 006)
- [x] Admin: party table shows logo + ECI symbol thumbnails, symbol filter dropdown, stats
- [x] Scraper: `scrape-party-symbols.py` — downloads colored logos from Wikipedia + b&w ECI symbols from Wikimedia Commons for 46+ major parties
- [x] Directory: `frontend/public/symbols/logos/` and `symbols/eci/` for scraped SVGs
- [x] `PartyIcon.tsx` simplified: DB `symbol_url` is primary source, hand-drawn SVGs as fallback, no hardcoded `SYMBOL_FILES` set
- [x] `KeyBattlesTicker` supports `party_id` and `party_symbol_url` for proper icon display

### Live Election Simulation System
- [x] Simulation config with shared constants (`scraper/src/simulation/config.ts`)
- [x] Setup script: clones Bihar 2025 → fictional Bihar 2027 Live election (`scraper/src/simulation/setup.ts`)
- [x] Mock ECI HTTP server with per-seat 16–24-round vote progression (staggered starts, every seat declared by global round 24), lead flips, S-curve easing (`scraper/src/simulation/mock-eci-server.ts`)
- [x] Replay orchestrator: advances rounds, scrapes mock, pushes result overrides via admin API (`scraper/src/simulation/replay.ts`)
- [x] Cleanup script: tears down simulation data in FK order (`scraper/src/simulation/cleanup.ts`)
- [x] ECI VS adapter `BASE_URL` made configurable via `ECI_VS_BASE_URL` env var
- [x] Vote progression: `easeInOutCubic` S-curve with ±5% noise, monotonic enforcement, LEADING→WON transitions
- [x] Close-race lead flips in rounds 6-12 for constituencies with < 5% margin
- [x] Mock server generates HTML matching real ECI format (Cheerio-compatible)
- [x] Replay pushes overrides through the admin bulk-override API (admin Live Console via SSE; viewers pick them up by polling the live version)
- [x] Reset script: zeroes results without deleting election structure (`scraper/src/simulation/reset.ts`)
- [x] Round tracking: `round_no` in override API + SSE event, round progress badge in Dashboard header
- [x] Pre-poll constituency modal: candidate list, seat history, dominance, incumbency, revision — all shown before counting
- [x] `normalizeConstId` uses const_no only for VS elections (fixes 18 name spelling mismatches across years)
- [x] Incumbent badge shows "Contesting" before counting, "Retained/Lost" after results
- [x] Candidate table hides vote/share/status columns when no votes yet
- [x] System status (admin, SUPER_ADMIN only): `GET /api/v1/admin/status` + admin page "System status". In-memory counters (single instance, reset on restart, O(1) per request): uptime/version/git sha/memory; HTTP totals by status class, 429 count, 5-min and 60-min request and 5xx rates (per-minute ring buffer), 10 slowest routes by p95 of each route's last ≤200 requests within 60 min (route templates, at most 300 routes tracked); cache hits/misses/Redis fallbacks; Redis pub/sub states and publish counts/errors; SSE connections, events published, result overrides (per min, last at); DB `SELECT 1` latency (2 s timeout) and pool `connection_limit`. No secrets or hostnames in the response, `Cache-Control: no-store`. Works with OTel off; MetricsService call sites feed both OTel and StatusService. Page auto-refreshes every 10 s while visible.

## In progress

### Studio dashboard (redesign, branch `feat/fe-redesign`)
- Non-scrolling dark tile wall (1440×900 / 1280×720) and map-first mobile layout with a swipeable card rail.
- Tiles: top bar, map (layers, Map|Hex when `geo.hex_url` is set), scoreboard (compact ~148px tile), party standings, key leaders, stats + live ticker. Any tile expands to a focus overlay; `?layer=`, `?seat=`, `?focus=` make every view linkable.
- Layer insight lives in a footer bar inside the map tile (chips + expand; headline shown on non-Overview layers, chips double as the map legend on Overview). Map focus view is height-bound (no scroll; seat panel scrolls internally).
- Key leaders strip shows only the manifest leaders that fit its width (as many as fit, no fixed cap) plus a "+N more" chip opening the leaders focus view. The user's own tracked seats live in a Parties / Watchlist tab of the Party standings card (and its focus view); seats are tracked with the `☆ Track` toggle in the seat panel. One shared `watchlist_<electionId>` localStorage list (baseline-compatible key). On mobile the rail has a Watchlist card that opens the standings focus on the Watchlist tab.
- **Summary tab (default) in the side card** (tabs: Summary · <layer> | Parties | Watchlist; the card title follows the tab: Election summary / Party standings / Watchlist). It replaces the old "Election Summary" panel and mirrors it per map layer, in the old order: key stats (Declared, Avg margin, Median) on every layer; Overview: margin distribution, closest battles (10), biggest mandates (5), reserved seats (SC/ST, "–" for 0), vote share vs seats (alliances and parties sections: difference, vote %, seat %), wasted votes (lakh) with the efficiency gap; Battle: margin distribution, seat summary (Seats, Close, Avg), closest contests; Swing: flipped seats (closest 15, total in the header), net swing by alliance; History: seat dominance, dominance by party, swing seats, anti-incumbency, incumbent win rate by party, notable defeats, party switchers, switch directions, notable switchers, margin trend, per-party trend; Reserved: category breakdown, wins by category, average margin by category; Insights: vote split analysis, one table per split, seat classification; States (LS): state leaderboard, sweep states, most competitive states. Margins use the old compact format (950, 21.1K, 1.2L). The card lists every section with every row inside a scroll area (see "Scrollable side-card tabs"); section headers stick to the top while their rows scroll. Rows highlight on the map on hover and lock on click (a single-seat row selects the seat); see "Precise Map Highlighting".
- MVVM: `src/model` (pure), `src/viewmodels` (hooks), `src/views` (Tailwind + Radix); boundaries enforced by `npm run lint`.
- **Summary focus view** (side-card expand, the map footer's expand button, or the mobile "insight" card): every section of the active layer with all its rows (cells in `[value, ...extra]` order under column headers, same number formats as the compact card), key stats as three large numbers, and the charts (margin distribution bar / grouped-by-alliance bar, margin trend and per-party seats line charts, Reserved wins / average margin by category grouped bars per alliance, Overview vote % vs seat % bars per alliance with the seat-minus-vote gap above each pair and an Alliances | Parties toggle; plain SVG with a visually hidden data table and `role="img"`). Layer pills inside the view switch the layer (kept on close). Sections sit in a 2-column grid (1 column below 1024px); only the dialog scrolls. Sections that have a chart also carry plain rows so the compact card can show them.
- **Mobile layout (<1024px, checked at 390x844 and 360x740)**: a single column of top bar, scoreboard, map (takes the remaining height, `flex-1 min-h-0`) and the card rail (fixed height, never shrinks), so nothing overlaps and the page never scrolls. The top bar is one row of at most 56px: app title (truncates), an election chip ("VS · Bihar 2025", built by `useTopBarVM.electionLabel`) that opens a bottom sheet with the LS/VS toggle and state / year (or LS election) pickers, a search icon that opens a top sheet with the focused search box, and a more button that opens a sheet with WhatsApp / X share and the language picker (44px touch targets). The scoreboard uses the short bloc labels (NDA / MGB, full name in `title`/`aria-label`). Rail cards are read-only glances: the Party standings card shows the top four parties (dot, short id, thin bar, seats) plus "+N more parties"; the summary card shows key stats as plain text. Rail card titles are fixed (Party Standings is always "Party Standings"; only the standings focus dialog title follows the Parties / Watchlist tab). Desktop is unchanged.
- Spec: `docs/superpowers/specs/2026-09-29-studio-dashboard-design.md`.

## Known Limitations

- **Live ECI ingestion is not implemented.** The scraper's live pipeline (`scraper/src/index.ts`, `scheduler/`, `adapters/eci-adapter.ts`, `normalizer/`) is placeholder code only. Counting-day flows are exercised end-to-end via the Live Election Simulation System (mock ECI server + replay through the admin bulk-override API); real results today come from the historical seed files.

- **Estimated / incomplete seed data** (audit 2026-10-01; listed publicly on `/about`, source of truth `frontend/src/model/about/about.ts`, update it whenever a seed is corrected):
  - Synthetic votes (runner-up 50,000, winner 50,000 + margin; only margin and names/parties real): Bihar VS 2010/2015/2020, AS/KL/TN VS 2021, PY VS 2021 (winners only, no runner-up).
  - Assam VS 2021: placeholder winner names (`"<PARTY> Candidate"`) and an invented IND "Runner-up".
  - LS 2024: `voter_turnout` / `total_electors` implausible (e.g. Lakshadweep 1,474,599 electors; in 294 seats the votes exceed electors × turnout).
  - SC/ST type is `GEN` for every seat in Bihar VS 2010–2020 and all Assam years.
  - Candidate coverage: all candidates only in WB 2021; top 5 + NOTA in LS 2024 and Bihar 2025; winner + runner-up elsewhere. TN 2016 has 232/234 seats (2 postponed polls). No source recorded for AS/KL/PY.

## Planned

### Delimitation Strategy
Only compare elections within the **same delimitation era** — boundaries change across delimitations making per-seat comparison invalid.

| Era | Bihar Elections | Seats | Comparable? |
|-----|----------------|-------|-------------|
| Post-2008 delimitation | **2010, 2015, 2020, 2025** | 243 | Yes — same boundaries, same GeoJSON |
| Pre-2008 delimitation | 2005 and earlier | 243 (different boundaries) | No — ~100+ seats renamed/redrawn |

---

### Priority 1 — No New Data Needed (build now)

| # | Feature | Status | Depends on |
|---|---------|--------|------------|
| 1.1 | Spoiler Analysis (Insights tab) | `DONE` | — |
| 1.2 | Vote Share vs Seats Disparity | `DONE` | — |
| 1.3 | Close Race Fragility Index | `DONE` | — |
| 1.4 | Swingometer (BBC-style) | `TODO` | — |
| 1.5 | Scenario Builder (270toWin-style) | `TODO` | — |

#### 1.1 Spoiler Analysis (Insights tab — replaces Turnout) — DONE
Renamed "Turnout" tab to **"Insights"**. First sub-view: spoiler/vote-split analysis.
- [x] Detect 3-way contests: 3rd candidate has >15% vote share
- [x] Spoiler detection: 3rd place votes > winner's margin AND spoiler party splits a specific alliance's vote
- [x] Manifest config for vote-split definitions (`vote_splits` in ManifestData)
- [x] Map overlay: highlight spoiler-affected seats (hatched SVG pattern)
- [x] Summary: per-spoiler seat tables with margin and spoiler vote counts
- [x] Seat classification: two-way (top 2 have 80%+ combined), three-way, multi-cornered
- [x] Only available for elections with full candidate data (Bihar 2025 has ~6/seat; 2020 only has 2)

#### 1.2 Vote Share vs Seats Disparity — DONE
- [x] Bar chart: vote share % alongside seat share % per party/alliance
- [x] Expose FPTP distortion — disparity shown as "+X.X pp" (green) / "-X.X pp" (red)
- [x] Wasted votes per party (votes in losing constituencies that didn't convert to seats)
- [x] Efficiency gap between alliances

#### 1.3 Close Race Fragility Index — DONE
- [x] Vulnerability shading on alliance tally bars (lighter = thinner margin)
- [x] Insight label: "NDA: 8 seats won by <5K" / "X thin-margin flips would change majority"
- [x] Danger label when flips could change majority outcome

#### 1.4 Swingometer (BBC-style)
- [ ] Slider control: simulate uniform vote share swing between two alliances
- [ ] As user drags, seats flip on the map in real-time based on current margins
- [ ] Seats with smallest margins flip first (ordered by margin)
- [ ] Shows tipping point: "At 3.2% swing, NDA loses majority"
- [ ] Display: running seat tally updating as slider moves + majority line
- [ ] Math: for X% uniform swing, flip all seats where margin < X% of total votes in that seat

#### 1.5 Scenario Builder (270toWin-style)
- [ ] Click any seat on the map to manually flip it to a different party/alliance
- [ ] Running tally updates with each click — majority line shows if threshold crossed
- [ ] Cycle through: current winner → opposition alliance → original (3-click toggle)
- [ ] "Build your own result" mode — shareable as URL with encoded flips
- [ ] Reset button to go back to actual results
- [ ] Use case: journalists, analysts, political discussions ("what if BJP lost these 12 seats?")

---

### Priority 2 — Needs Historical Seeds (2010, 2015)

| # | Feature | Status | Depends on |
|---|---------|--------|------------|
| 2.0 | Seed Bihar VS 2015 + 2010 | `DONE` | — |
| 2.1 | Historical Dominance | `DONE` | — |
| 2.2 | Anti-Incumbency Tracker | `DONE` | — |
| 2.3 | Bellwether Seats | `TODO` | 2.0 (3+ elections) |
| 2.4 | Party Switcher / Defection Tracker | `DONE` | 2.0 |
| 2.5 | Margin Trend Over Time | `DONE` | 2.0 |
| 2.6 | Party Penetration Map | `TODO` | 2.0 (multi-election) |

#### 2.0 Seed Bihar VS 2015 + 2010 — DONE
- [x] Seed **Bihar VS 2015** (`database/seed_bihar_vs_2015.sql`)
- [x] Seed **Bihar VS 2010** (`database/seed_bihar_vs_2010.sql`)
- [x] All use same `bihar_ac.geojson` (post-2008 boundaries)
- [x] `BR_VS{YY}_` constituency ID prefixes (`BR_VS10_`, `BR_VS15_`)

#### 2.1 Historical Dominance — DONE
- [x] Classify seats by multi-election hold: Stronghold (3+ wins), Loyal (2 wins), Swing (no repeat winner)
- [x] Map "History" tab with dominance coloring (full color = stronghold, faded = loyal, amber = swing)
- [x] `manifest.history` array to specify historical election IDs (History data is sourced from `manifest.history`)
- [x] Parallel fetch of all historical results, party-level tracking (not alliance)
- [x] ElectionSummary: dominance quick stats, per-party breakdown, swing seats list

#### 2.2 Anti-Incumbency Tracker — DONE
- [x] Auto-detect incumbents: previous election's winner = incumbent if same person contests again
- [x] No manual tagging — derive from `compare_with` chain (2020 winner → 2025 incumbent)
- [x] Match by candidate name (normalized: uppercase, trim, strip "ALIAS" suffix)
- [x] Stats: incumbent win rate overall + by party, notable incumbent defeats
- [x] Shown in ElectionSummary when History tab is active

#### 2.3 Bellwether Seats
- [ ] Auto-identify seats that historically predict the overall state winner
- [ ] "Whoever wins Patna Sahib has won Bihar in 3 of 4 elections since 2010"
- [ ] Computed: for each seat, check if seat winner's alliance = state winner's alliance across all elections
- [ ] Rank by accuracy (100% = perfect bellwether)
- [ ] Highlight on map, show in summary panel

#### 2.4 Party Switcher / Defection Tracker — DONE
- [x] Match candidate names across consecutive elections (normalized: uppercase, trim, strip ALIAS suffix)
- [x] Detect party switches: "Won on RJD in 2020, now contesting on BJP in 2025"
- [x] Compares all consecutive election pairs (2010→2015, 2015→2020, 2020→2025)
- [x] Quick stats: total switchers, won on new ticket, success rate %
- [x] Direction summary table: "From → To" with count and won (e.g., RJD → BJP: 4 switched, 3 won)
- [x] Notable switchers table: name, parties, year, result, margin
- [x] Constituency modal "Switched" badge: colored dots showing `FromParty (year) → ToParty (year)`
- [x] Manifest `history` updated to include 2010 + 2015 election IDs (was only 2020)
- [x] Manifest `history_years` parallel array added for year labels

#### 2.5 Margin Trend Over Time — DONE
- [x] Track average margin across all 4 elections: 2010→2015→2020→2025
- [x] Horizontal bar chart in ElectionSummary (one row per year, width proportional to avg margin)
- [x] Per-party trend table: parties as rows, years as columns, each cell shows "seats / avg margin"
- [x] Only parties with seats in 2+ elections shown, sorted by latest seat count
- [x] Median margin also computed (available in data, displayed in overall stats)

#### 2.6 Party Penetration Map
- [ ] Map showing where a party **contests** vs where it **wins**
- [ ] Contested = light shade, won = full color, didn't contest = gray
- [ ] Shows geographic expansion/contraction across elections
- [ ] Example: "RJD contested 200 seats but only won in Seemanchal and Magadh"

---

### MyNeta Affidavit Data Scraper
- [x] MyNeta adapter (`scraper/src/adapters/myneta-adapter.ts`) — cheerio scraper for candidate list + detail pages
  - `fetchConstituencyIds(slug)` — scrapes all constituency links from main election page
  - `fetchCandidateList(slug, constituencyId)` — scrapes candidate table (name, party, criminal cases, education, age, assets, liabilities)
  - `fetchCandidateDetail(slug, candidateId)` — scrapes individual affidavit page for detailed data
  - HTML caching in `scraper/src/cache/myneta/` (one file per page, avoids re-fetching)
  - 500ms rate limiting between requests, 3 retries with exponential backoff
- [x] Affidavit seed generator (`scraper/src/generate-affidavit-seed.ts`)
  - Generic CLI: `npx tsx src/generate-affidavit-seed.ts <myneta-slug> <election-id>`
  - DB-connected: queries candidates + person_id, no seed SQL parsing
  - Matches MyNeta candidates by const_no + normalized name, fuzzy fallback (Levenshtein ≤ 3)
  - Outputs `database/seed_affidavit_<slug>.sql`
  - Dual writes: `candidates.metadata.affidavit` (per-election) + `persons.metadata.affidavit_history.<election_id>` (person-level rollup)
  - Match report: exact/fuzzy/unmatched counts, person linking stats
- [x] Affidavit data: criminal cases (count + IPC sections + serious flag), total/movable/immovable assets, liabilities, education, profession, age, source URL
- [x] Data stored in existing JSONB `metadata` columns — no schema changes needed
- [x] Workflow: link candidates to persons (auto-link) → run affidavit scraper → person history builds up across elections

---

### Priority 3 — Needs New Data Collection

| # | Feature | Status | Data needed |
|---|---------|--------|-------------|
| 3.1 | Regional Zone Analysis | `TODO` | Region tags per constituency (~30min curation) |
| 3.2 | Constituency Demographics | `TODO` | Census 2011 religion data + community tagging |
| 3.3 | Exit Poll Accuracy Tracker | `TODO` | Exit poll predictions (manual entry or scrape) |

#### 3.1 Regional Zone Analysis
- [ ] Group constituencies into cultural/political regions (one-time manual tagging)
- [ ] Bihar regions: Seemanchal, Mithilanchal, Magadh, Bhojpur belt, Tirhut, Kosi, Saran, etc.
- [ ] Per-region alliance performance breakdown (seats + vote share)
- [ ] Region selector on map — highlight and zoom to region
- [ ] Cross-election regional trends (with historical seeds)
- [ ] Needs: `region` field on constituencies or a `constituency_regions` mapping table

#### 3.2 Constituency Demographics (Religion & Caste)
- [ ] New table `constituency_demographics`: `const_no`, `state_id`, `muslim_pct`, `sc_pct`, `st_pct`, `dominant_community`, etc.
- [ ] One-time data load per state (updates only per census decade)
- [ ] Data source: Census 2011 district-level religion data, mapped to constituencies via `district_id`
- [ ] Dominant community tagging (manual curation per state — e.g., Yadav-dominated, Jat-dominated)
- [ ] Map layer: shade by religion % or caste group
- [ ] Cross-reference with results: "BJP won X of Y Muslim-majority seats" style insights

#### 3.3 Exit Poll Accuracy Tracker
- [ ] Compare exit poll predictions vs actual results
- [ ] **Per-seat exit polls** (if available): predicted winner vs actual winner, accuracy %
- [ ] **Aggregate exit polls**: predicted seat ranges (e.g., "Axis MyIndia: NDA 180-200") vs actual tally
- [ ] Score each pollster: accuracy %, mean absolute error, seats correctly called
- [ ] Map overlay: green = poll got it right, red = poll got it wrong
- [ ] New table: `exit_polls` with `pollster`, `election_id`, `alliance_id`/`party_id`, `predicted_low`, `predicted_high`
- [ ] **Note:** Scope depends on data availability — per-seat predictions enable rich analysis; aggregate-only reduces to a comparison table

---

### Priority 4 — AI Integration (not planned: no AI inside the app; AI-assisted data is produced offline)

| # | Feature | Status | Depends on |
|---|---------|--------|------------|
| 4.1 | Post-Election AI Analysis | `TODO` | 3.2 (demographics, optional) |
| 4.2 | Real-Time AI Commentary | `TODO` | 4.1 + live election |

#### 4.1 Post-Election Static Analysis
- [ ] Feed constituency data (results + demographics + history) to Claude API
- [ ] Generate per-seat written analysis (stored as text, displayed in constituency modal)
- [ ] Example: "BJP retained this SC seat despite a 3-way contest. AIMIM's 12K votes likely split the MGB vote..."
- [ ] Batch generation after results are final

#### 4.2 Real-Time Live Commentary
- [ ] During live counting, batch SSE updates and feed to Claude API periodically
- [ ] Generate region-level observations: "NDA leading in 15 of 20 Seemanchal seats — significant shift from 2020"
- [ ] Display as a "Live Analysis" feed panel alongside toasts
- [ ] Rate-limited: generate every N result updates or per-region, not per-SSE-event

---

### Admin: Server-Side Party Pagination
- [x] `GET /parties?page=1&limit=25&q=bharat` — paginated + searchable endpoint
- [x] Backward compatible: `GET /parties` (no params) returns full array for frontend symbol cache
- [x] QueryBuilder ILIKE search on name, id, abbreviation
- [x] Admin `PartyManager` uses server-side search (debounced 300ms) + Prev/Next pagination (25/page)
- [x] Symbol filter (has logo / has ECI / missing) stays client-side on the current page

### District & Region Backfill
- [x] Districts and regions seed SQL for Bihar (38 districts, 8 regions) and West Bengal (23 districts, 8 regions)
- [x] Admin constituency table shows District and Region columns
- [x] District filter dropdown in admin constituency manager
- [x] Expanded row shows DB district/region (replaced old metadata text input)
- [x] Backend `findByElectionWithAnalysis` eager-loads `district` and `region` relations
- [x] Documented in `docs/VS_DATA_PIPELINE.md` Step 6 as reusable process for new states

### AI Enrichment Improvements (removed 2026-09-30 — historical)
- [x] `skipEnriched` flag: full-election runs skip already-enriched constituencies (safe re-runs)
- [x] Targeted retry: passing `const_ids` forces re-enrichment regardless of current status
- [x] WB 2021: all 294 constituencies enriched successfully
- [x] Documented in `docs/VS_DATA_PIPELINE.md` Step 7
- [x] Pre-poll vs post-poll enrichment modes (`mode: 'pre_poll' | 'post_poll'`)
  - Auto-detects from election status (Live/Upcoming → pre_poll, Finalized → post_poll)
  - Pre-poll: historical context from `manifest.history` elections, candidate list (no votes), web search for campaign chatter, candidate backgrounds, local issues
  - Post-poll: existing behavior with actual results + outcome analysis
  - Pre-poll prompt explicitly tells AI "election has NOT happened yet" — no fabricated results
  - Historical results matched across elections via const_no (handles spelling variations)
  - `ai_status` set to `'pre_poll'` or `'generated'` to track which mode was used
  - Controller accepts optional `mode` in request body to override auto-detection

### Public Analysis API + Backend-Driven Analytics
- [x] Extended `computeAnalysis()` with party switcher detection (cross-election name matching)
- [x] Extended `computeAnalysis()` with spoiler/vote-split detection (from manifest `vote_splits`)
- [x] Public API: `GET /elections/:id/analysis` — lightweight list (dominance, swing, incumbency JSONB)
- [x] Public API: `GET /elections/:id/constituencies/:constId/analysis` — full detail (dominance, incumbency, notes)
- [x] `useAnalysis` hook: transforms backend analysis → frontend data structures (dominance, incumbency, swing, spoiler, seatType, partySwitcher maps)
- [x] Dashboard: prefers backend analysis for finalized elections, falls back to client-side for live
- [x] Seat history timeline in modal (colored party dots per election from backend data)

### Person Profiles (Public Frontend)
- [x] Public API: `GET /candidates/persons/:id` — person bio + cross-election candidate history with results (votes, status, margin)
- [x] Constituency detail API: candidates now include `person_id` + `person { id, photo_url }` via person join
- [x] Frontend types: `PersonSummary`, `PersonCandidate`, `PersonDetail`; `CandidateResult` extended with person fields
- [x] CandidateCard: shows 24×24 circle photo thumbnail when person has photo_url; clickable name navigates to person profile
- [x] CandidateTable + ConstituencyModal + ConstituencyDetail: pass `onPersonClick` through to CandidateCard
- [x] Person detail page (`/person/:id`): full profile (photo, gender, education, DOB, state, district) + election history table with outcomes
- [x] Election history table: year, constituency (linked), party (color dot), votes, status badge, margin — winner rows highlighted

### Admin: Editable District/Region
- [x] `GET /states/:id/regions` endpoint (mirrors existing `/states/:id/districts`)
- [x] `PATCH /admin/constituencies/:id` — update `district_id` and `region_id` on constituencies
- [x] Admin expanded row: district/region shown as editable `<select>` dropdowns (editors/super admins)
- [x] Admin expanded row: demographics as inline inputs (AI briefing / key issues editing removed 2026-09-30)

### Studio Dashboard: Dark / Light Theme
- [x] Two themes only, Dark (default, the studio look) and Light; choice persisted in `localStorage` key `studio_theme` (invalid/missing = dark)
- [x] `viewmodels/theme/useTheme.ts`: shared store (no provider), sets `data-theme` and `color-scheme` on `<html>` so portaled dialogs, sheets and the map tooltip follow; inline script in `index.html` applies it before first paint
- [x] Light tokens in `theme/studio.css` under `:root[data-theme="light"]` (ink/muted/accent/live meet WCAG AA on tile and page); new tokens `on-accent`, `ok`, `ok-text`, `scrim`
- [x] Party colours adapted once in `useDashboardData` via pure `model/derive/themeColor.ts` `forTheme(hex, theme)` (light darkens colours under 3:1 against white, same hue)
- [x] Desktop: sun/moon icon button next to Share; mobile: Theme row (Dark/Light toggle, 44px) in the More sheet
- [x] Legacy pages share the same store (their old `theme` key and system-preference default are gone)
- [x] Mobile: compact logo-mark link when the title is hidden (<370px); map layer tabs scroll with fade edges; tile expand buttons have a 44px hit area

### Studio Dashboard: Scrollable Side-Card Tabs and Restored Charts
- [x] Scrollable side-card tabs (desktop/tablet tile): header and tab pills stay fixed, the active tab body scrolls inside the card (`views/ui/ScrollArea.tsx`: focusable `role="region"` labelled with the tab, thin theme-aware scrollbar `.studio-scroll`, bottom fade into the tile colour while more content is below, scroll reset when the tab or the summary layer changes). The page still never scrolls.
- [x] Summary tab lists all sections and all rows (chart-only sections skipped) with sticky section headers; Parties lists every party; Watchlist scrolls its rows while the "Add seat" picker stays pinned below. The "+N more" footers are gone from the tile (the expand button opens the focus view).
- [x] Mobile rail previews (Standings / Summary / Watchlist) unchanged
- [x] Charts appear only in the expanded summary view. Chart spec extensions: `valueFormat` (int / pct / compact / signed), per-point `color`, series `opacity`, group `annotations` (up green, down red, neutral muted; also in the hidden data table). Bar charts with many groups scroll horizontally inside their box (52px per group minimum)
- [x] Reserved: "Wins by category" and "Average margin by category" grouped bars (GEN / SC / ST, one bar per alliance or party, legend "NDA (202)")
- [x] Overview: "Vote share vs seats" paired bars per alliance (vote % faded, seat % full, gap annotated) with an Alliances | Parties pill toggle (parties: top parties by seats)

### Studio Dashboard: Precise Map Highlighting
- [x] One rule: a summary row highlights exactly the seats it names (`SummaryRow.seatIds`); `partyIds` never widen the map highlight (they only label/colour). A row without seatIds is plain text. `deriveLayerSummary` drops seat ids that are not seats of the shown election (history rows can name seats of earlier elections).
- [x] Per-section highlight: margin distribution = the bucket's seats; closest / biggest / flipped / swing seats / incumbent defeats / notable switchers / vote-split seats = that seat; reserved = that party's SC+ST seats; vote share vs seats (alliance, party, "Others") = seats it leads; wasted votes = seats the alliance won (efficiency gap: none); seat summary = the bloc's seats; net swing = seats gained by the bloc; dominance classes / by party = seats in the class / the party's strongholds + loyal seats; switch directions "A → B" = only the seats that switched A to B; party switchers stats = seats of all switchers / of those who won; anti-incumbency = all re-contested seats / seats incumbents won (win rate: none); incumbent win rate and party trend = seats the party leads now; category breakdown = seats of the category; wins / margin by category per bloc = all seats the bloc leads; classification and three-way / spoiler stats = seats in that class; states = the state's seats.
- [x] Scoreboard, party standings, leaders and map-footer chips keep their meaning (bloc or party = all its seats, leader = its seat, chip = its seats) and get the same treatment.
- [x] Map: highlighted seats render at full opacity in the layer colour (whatever the layer's own opacity), with a bright non-scaling ink outline drawn on a top layer (`g.pc-highlight`) so neighbours never cover it; everything else is dimmed. Marked `data-highlighted="true"` on the seat path. No zoom. Both themes.
- [x] Stable hover: a hover clear is delayed 100ms and cancelled by the next hover (shared per store, `viewmodels/store/hoverIntent.ts`), so moving between rows never flashes the whole map. Hover previews over a locked highlight and the lock returns when the hover ends.

### Other
- [ ] Mobile-optimized map controls
- [ ] Export/share map screenshots
- [ ] Real per-seat turnout data from ECI detail pages (if available)

### Built-in AI and constituency briefing removed (2026-09-30)
- [x] No AI inside the app: AI-assisted data is produced offline (Claude Code runs) and loaded like scraped data
- [x] Backend: `modules/ai` (Gemini service, strategies, parsers) deleted with its routes — `POST /admin/constituencies/enrich/:electionId`, `GET /admin/constituencies/enrich/status/:electionId`, `GET /admin/constituencies/enrich/stream/:electionId` (SSE), `POST /admin/constituencies/analysis/bulk-status`, `POST /admin/candidates/enrich/:electionId`, `GET /admin/candidates/enrich/status/:electionId`, `POST /admin/persons/enrich`, `GET /admin/persons/enrich/status`, `POST /admin/parties/:id/enrich`; `GEMINI_API_KEY` / `GEMINI_MODEL` dropped
- [x] Migration `014_drop_ai_columns.sql` drops `constituency_analysis.ai_briefing`, `ai_demographics`, `ai_key_issues`, `ai_generated_at`, `ai_status` (and the `ai_status` index); `dominance`, `dominance_party`, `incumbency`, `notes` stay
- [x] Person `bio` comes from `metadata.bio` only (no `ai_profile` fallback)
- [x] Admin: enrich buttons, enrichment progress stream, AI status picker/column, briefing and key-issues editors, AI candidate filters removed; person bio is now an editable field in the person editor
- [x] Public frontend: briefing removed from the studio seat panel (no analysis fetch on seat select) and the legacy constituency page; community data shows only recorded values (card hidden when none); person biography card hidden when there is no bio (kept when only a Wikipedia link exists)

### API shape: explicit pagination and a clean error body (2026-09-30)
- [x] Backend: `Paginated<T>` / `paginated()` (`common/paginated.ts`); the response interceptor builds `pagination` only for `Paginated` results and wraps everything else verbatim (no more merging of handler objects that contain `success`/`total`); `totalPages` is 1 when `limit` is 0/missing instead of NaN. Persons, parties and constituencies list services return `paginated(...)`; `MapToDtoInterceptor` preserves it.
- [x] Error body: `{ success:false, error:{ code, message, requestId, timestamp, path, fields?, details? } }`; `fields` from class-validator via the global ValidationPipe `exceptionFactory`; `details` only for business exception data; `validationErrors` removed. See `docs/API_SPEC.md`.
- [x] Admin: `ApiError` (code, fields, details, requestId); error toasts list field errors; field messages show under inputs on the user, election, party and person forms. Frontend: `ApiError` parsing. Scraper replay prints the new error message.

### About page and feedback (2026-10-01)
- [x] Public `/about` (`src/pages/About.tsx` → `views/about/AboutView.tsx`, form VM `viewmodels/about/useFeedbackForm.ts`): what MatdaanPulse is, "not an official source" disclaimer with a link to results.eci.gov.in, per-dataset data quality (Real votes / Partly incomplete / Votes estimated, with notes) from `model/about/about.ts`, how live counting works, feedback form, contact email (`CONTACT_EMAIL` in the same file). en/hi/mr/ta.
- [x] Linked from the desktop top bar ("About") and the mobile More sheet; the link passes the current path so feedback records which screen it came from.
- [x] Feedback form: type (bug / wrong data / suggestion / other), message 5–2000 chars, optional email, hidden honeypot field; 429 shows a "try again in a minute" message.
- [x] Backend `POST /api/v1/feedback` (stricter per-IP rate limit, honeypot posts dropped, salted IP hash instead of raw IP), table `feedback` (migration `016_feedback.sql`); admin `GET /admin/feedback`, `PATCH /admin/feedback/:id`, and an admin "Feedback" page with status filter (new / read / resolved).
- [ ] Support page (UPI QR / donations): planned, not started.
- [x] Logo: `logo-mark.png`, favicons and `apple-touch-icon.png` in `frontend/public` and `admin/public`; mark shown in the top bars and admin sidebar.
