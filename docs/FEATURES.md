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
- [x] Candidate filters: filter by linked/unlinked/AI enriched/not enriched in candidate table
- [x] Clickable person ID in candidate table → navigates to person detail page
- [x] Regions table: `regions` (state_id, name, code) with Bihar's 9 regions seeded
- [x] Person state/region tagging: `state_id` + `region_id` on `persons`, filterable via `GET /admin/persons?state_id=&region_id=`
- [x] Bihar person-region seed: 382 persons tagged by constituency→region mapping
- [x] SSE (Server-Sent Events) for live updates with Redis pub/sub backend
  - Named events: `result-update`, `batch-update`, `ping`, `enrichment-progress`
  - Frontend reconnect: fast retries first, then a slow retry every 60s; also reconnects when the browser comes back online or the tab becomes visible
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
- [x] SSE events patch the map instantly; the full data refresh is debounced to 4s after the last event

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
- [x] **WB VS 2021** (`database/seed_wb_vs_2021.sql`) — 294 seats, synthetic votes (margin-only source)
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
- [x] SSE endpoint `/api/v1/live/updates?election_id=...` streams Redis events to browser
- [x] 30s heartbeat ping to keep SSE connections alive
- [x] Admin `overrideResult()` auto-publishes `result-update` via `LiveService`
- [x] Channel naming: `election:{electionId}:events`

### OpenTelemetry Observability (SigNoz)
- [x] OTLP SDK bootstrap (`backend/src/tracing.ts`) — loaded before NestJS, gRPC export to port 4317
- [x] Auto-instrumentation for HTTP, Express, PostgreSQL, ioredis spans (fs disabled)
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

### Live Toast Notifications
- [x] New component `LiveToast` (`frontend/src/components/atoms/LiveToast.tsx`)
- [x] Fixed-position bottom-right toast stack (max 5 visible)
- [x] Auto-dismiss after 5 seconds with fade-out animation
- [x] Shows party dot + name + constituency + margin on SSE `result-update` events — fires only on a leader change or a `WON` declaration
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
- [x] AI enrichment pipeline: Claude API generates constituency briefings, demographics, key issues
  - Sequential processing to respect rate limits
  - Review workflow: pending -> generated -> reviewed -> published
  - Separate endpoint for candidate caste/religion/profile enrichment
- [x] Constituency Manager admin page (`/constituencies`)
  - ElectionPicker + search + tag filter
  - Table with checkbox multi-select, tags as colored chips, AI status indicator
  - Expandable row: editable tags, region, incumbency info, AI briefing, demographics, key issues
  - Bulk actions: add/remove tags across selected constituencies
  - Compute button: triggers server-side dominance/incumbency analysis
  - AI Enrich button (in Constituency Manager): triggers AI enrichment for all/selected constituencies; progress stream is authenticated with an `Authorization: Bearer` header (no token in the URL)
  - AI Candidates button: triggers candidate profile enrichment
  - Review/Approve/Publish workflow for AI-generated content
- [x] Admin route `/constituencies` with sidebar nav link
- [x] Backend: `ConstituencyAnalysis` entity, extended `ConstituenciesService`, `AdminConstituenciesController`, `AiEnrichmentService`, `AiModule`

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
- [x] Replay pushes overrides through existing SSE pipeline (Redis pub/sub → frontend toasts)
- [x] Reset script: zeroes results without deleting election structure (`scraper/src/simulation/reset.ts`)
- [x] Round tracking: `round_no` in override API + SSE event, round progress badge in Dashboard header
- [x] Pre-poll constituency modal: candidate list, seat history, dominance, incumbency, revision — all shown before counting
- [x] AI analysis enabled for Live elections (pre-poll briefings visible in constituency modal)
- [x] `normalizeConstId` uses const_no only for VS elections (fixes 18 name spelling mismatches across years)
- [x] Incumbent badge shows "Contesting" before counting, "Retained/Lost" after results
- [x] Candidate table hides vote/share/status columns when no votes yet

## In progress

### Studio dashboard (redesign, branch `feat/fe-redesign`)
- Non-scrolling dark tile wall (1440×900 / 1280×720) and map-first mobile layout with a swipeable card rail.
- Tiles: top bar, map (layers, Map|Hex when `geo.hex_url` is set), scoreboard (compact ~148px tile), party standings, key leaders, stats + live ticker. Any tile expands to a focus overlay; `?layer=`, `?seat=`, `?focus=` make every view linkable.
- Layer insight lives in a footer bar inside the map tile (chips + expand; headline shown on non-Overview layers, chips double as the map legend on Overview). Map focus view is height-bound (no scroll; seat panel scrolls internally).
- Key leaders strip shows only the manifest leaders that fit its width (as many as fit, no fixed cap) plus a "+N more" chip opening the leaders focus view. The user's own tracked seats live in a Parties / Watchlist tab of the Party standings card (and its focus view); seats are tracked with the `☆ Track` toggle in the seat panel. One shared `watchlist_<electionId>` localStorage list (baseline-compatible key). On mobile the rail has a Watchlist card that opens the standings focus on the Watchlist tab.
- **Summary tab (default) in the side card** (tabs: Summary · <layer> | Parties | Watchlist; the card title follows the tab: Election summary / Party standings / Watchlist). It replaces the old "Election Summary" panel and mirrors it per map layer, in the old order: key stats (Declared, Avg margin, Median) on every layer; Overview: margin distribution, closest battles (10), biggest mandates (5), reserved seats (SC/ST, "–" for 0), vote share vs seats (alliances and parties sections: difference, vote %, seat %), wasted votes (lakh) with the efficiency gap; Battle: margin distribution, seat summary (Seats, Close, Avg), closest contests; Swing: flipped seats (closest 15, total in the header), net swing by alliance; History: seat dominance, dominance by party, swing seats, anti-incumbency, incumbent win rate by party, notable defeats, party switchers, switch directions, notable switchers, margin trend, per-party trend; Reserved: category breakdown, wins by category, average margin by category; Insights: vote split analysis, one table per split, seat classification; States (LS): state leaderboard, sweep states, most competitive states. Margins use the old compact format (950, 21.1K, 1.2L). The compact card fits as many sections/rows as the tile allows and ends with "+N more rows · M more sections" that opens the summary focus view. Rows highlight on the map on hover and lock on click (a single-seat row selects the seat).
- MVVM: `src/model` (pure), `src/viewmodels` (hooks), `src/views` (Tailwind + Radix); boundaries enforced by `npm run lint`.
- **Summary focus view** (side-card expand, the map footer's expand button, or the mobile "insight" card): every section of the active layer with all its rows (cells in `[value, ...extra]` order under column headers, same number formats as the compact card), key stats as three large numbers, and the charts (margin distribution bar / grouped-by-alliance bar, margin trend and per-party seats line charts; plain SVG with a visually hidden data table and `role="img"`). Layer pills inside the view switch the layer (kept on close). Sections sit in a 2-column grid (1 column below 1024px); only the dialog scrolls. Sections that have a chart also carry plain rows so the compact card can show them.
- **Mobile layout (<1024px, checked at 390x844 and 360x740)**: a single column of top bar, scoreboard, map (takes the remaining height, `flex-1 min-h-0`) and the card rail (fixed height, never shrinks), so nothing overlaps and the page never scrolls. The top bar is one row of at most 56px: app title (truncates), an election chip ("VS · Bihar 2025", built by `useTopBarVM.electionLabel`) that opens a bottom sheet with the LS/VS toggle and state / year (or LS election) pickers, a search icon that opens a top sheet with the focused search box, and a more button that opens a sheet with WhatsApp / X share and the language picker (44px touch targets). The scoreboard uses the short bloc labels (NDA / MGB, full name in `title`/`aria-label`). Rail cards are read-only glances: the Party standings card shows the top four parties (dot, short id, thin bar, seats) plus "+N more parties"; the summary card shows key stats as plain text. Rail card titles are fixed (Party Standings is always "Party Standings"; only the standings focus dialog title follows the Parties / Watchlist tab). Desktop is unchanged.
- Spec: `docs/superpowers/specs/2026-09-29-studio-dashboard-design.md`.

## Known Limitations

- **Live ECI ingestion is not implemented.** The scraper's live pipeline (`scraper/src/index.ts`, `scheduler/`, `adapters/eci-adapter.ts`, `normalizer/`) is placeholder code only. Counting-day flows are exercised end-to-end via the Live Election Simulation System (mock ECI server + replay through the admin bulk-override API); real results today come from the historical seed files.

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

### Priority 4 — AI Integration

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

### AI Enrichment Improvements
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
- [x] Public API: `GET /elections/:id/constituencies/:constId/analysis` — full detail with AI fields
- [x] `useAnalysis` hook: transforms backend analysis → frontend data structures (dominance, incumbency, swing, spoiler, seatType, partySwitcher maps)
- [x] Dashboard: prefers backend analysis for finalized elections, falls back to client-side for live
- [x] ConstituencyModal: on-demand fetch of AI briefing, key issues, demographics for finalized elections
- [x] Seat history timeline in modal (colored party dots per election from backend data)

### Person Profiles (Public Frontend)
- [x] Public API: `GET /candidates/persons/:id` — person bio + cross-election candidate history with results (votes, status, margin)
- [x] Constituency detail API: candidates now include `person_id` + `person { id, photo_url }` via person join
- [x] Frontend types: `PersonSummary`, `PersonCandidate`, `PersonDetail`; `CandidateResult` extended with person fields
- [x] CandidateCard: shows 24×24 circle photo thumbnail when person has photo_url; clickable name navigates to person profile
- [x] CandidateTable + ConstituencyModal + ConstituencyDetail: pass `onPersonClick` through to CandidateCard
- [x] Person detail page (`/person/:id`): full profile (photo, gender, education, DOB, state, district) + election history table with outcomes
- [x] Election history table: year, constituency (linked), party (color dot), votes, status badge, margin — winner rows highlighted

### Admin: Editable District/Region & AI Content
- [x] `GET /states/:id/regions` endpoint (mirrors existing `/states/:id/districts`)
- [x] `PATCH /admin/constituencies/:id` — update `district_id` and `region_id` on constituencies
- [x] Admin expanded row: district/region shown as editable `<select>` dropdowns (editors/super admins)
- [x] Admin expanded row: AI briefing editable as textarea, demographics as inline inputs, key issues as editable list with add/remove
- [x] "Save AI Content" button persists changes via `PATCH /admin/constituency-analysis/:id`
- [x] AI enrichment prompts inject existing admin-corrected content as reference seed (prevents overwriting manual fixes)

### Other
- [ ] Mobile-optimized map controls
- [ ] Export/share map screenshots
- [ ] Real per-seat turnout data from ECI detail pages (if available)
