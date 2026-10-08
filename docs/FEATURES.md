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
- [x] ~~Auto-link endpoint~~ removed 2026-10-02: every candidate gets a person automatically (see Persons and candidates)
- [x] Persons list page: `/persons` — browse all persons with candidate count, photo filter, name search
- [x] Person detail page: `/persons/:id` — edit bio, view election history, merge duplicates (SUPER_ADMIN)
- [x] Candidate filters: ~~linked/unlinked~~ (removed 2026-10-02, every candidate has a person) (AI enriched/not enriched filters removed 2026-09-30)
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
- [x] Seed generator script (replaced 2026-10-03 by the ECI statistical-report pipeline, see "Bihar results data")
- [x] Bihar AC GeoJSON with 243 assembly constituencies (`frontend/public/geo/bihar_ac_2008.geojson`)
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

### Bihar results data (ECI statistical reports), 2026-10-03
Bihar VS 2010 / 2015 / 2020 / 2025 carry every candidate + NOTA with real ECI votes, correct SC/ST, electors, turnout
(voters ÷ electors) and polling phase. Spec `docs/superpowers/specs/2026-10-03-bihar-seeding-design.md`, plan
`docs/superpowers/plans/2026-10-03-bihar-results-seeding.md`.
- [x] Pipeline `scraper/src/bihar/`: `fetch-cli.ts` (ECI backend → `scraper/data/raw/bihar/`, gitignored) → `parse-cli.ts`
  (XLS/XLSX via SheetJS for 2020/2025, `pdftotext -layout` for the 2010/2015 PDFs) → ECI-internal cross-check
  (Detailed Results vs Constituency Data Summary per seat, vs Performance of Political Parties statewide) →
  committed `scraper/data/bihar/vs-<year>.json` → `generate-cli.ts` → seeds.
- [x] Committed data files (`scraper/data/bihar/`): `vs-<year>.json` (normalised results), `party-map.json` (ECI full
  name → party row; space-insensitive key), `party-aliases.json` (duplicate party ids in the DB → the id used),
  `supplement.json` (2015 seats 195/210/229, blank in the ECI report, from the archived official ECI results pages),
  `crosscheck-exceptions.json` (ECI's own table errors, with reasons), `decisions.json` (old rows matched/deleted by hand),
  `review-<year>.json` (generator review output).
- [x] Seeds: `seed_bihar_parties.sql` (fill-only), `seed_bihar_corrections_v1.sql` (run-once, **frozen**: it brings an
  old-seeded DB to the ECI values before the year seeds run; a later correction is a new `_v2` seed),
  `seed_bihar_vs_<year>.sql` (existing candidate/result ids kept, new rows get stable ids; manifest only when none is published).
- [x] `scraper/src/bihar/two-db-check.sh`: a fresh `setup.sh` DB and an upgraded copy of the local DB (setup run twice)
  must hold identical Bihar constituencies, candidates and results.
- [x] After the deploy that ships these seeds: recompute the seat analysis for the four Bihar elections (`docs/DEPLOYMENT.md` §5.0a).
- Display names: all-caps names (2010/2015) become Title Case; ECI's "Father's Name :- …" suffix is dropped. The 2015
  supplement seats have no general/postal split or candidate age/sex.

### Five states' historical results (WB, TN, KL, AS, PY 2011-2021), 2026-10-03
Plan `docs/superpowers/plans/2026-10-03-phase2a-historical-results.md` (historical track: results only).
- [x] The seeding pipeline is state-aware (`scraper/src/bihar/elections.ts` registry: ids, prefixes, report docids,
  expected seats / SC-ST / poll dates, seed names); every CLI takes a state code; Bihar's output is byte-identical.
- [x] All 15 elections from ECI statistical reports, every candidate + NOTA, real votes, SC/ST, electors, turnout,
  phase; ECI-internal cross-check (documented ECI table slips in `scraper/data/<slug>/crosscheck-exceptions.json`).
  Kerala 2021's report files were downloaded by hand (ECI's links fail). Tamil Nadu 2016 covers the 232 seats polled in
  May (Aravakurichi and Thanjavur were polled in Nov 2016 and are outside ECI's report).
- [x] Existing rows corrected by run-once `seed_<slug>_corrections_v1.sql` (frozen) before the year seeds; old
  invented rows (Assam 2021 runner-ups, misplaced/garbled West Bengal rows) deleted by user-approved decisions.
- [x] Cross-election person links per state (`seed_<slug>_person_links_v1.sql`, run-once).
- Per-state party overrides (`scraper/data/<slug>/party-overrides.json`) where an ECI name means another party here
  (Kerala 2011's "Muslim League Kerala State Committee" = IUML).

### Party model: lineage (splits, mergers, renames, breakaways) and state units, 2026-10-06
Spec `docs/superpowers/specs/2026-10-06-party-model-design.md`, plan `docs/superpowers/plans/2026-10-06-party-model.md`.
- [x] Migration 023: `party_lineage` (rename / merger / split / breakaway, date, optional state, successor flag, source),
  `party_units` (recognition in a state, office), `party_unit_roles` (state president, legislature leader, from/to,
  person link). Read API: `GET /parties/lineage`; `GET /parties/:id` adds `units` and `lineage`.
- [x] One comparison rule (`backend/src/common/comparable-parties.ts` = `frontend/src/model/derive/comparableParties.ts`,
  identical, tested against `docs/party-lineage-cases.json`): rename/merger = same party; split → the ECI-recognised
  successor keeps the history, another faction holding an old-party seat is a **split** (not a flip); breakaway = a
  note only. Applied in the seat analysis (swing `split`, no "switch" for following a split, dominance) and in every
  frontend comparison (`PartyComparer`, `usePartyComparer`: swing, dominance, switches, trends, seat insights, person
  pages, region comparison, swing chips tagged "split").
- [x] Data (sourced, user-approved 2026-10-06): 28 lineage events (15 mergers, 7 splits, 6 breakaways) and 139 state
  units with 259 leadership roles (`scraper/data/parties/lineage.json`, `units-*.json`, `scraper/src/party-model-cli.ts`
  → `seed_party_lineage.sql`, run-once `seed_party_units_v1.sql`).
- [x] Party dialog (state context): "<party> in <state>" — recognition there, state president and legislature leader
  (linked to person pages), lineage notes in plain words, and the family total after a split.
- [x] `scraper/src/recompute-analysis-cli.ts` recomputes the stored seat analysis for every election. Since the seat
  analysis rework (below) it posts no body: the server loads each election's history itself, as the admin button does.
- Next: the `/party/:id` page; admin editing of lineage and units.

### Election picker: one list instead of state + year dropdowns, 2026-10-05
- [x] The dashboard's election button opens one list (like the admin's): a search box ("bih", "2025", "bih 20"), live
  and upcoming elections pinned on top, then one row per state (alphabetical) with its years as chips, newest first; one tap picks.
  Desktop: a popover (search focused). Phone: the existing bottom sheet, focused on the current year (no keyboard
  pop-up), 40 px chips. Logic in `model/derive/electionChoices.ts` (`TopBarVM.choices(query)`), view
  `views/dashboard/ElectionPicker.tsx`. No keyboard shortcut on the public site.

### Jammu & Kashmir 2008, 2014, 2024 (Phase 4B-5), 2026-10-07
Plan `docs/superpowers/plans/2026-10-07-phase4b-jk.md`.
- [x] 3 elections from the ECI statistical reports (2008/2014 PDFs, 2024 XLSX): every candidate + NOTA (from 2014), real
  votes; winners match ECI (2008 NC 28 / PDP 21 / INC 17 / BJP 11; 2014 PDP 28 / BJP 25 / NC 15 / INC 12; 2024 NC 42 /
  BJP 29 / IND 7 / INC 6 / PDP 3). 2008 and 2014 are the state's 87 seats on the **1995 boundaries** (Ladakh's 4
  included; delimitation `'1995'`, majority 44); 2024 is the union territory's 90 seats on the **2022 delimitation**
  (`'2022'`, majority 46; the 5 nominated members are not modelled) and has no seat history. The registry takes
  per-election `seats`, `delimitation` and reserved counts (`p4` `newElection` overrides).
- [x] Maps: `jk_ac_2022.geojson` from ECI's 2024 boundary file (90 seats + 4 unnumbered areas, kept as `ac_no` 0 like
  the older maps); the old `jk_ac_2008.geojson` (really the 1995 seats) is now `jk_ac_1995.geojson` with SC seats
  typed; old paths redirect.
- [x] Hakeem Yaseen's PDF(S) is one party across years (`<slug>/party-overrides.json`: ECI's 2008 "People's Democratic
  Front" → JKPDF); Apni Party ← PDP (2020) and DPAP ← INC (2022) breakaways.
- [x] Districts and regions per boundary set (`regions-cli` reads `districts-1995.json` / `districts-2022.json`; 1995:
  22 districts, Jammu 37 / Kashmir 46 / Ladakh 4; 2022: 20 districts, Jammu 43 / Kashmir 47); person links 2008↔2014
  only; 2024 current track (15 leaders linked across the redraw by name; NC/PDP/People's Conference profiles; units v6;
  `seed_party_colors_v5.sql` gives PDP a darker green and People's Conference blue; top-4 photos 358; affidavits 90/90).

### Maharashtra 2009-2024 (Phase 4B-4), 2026-10-06
Plan `docs/superpowers/plans/2026-10-06-phase4b-maharashtra.md`.
- [x] 4 elections from the ECI statistical reports (2009/2014 PDFs, 2019 XLS, 2024 XLSX): every candidate + NOTA, real
  votes; winners match ECI (2009 INC 82 / NCP 62; 2014 BJP 122 / SHS 63; 2019 BJP 105 / SHS 56; 2024 BJP 132 / SHS 57 /
  NCP 41 / SHSUBT 20 / INC 16 / NCPSP 10). Parser: names wrapped onto the next line, summary pages printed twice (the
  first without totals), per-state `party-name-aliases.json` for ECI's two spellings of a party; sourced fixes for
  Bhusawal's 2009 type and Shrivardhan's missing 2014 summary.
- [x] Splits (already in the lineage): Shiv Sena 2022, NCP 2023/24; MNS ← Shiv Sena breakaway (2006) added.
- [x] Districts (36) and the six election regions (Mumbai 36, Konkan 39, North 35, Western 70 incl. Ahilyanagar as the
  sources count it, Marathwada 46, Vidarbha 62); person links; 2024 current track (44 leaders incl. Ajit Pawar as Deputy
  CM until his death on 28 Jan 2026; SHS/SHSUBT/NCP/MNS profiles; units v5 — roles may say `no_candidacy`; distinct
  colours for Shiv Sena, Shiv Sena (UBT) and NCP (SP) via `seed_party_colors_v4.sql`; NCP's ECI clock replaces a lotus;
  top-4 photos; affidavits 286/288).

### Andhra Pradesh 2009-2024 (Phase 4B-3), 2026-10-06
Plan `docs/superpowers/plans/2026-10-06-phase4b-andhra.md`.
- [x] 4 elections from the ECI statistical reports; 2009 and 2014 are undivided-state reports (294 seats): today's
  Andhra is seats 120-294, kept and renumbered 1-175 (`seatRange`; the party table is not compared for such partial
  reports). Winners match ECI (2009 Andhra seats INC 106 / TDP 53 / PRP 16; 2014 TDP 102 / YSRCP 67; 2019 YSRCP 151;
  2024 TDP 135 / JSP 21 / YSRCP 11 / BJP 8). 2014 seat 169 (Satyavedu) has no summary page: built from Detailed Results.
- [x] 2009 has no majority line: a manifest may say `no_majority` (`model/derive/majority.ts`); About explains it.
- [x] Lineage: Praja Rajyam → Congress (merger, 2011), YSRCP ← Congress (breakaway, 2011).
- [x] Map rebuilt from ECI's 2024 boundary file (the old file had 177 mis-numbered features).
- [x] Districts (28 current, incl. Markapuram and Polavaram of Dec 2025); regions Uttarandhra 34 / Coastal Andhra 89 /
  Rayalaseema 52 (by the old districts); person links with loose name keys (`STATES.AP.looseNames`: Telugu names
  change word order and initials); 2024 current track (29 leaders, TDP/YSRCP/Jana Sena profiles, party units v4 whose
  roles may name the exact `ballot_name`, top-4 photos, affidavits 172/175).

### Arunachal Pradesh 2009-2024 (Phase 4B-2), 2026-10-06
Plan `docs/superpowers/plans/2026-10-06-phase4b-arunachal.md`.
- [x] 4 elections from the ECI statistical reports (2009 PDF, 2014 scanned PDF, 2019 XLS, 2024 XLSX): every candidate
  (+ NOTA from 2014), real votes; winners match ECI (INC 42 / INC 42 / BJP 41 / BJP 46); 59 ST + 1 GEN seats.
- [x] Seats won unopposed (3 / 11 / 3 / 10): one WON candidate with 0 votes, no NOTA row, voters/turnout NULL. The
  parsers read ECI's three forms ("Uncontested" in the 2009 PDF; 1 contestant and 0 voters; 2024 seats left out of
  Detailed Results and built from the summary, `fromSummary`, skipped by the party-performance check).
  The product rule `model/derive/uncontested.ts` (`isUncontested`, `headlineMargin`, `isUnopposedWinner`): counted
  and coloured for the winner, no margin (never the closest contest, not in margin buckets or the flipped list's
  margin order), "Elected unopposed" on the seat page and in seat history, "Unopposed" in the leaders strip. Also
  covers Surat (LS 2024).
- [x] OCR for scanned reports (Arunachal 2014 has no text layer): `ocr-cli.ts` (macOS Vision via `ocr.swift`, two
  passes: the page, then its number columns) → `<pdf>.ocr.txt`; `ocrNormalise` (systematic misreads, Cyrillic
  look-alikes, faint zeros, postal = total − general); hand fixes checked against the scan in
  `scraper/data/ar/ocr-fixes.json` (15). Every seat, summary and party total cross-checks.
- [x] Districts (26 current) and regions (the 2 Lok Sabha seats: West 33, East 27, by seat); `Shri`/`Smt` prefixes
  dropped (`STATES.AR.stripHonorifics`); person links; 2024 current track (24 leaders, PPA profile, party units v3,
  140 candidate photos, affidavits 59/60).

### Sikkim 2009-2024 (Phase 4B-1), 2026-10-06
Plan `docs/superpowers/plans/2026-10-06-phase4b-sikkim.md`. Phase 4B fills the remaining 2024/25 states one at a time
(Sikkim → Arunachal → Andhra → Maharashtra → J&K), each deployed on its own.
- [x] 4 elections from the ECI statistical reports (2009, 2014 one PDF each; 2019 XLS set; 2024 XLSX set): every
  candidate (+ NOTA from 2014), real votes, electors, turnout; winners match ECI's party totals (2024 SKM 31 SDF 1).
- [x] Seat types: Bhutia-Lepcha (BL) seats are ST ("(BL)" stripped like "(SC)"); ECI labels them differently every year,
  so a fixed per-state table (`STATES.SK.seatTypes`: SC 2, ST 12) sets the types and a contradicting label is an error.
  AC 32 Sangha (monastic electorate, no territory) is GEN, not on the map, and noted on About.
- [x] Map: `sk_ac_2008.geojson` rebuilt from ECI's 2024 boundary file (archived results site `ac/S21.js`; `geo-cli.ts
  SK --year 2024 --write`) — the old file left 73% of the state in unnumbered blocks.
- [x] Districts (6, since 2021) and regions (the 4 former districts); person links v1/v2; 2024 current track: leaders
  (user-approved; two-seat contests of Chamling and Golay attached by hand), SKM/SDF/CAP-Sikkim profiles, top-4 photos
  (results site `AcResultGen2ndJune2024`), affidavits 32/32; party units for Sikkim in `seed_party_units_v2.sql`
  (run-once; v1 stays frozen); SKM's colour #ED1E26 via `seed_party_colors_v3.sql`; lineage SKM ← SDF (breakaway, 2013).

### Delhi, Haryana, Jharkhand, Odisha since the 2008 delimitation (Phase 4A), 2026-10-05
Plan `docs/superpowers/plans/2026-10-05-phase4a-dl-hr-jh-od.md`. The 2024/25 states, for completeness (the other states
get their history only as their own election approaches).
- [x] 17 new elections from the ECI statistical reports: Delhi 2008, 2013, 2015, 2020, 2025; Haryana, Jharkhand,
  Odisha 2009, 2014, 2019, 2024 — every candidate (+ NOTA from 2013), real votes, SC/ST, electors, turnout, poll-date
  phases; winners match ECI's party totals. Parser: the pre-NOTA PDFs (Form-7 serial + rank, separate TOTAL / "Turn Out"
  lines, indented WINNER, Odisha's "RUNER-UP"), the 2019/2020 summary sheets (seat number only in the sheet name, plain
  section headings, dd/mm/yyyy dates), Jharkhand 2014 (its Women Candidates table headed "DETAILED RESULTS" is skipped;
  7 seats missing from the summary → `missing-summaries.json`). Odisha 2019 has 146 seats: AC 96 Patkura was
  countermanded and polled later (no ECI report of it; About says so).
- [x] Districts and regions (current districts, incl. Delhi's 13 of 2026 and Haryana's Hansi): Delhi by its 7 Lok Sabha
  seats (`seatRegions`), Haryana 6 divisions, Jharkhand 5 divisions, Odisha 3 revenue divisions.
- [x] Person links (v1 history, v2 latest year); the latest election of each state at current-track depth: leaders
  (user-approved; a candidacy may carry `ballot_name`), 7 new top-party profiles (user-approved), top-4 candidate photos
  from the archived results pages (Wayback), winners' affidavits from MyNeta (Jharkhand 80/81: Bermo missing on MyNeta).
- Current-track CLIs work on each state's latest assembly only (`trackOf`: elections with a results site / MyNeta).

### Goa, Manipur, Punjab, Uttarakhand, Uttar Pradesh 2012-2022 (history), 2026-10-05
Plan `docs/superpowers/plans/2026-10-05-phase3a-five-states-history.md` (historical track; results only, including 2022).
- [x] 15 new elections from the ECI statistical reports (2012 one PDF per state, 2017 XLSX/PDF set, 2022 numbered XLSX set):
  every candidate + NOTA, real votes, SC/ST per election (UP 2012 SC 85 / ST 0, 2017 and 2022 SC 84 / ST 2), electors,
  turnout, poll-date phases; winners match ECI's party totals. Sourced fixes for ECI slips: `summary-fixes.json` (a broken
  summary page, wrong seat types), `missing-summaries.json` (UP 2017: 11 seats missing from the summary), `candidate-fixes.json`
  (UP 2012 seat 72: two candidates of one party, the second recorded as IND). Manifests with pre-poll alliances.
- [x] Districts and regions (`scraper/data/<slug>/districts.json`, sourced; `regions-cli.ts` → `seed_<slug>_districts_regions.sql`):
  Goa North/South by seat number (1-20 / 21-40); Manipur Valley 40 / Hills 20 (current 16 districts); Punjab Majha 25 /
  Doaba 23 / Malwa 69; Uttarakhand Garhwal 41 / Kumaon 29; UP's seven Lokniti-CSDS regions (Paschim 44, Rohilkhand 52,
  Doab 73, Awadh 73, Bundelkhand 19, Purvanchal 81, North-East 61).
- [x] Maps: the existing 2008 files; a Vidhan Sabha map feature takes the seat with its number when the names differ
  (`matchFeaturesToSeats(…, { byNumber })`), and maps wound the planar way are rewound on load (`model/geo/winding.ts`).
- [x] Person links across 2012-2022 (`seed_<slug>_person_links_v1.sql`, run-once). About lists the 15 datasets.
- Not yet: leaders, photos, party profiles, affidavits (with the 2027 elections, for every candidate).

### The five 2026 elections (AS, KL, PY, TN, WB), 2026-10-04
Plan `docs/superpowers/plans/2026-10-03-phase2b-2026-elections.md` (current track).
- [x] Results from the ECI statistical reports (May 2026; West Bengal's set includes the AC 144 Falta re-poll): every
  candidate + NOTA, real votes, SC/ST, electors, turnout, poll-date phases; winners match ECI's party tallies. New
  elections are emitted without an old seed (`scraper/src/bihar/new-election.ts`), manifests curated with sources in
  `scraper/data/<slug>/manifest-2026.json`.
- [x] Assam follows the 2023 delimitation (126 seats, 9 SC, 19 ST): map `frontend/public/geo/as_ac_2023.geojson` built
  from ECI's boundary file (`geo-cli.ts`: our seat names, d3 winding, mapshaper); seats tagged by district/region one by
  one (`seed_as_2026_districts_regions.sql`); no seat history, no links to 2008-era candidacies.
- [x] Regions tab (2026-10-05: every Vidhan Sabha election whose seats carry regions): `GET /elections/:id/region-shares`
  (seats won or leading, vote share per party per region, the region's seat ids; 404 for an unknown election) + a
  **Regions map layer** (next to Overview/Battle/Swing): seats keep their winner colours, each region is outlined from its
  own seats (no region shapes; `model/derive/regionOutlines.ts`), and hovering/clicking a region in Summary highlights it
  (strong outline, the rest dimmed; the lock can later drive an auto-zoom). Summary on that layer: statewide and per region, by Party (default: top 6 by current vote, the rest as Others) or Alliance (each year's own
  manifest alliances), vs the state's previous election, with the change in points; "approximate" only when the boundaries
  differ (Assam 2026); a state's first election shows its own figures only.
- [x] Lok Sabha hidden from the site (2026-10-05; data kept): `frontend/src/model/config/houses.ts` (`SHOWN_HOUSES`) filters
  elections, the LS/VS toggle, About rows and person contests; direct LS links redirect home.
- [x] 2026 candidates linked to their 2011-2021 persons (`seed_<slug>_person_links_v2.sql`, same delimitation only).
- [x] Leaders (CM, LoP, opposition chiefs, cabinet; user-approved) with Blob photos; 40 top-party profiles (user-approved);
  top-4 candidate photos from the live ECI results site; winners' affidavits from MyNeta (packed rows decoded, never run).

### Bihar 2025 party profiles, 2026-10-03
- [x] The 15 top parties of Bihar 2025 (won a seat, 1 %+ of the vote, or alliance member: RJD, BJP, JDU, INC, LJPRV, JSP,
  CPIML, AIMIM, BSP, VIP, HAMS, RLM, CPIM, IIP, CPI) researched with sources into `scraper/data/bihar/parties-2025.json`
  (user-reviewed): abbreviation, ECI recognition, founding year, leader as of Nov 2025, headquarters (registered address),
  website, Wikipedia, brand colour, our own one-line description, ECI symbol name. `party-profiles-cli.ts` →
  `seed_bihar_party_profiles.sql` (run-once, fill-only; colour only replaces a grey placeholder; name spacing tidied).
- [x] Images from Wikimedia Commons (free licences, credited in `image_credits`): ECI ballot symbols for 11 parties (the old
  RJD and JD(U) "symbols" were photos of people), logos for BSP and IIP, HAM(S)'s broken red-block logo removed. Rule: a
  new image replaces a current one only when that one is wrong or missing. Wired through `seed_party_symbols.sql`.
- The other 146 parties of 2025 keep their bare ECI records.

### Bihar persons, leaders and affidavits, 2026-10-03
Plan `docs/superpowers/plans/2026-10-03-bihar-persons-leaders.md` (spec §6–§7). All seeds are run-once (`seed_runs`) and fill-only.
- [x] **Cross-election linking** (`scraper/src/bihar/links.ts`, `links-cli.ts` → `seed_bihar_person_links_v2.sql`): same name (alias dropped) in
  the same seat in two or more years. `high` = same party, `medium` = party switch or an IND member with every declared age fitting the years; `review` (common names with differing parties or IND, single-word names, ages that contradict the years,
  same-year duplicates) is not linked (`scraper/data/bihar/links-review.json`). Each group anchors on its most-linked person; only
  auto-created single-candidacy persons outside the merge log move. 1,055 persons have more than one contest on a fresh build.
- [x] **Tier A leaders** (`scraper/data/bihar/leaders.json`): 41 people curated from the Nitish Kumar ministry articles (2010/2015/2020/2025)
  and the LoP article, with sources, user-reviewed. `profiles-cli.ts` reads Wikidata/Commons, uploads each photo once to our Vercel Blob
  store (`persons/<QID>/photo.<ext>`), records source/author/licence (`leader-profiles.json`); birth dates only at day precision.
  `leaders-cli.ts` → `seed_bihar_leaders.sql`: links each leader's candidacies, fills photo/DOB/gender/Wikipedia/bio (bio generated from
  the curated roles), inserts `image_credits`, and writes the `leaders` / `cabinet` watchlists (with `person_id`) into each Bihar manifest once.
- [x] **Affidavits** (`affidavits.ts`, `affidavits-cli.ts` → `seed_bihar_affidavits.sql`): MyNeta (ADR) winners' tables (slugs `bih2010`,
  `bihar2015`, `bihar2020`, `Bihar2025`): criminal cases, assets, liabilities, education. Matched by seat name (district tags stripped, fuzzy,
  duplicate names resolved by winner) and winner name; by-election rows skipped; unmatched rows listed in `affidavits-<year>.json`.
- [x] **2025 candidate photos** (`photos.ts`, `photos-cli.ts` → `seed_bihar_candidate_photos.sql`, run-once, fill-only): the top 4
  candidates per seat get the photo ECI showed on its 2025 candidate-wise results page (pages archived on the Wayback Machine,
  photo files still served by ECI); shrunk to 240px (~7 KB) and stored once in our Blob store (`persons/eci2025/<seat>-<serial>.jpg`),
  credited to ECI ("no licence stated"). 970 of 972; 2 name mismatches listed in `photos-2025.json`. Older elections have no
  ECI photos; a person who also ran in 2025 shows that photo. About collapses bulk credits into one counted line.
- [x] **Image credits** (migration 022 `image_credits`, `GET /credits`): a credit line under a person's photo (`photo_credit` on the profile)
  and a Credits section on About.
- [x] **Manifest `person_id`**: watchlist/leader/cabinet entries carry `person_id`; the admin picker stores it (candidates of the election, or a
  person without a seat), and the dashboard links seatless leaders to their person page. Results payloads do not carry `person_id` (kept small for counting day).

### Bihar VS 2020 Historical Data
- [x] Seed SQL (`database/seed_bihar_vs_2020.sql`): originally winner + runner-up with synthetic votes; since 2026-10-03 every candidate with real ECI votes (see "Bihar results data")
- [x] Election ID: `b2c3d4e5-f6a7-8901-bcde-123456789020`
- [x] 2020 NDA alliance: BJP, JDU, LJP, HAMS; MGB: RJD, INC, CPI, CPIM, CPIML
- [x] Bihar 2025 manifest updated with `compare_with` pointing to 2020

### West Bengal VS Historical Data (2011, 2016, 2021)
- [x] Seed generator (`scraper/src/generate-wb-vs-seeds.ts`, retired 2026-10-08: replaced by the registry pipeline, `docs/SEEDING_PLAYBOOK.md`)
- [x] GeoJSON: `frontend/public/geo/wb_ac_2008.geojson` (294 ACs with `ac_name`, `ac_no`, `ac_category`)
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
- [x] Ingest and seat corrections publish `result-update` via `LiveService` (the old admin override endpoints are removed)
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
- [x] `admin.result.overrides.total` — Counter for admin result changes (seat corrections) by election + status
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
- [x] Body limit 100 kb, 5 MB only on the ingest seats route (requests without a Bearer header get 401 before the body is parsed); admin id arrays capped at 2000 so they fit 100 kb
- [x] Query DTOs on list endpoints (bounded `page`/`limit` ≤ 200, enums, UUIDs, ISO dates) — bad input is 400, not 500. Unknown query keys are rejected (400) except the cache-buster `_` (`?_=<timestamp>`), which is accepted and ignored on every route; empty values count as not sent
- [x] URL fields (`photo_url`, `website`, `wikipedia_url`) must be http(s) (validated in the request DTOs)
- [x] Public self-registration (`/auth/register`) off unless `ALLOW_REGISTRATION=true`; the last SUPER_ADMIN cannot be demoted or deleted
- [x] CORS origins trimmed, no credentials (Bearer auth), optional `CORS_ORIGIN_REGEX` for preview URLs
- [x] `X-Request-ID` accepted only if it matches `^[\w-]{1,64}$`; auth logs carry user ids, not emails

### Security hardening (2026-10-08)
- [x] JWT pinned to HS256 (signing, `JwtService.verify`, passport strategy); startup fails when `JWT_SECRET` is shorter than 32 chars (except `NODE_ENV=test`)
- [x] Password fields capped at 72 characters and 72 UTF-8 bytes (bcrypt ignores the rest): login, register, admin user create/update, `create-admin`
- [x] Revocable admin sessions: `users.token_version` (migration `027_users_token_version.sql`) is the `tv` claim of every session JWT and is checked on each request; `POST /auth/logout` (authenticated, 204) and a password change/reset bump it, revoking every earlier token (tokens without `tv` are refused, so everyone logs in once after the deploy). Token lifetime `JWT_TTL` (default 8 h, was 24 h). The admin's Log out calls the endpoint (best effort) and always clears the local session
- [x] Audit rows (`AuditLogService.log`, never passwords or hashes) for USER_CREATE / USER_UPDATE (name, email) / USER_ROLE_CHANGE / USER_PASSWORD_RESET / USER_DELETE, ELECTION_CREATE / ELECTION_UPDATE (changed fields; status changes stay with the lifecycle), MANIFEST_SAVE (keys + size summary) / MANIFEST_PUBLISH, MEDIA_UPLOAD, ANALYSIS_COMPUTE, ANALYSIS_NOTES_UPDATE (entity `constituency_analysis`, so a seat's last edit is unaffected), FEEDBACK_UPDATE; the admin Audit logs filters list them
- [x] Validated manifest drafts: `PUT /admin/elections/:id/manifest` takes `ManifestDraftDto` (`backend/src/modules/manifests/dto/manifest-draft.dto.ts`): only the keys the site, the seat analysis, the seeds and the admin editor use (incl. `government`, `delimitation_era`, `live_tabs`, `geo.hex_url`), unknown keys refused at every level, arrays and strings capped, hex alliance colours, `geo.map_url`/`hex_url` a /path or https, `government.source` http(s); a JSON array body is refused. Raw-JSON-tab edits with other keys now get a 400. A DB test checks every stored manifest and draft passes. Constituency metadata (`PATCH /admin/constituencies/:id/metadata` and `metadata` on `PATCH :id`) is bounded: a JSON object of at most 8 KB, 4 levels, 50 keys per object
- [x] SVG uploads (`POST /admin/media`) with active content are refused (400): script-capable elements (script, foreignObject, iframe, embed, object, …), on* handlers, javascript:/vbscript: URLs (also entity-encoded or split by whitespace), external href/xlink:href, CSS @import or external url(), xml-stylesheet, animated hrefs, and entity declarations other than Illustrator-style namespace URLs; the whole file is scanned in linear time. SVG objects are stored with `Content-Disposition: attachment` (S3 cannot set a per-object CSP header)

### API cleanup, tier 3 (2026-10-08)
- [x] Error codes: a missing candidate is `CANDIDATE_7001` (was `GEN_0002`); a manifest read/save/publish for a missing election is `ELECTION_2001` (was `MANIFEST_8001`, now removed); publishing with no draft is 409 `MANIFEST_8002` (was 404). Unused codes removed (`AUTH_1002`, `ELECTION_2002`, `MANIFEST_8001`); a unit test fails on any code no backend file throws
- [x] Query/param DTOs everywhere a value reaches Prisma: `GET /admin/candidates` (as `/candidates`), `GET /admin/persons/search` (`q` required, trimmed, ≤ 100; shorter than 2 characters → `[]`), `GET /parties/:id/record?state=` (2-letter code, any case, or absent), ingest `?shard=`/`?holder=`; route params `/parties/:id` (`common/validation/ids.ts`: letters, digits, `_ & ( ) . + -`, ≤ 20; `CreatePartyDto.id` takes the same shape) and `/admin/constituencies/…/:id` (letters, digits, `_ & -`, ≤ 100). An array for a scalar param is a 400
- [x] Rate limits shared across instances: the throttler storage keeps counts in Redis (one Lua script per hit, hit + block keys in one hash slot) and falls back to in-process counters while Redis is down or a call fails (`common/throttle/rate-limit-counters.ts`). Per-email failed-login lockout (`LoginAttemptsService`): `LOGIN_MAX_FAILURES` (default 10) failures lock that email's login for `LOGIN_LOCK_MINUTES` (default 15); unknown emails count too; a locked login gets the same generic error after the same DB + bcrypt work, even with the right password; success clears the count; Redis keys hold a SHA-256 of the normalised email

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
- [x] Click row to expand: shows all candidates with inline editable votes/margin/status (inputs validated client-side before submit)
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
- [x] Retrofitted into the Live Console and manifest editor (replaced inline/flat dropdowns). Superseded 2026-10: the top-bar picker is now the single election selector; entity pages no longer have their own pickers (see "Admin redesign: entity pages + ⌘K")

### Constituency Intelligence System (Admin)
- [x] Database migration: `constituency_analysis` table + `constituencies.metadata` JSONB column
- [x] Constituency metadata: manual tags (caste, religion, geography, region) stored as JSONB
- [x] Predefined tag palette with autocomplete (yadav_dominated, muslim_majority, urban, seemanchal, etc.)
- [x] Bulk tagging: multi-select constituencies and add/remove tags in bulk
- [x] Auto-computed analysis: dominance (stronghold/loyal/swing) + incumbency from historical results. Superseded
  2026-10 by "Seat analysis rework (Phase A)" below.
- [~] ~~AI enrichment pipeline (constituency briefings, demographics, key issues; candidate/person/party enrichment)~~ — **removed 2026-09-30**, see "Built-in AI and constituency briefing removed" below
- [x] Constituency Manager admin page (`/constituencies`)
  - Top-bar election + search + tag filter
  - Table with checkbox multi-select, tags as colored chips
  - Expandable row: editable tags, region, incumbency info, demographics
  - Bulk actions: add/remove tags across selected constituencies
  - Compute button: triggers server-side dominance/incumbency analysis
- [x] Admin route `/constituencies` with sidebar nav link
- [x] Backend: `ConstituencyAnalysis` entity, extended `ConstituenciesService`, `AdminConstituenciesController`

### Seat analysis rework (Phase A, 2026-10)

Spec `docs/superpowers/specs/2026-10-07-seat-analysis-design.md`, plan `docs/superpowers/plans/2026-10-07-seat-analysis-phase-a.md`.

- [x] **One engine.** A pure module, `backend/src/common/seat-analysis/` = `frontend/src/model/derive/seatAnalysis/`,
  byte-identical except each side's one-line `lineage.ts` (tests on both sides enforce it). It replaced the backend
  strategies. `analyse(input)` throws unless the history is oldest → newest (the old engine compared Bihar 2025 with
  2010 when the admin button sent no history).
- [x] **Per seat** (`constituency_analysis.data`, migration 024):
  - winner, runner-up, margin;
  - outcome: retained / gained from X / split / new, with `provisional` while it's only a lead;
  - vote swing of the winner party and the previous holder;
  - class from the current holder and streak (stronghold = the same party every time, at least 3; loyal = streak 2+;
    swing; new);
  - incumbency (re-contested, where, party now, switched / followed a split, won);
  - seat history with each party's lineage family;
  - seat type;
  - notes: spoiler (third candidate above the margin, or the manifest's alliance vote split), NOTA above the margin,
    rematch, revenge, party switcher, heavyweight (manifest leaders / cabinet, party unit roles on the election date),
    bellwether.
- [x] **Per election** (`election_analysis`):
  - party rows: seats, votes and share, change against the previous election of the state even across a redraw;
    held / gained / lost / split only within one delimitation;
  - lineage family totals;
  - seat flow matrix;
  - alliance change (UPA counts as INDIA);
  - close seats (under 3%) and narrowing seats;
  - bellwethers: the winner was in the manifest `government` at every comparable election, at least 3;
  - breakdowns by reserved type, region and turnout change.
- [x] **One compute path:** `SeatAnalysisService.compute` loads the history, `previousAny`, lineage, manifest and unit
  roles itself. It is called by finalizing an election (a failure is logged, the finalize stands), the admin "Compute
  all analysis" button, `POST /admin/constituencies/analysis/compute/:id` (no body) and the recompute CLI. It upserts and
  never touches the admin `notes`. UP 2022 computes in about 40 ms.
- [x] **API:** `GET /elections/:id/analysis` returns `data` per seat, plus the old `incumbency` JSON for one release
  (built from `data`, or the stored pre-024 JSON while a row is not yet recomputed). `GET /elections/:id/analysis/summary`
  returns the `ElectionAnalysis`.
- [x] **Person matching:** by person_id, else by name in the same seat, else by name anywhere in the election only if
  that name is unique. Older elections are only partly person-linked (TN, KL and UP find far more repeat candidates by
  name), so better person links improve the analysis with no code change.
- [x] **Manifest `government`:** `{ parties, label?, source }`, the parties that formed the government after each VS
  election. Filled for all 75 by the fill-only `seed_election_government.sql` (generated from
  `scraper/data/government.json` by `scraper/src/government-cli.ts`); edited in the admin manifest JSON tab.
- [x] **Frontend:** dashboard maps, seat history and the alliance spoiler read `data`; the constituency page's
  `anti_incumbency` class is gone (the "incumbents lost" chip stays, from incumbency). For elections that are not
  Finalized, the dashboard still uses `useHistoryAnalysis` until Phase B (baseline, seat timeline, live analysis).
- Known: in states dominated by one party, "bellwether" and "stronghold" overlap (e.g. WB 2021: 124 bellwethers).


### Seat analysis rework (Phase B, 2026-10)

Plan `docs/superpowers/plans/2026-10-07-seat-analysis-phase-b.md` (spec §5). Data first: the live signals are computed
and exposed, but not drawn yet (the map brainstorm designs their visuals).

- [x] **Baseline** (`baselineOf` in the shared module): what is known per seat before counting:
  - previous holder carried through lineage, its alliance, margin, vote shares and turnout;
  - the class before this election;
  - the sitting MLA (re-contesting, where, for whom; switched or followed a split);
  - rematch, switchers, heavyweights, close / narrowing last time.

  It is stored in `election_analysis.baseline` and served at `GET /elections/:id/baseline` (CDN `PUBLIC`). The compute
  endpoint and the admin button compute the final analysis for a Finalized election and the baseline otherwise.
  Going Live recomputes it.
- [x] **Readiness:** `live:check` reports NOT READY when the baseline is missing or older than the latest candidate
  change (the roster carries `baseline: { computed_at, stale }`). Staleness compares two database times: the candidate
  trigger's `updated_at` and `baseline_computed_at`.
- [x] **Seat timeline** (migration 025, `seat_rounds`): one row per change of leader, runner-up, margin or declared
  state. It is appended set-based in the same transaction and under the same seat lock as the results write, by the
  ingest and by admin seat corrections.
- [x] **Snapshot trail:** each versioned snapshot carries `trail[const_id] = { points (≤6: round, leader party, margin,
  votes counted), lc (lead changes), pk (peak margin) }`, read in the snapshot's RepeatableRead transaction.
  `GET /elections/:id/constituencies/:constId/rounds` returns the full timeline.
- [x] **Live analysis** (`analyseLive`, in the browser on each snapshot):
  - outcome (provisional while leading) and vote swing;
  - call: `declared` / `safe` / `likely` / `too_close` / `counting` / `not_started`, from lead ÷ remaining votes
    (remaining from the rounds, else electors × previous turnout);
  - momentum (`switched` / `narrowing` / `widening` / `stable`) and comeback, from the trail;
  - the sitting MLA's status;
  - upsets (stronghold trailing, heavyweight trailing, sitting MLA trailing);
  - live tallies (party held / gained / lost, seat flow, alliance moves).

  The thresholds are provisional (see `docs/LIVE_RUNBOOK.md` → Call thresholds).
- [x] **Live = final:** a DB test runs `analyseLive` on every local VS election's final results with its baseline,
  and requires the same winner, margin, outcome, swing, party held / gained / lost and flow as `analyse()`. It caught
  and fixed two bugs: winners declared unopposed, and stray duplicate seat rows.
- [x] **Dashboard:** live and upcoming elections take their swing / history / incumbency / switcher maps from the
  baseline + live analysis; Finalized ones take them from the stored analysis. The old browser engine is gone (only
  its trend charts remain), and "changed hands vs <year>" uses the baseline's previous election.
  `DashboardSources.liveAnalysis` exposes the per-seat live state for the map work. A missing baseline or trail leaves
  the maps empty, with no error.
- [x] **Simulation:** the simulation election copies its source's delimitation; `sim:reset` also clears the timeline
  and counting state; `tune-calls.ts` measures the call labels on a run.

### Live map (2026-10)

Spec `docs/superpowers/specs/2026-10-07-live-map-design.md`, plan `docs/superpowers/plans/2026-10-07-live-map.md`.
Stitch screens (project 7025431006647439600): desktop Overview `0b2199443acd4d57835764059329e6be`, desktop Battle
`01ffabeedaaa4043b747bf4729fbdfa9`, seat dialog `61d96702a88c46d2a8f6a8e4c80e9333`, mobile Overview
`448c33328ceb4c18b1e6cc19f7741f99`, mobile Battle `97964eded11043c58578129396e11542`.

Live styling applies only while the election is Live and some seat is still counting (`countingLive`). Before the
first result, and once every seat is declared, the dashboard is the ordinary results map.

- [x] **Overview:** the leading party's colour with strength by call:

  | Call | Look |
  |---|---|
  | Declared / safe | solid |
  | Likely / counting | 0.6 |
  | Too close | 0.3 with a dashed outline in the party colour |
  | Not started | pending grey |

  The legend reads Safe · Likely · Too close · Not started, with counts and no vote thresholds (the tooltip explains
  "lead compared with the votes still to count"). A "Too close · N" chip in the insight strip filters the map.
- [x] **Battle:** seats coloured by momentum in non-party colours:
  - switched = violet `--color-map-mo-switched`;
  - narrowing = magenta;
  - widening = pale grey-blue;
  - stable / declared = slate.

  The headline reads "N lead changes so far", with Switched / Narrowing / Widening / Comebacks / Upsets chips. When
  nothing is counting, Battle keeps the margin buckets.
- [x] **Typed pulse:** the outline flash is coloured by type: upset (red) > lead switch (violet) > declared /
  update. The ticker adds "Lead switch: seat · from → to" and "Upset: …" lines.
- [x] **Live seat dialog:**
  - round progress bar;
  - call badge (Too close dashed) and momentum badge;
  - margin trend chart from `GET …/rounds`: party-coloured segments, a marker per lead switch, only the latest one
    labelled;
  - upset badges with names (sitting MLA, stronghold holder and year, heavyweight);
  - "Lead narrowed / widened from X to Y over the last N rounds".
- [x] **The Map / Hex toggle is hidden;** no hex renderer exists yet.
- Checked on a simulation run: desktop, mobile 390×844, light theme. Known: early in a count many seats are "too
  close" (about 110 of 243 at round 8 of 24 in the simulation), because the provisional thresholds compare the lead
  with all remaining votes.
### Admin redesign: shell + Live Console (2026-10)
- New shell: grouped sidebar (Counting / Data / Admin), top bar with a global election picker (remembered in `?election=` + localStorage), live-updates pill, health dot (`/health/ready`), keyboard-shortcuts dialog.
- Election picker (`components/shell/ElectionPicker.tsx` + `electionGrid.ts`): the top-bar button shows state, type, year and status ("West Bengal · Vidhan Sabha 2021 · Finalized", status dot green live / amber upcoming / grey finalized). It opens a Radix Popover with a search box, a "Live & upcoming" pinned list, and a state × year grid (Lok Sabha first, states A–Z, years newest first). Search matches every token against state words, state initials (`wb`, `tn`), year prefix (`20`), type (`ls`, `vidhan`) or status (`live`). `E` opens it anywhere outside a text field, dialog, menu or popover (a Radix menu's typeahead keeps its letter keys); ↑↓ move, Enter picks, Esc closes. Switching with unsaved edits asks first.
- Live Console split view: seat list with Pending / Leading / Won filters, search, and lock indicators. The seat editor has every candidate editable, an auto-calculated margin (leader − runner-up; others = gap to leader), statuses that follow the votes, editable rounds, **Save seat** (one bulk call) and **Declare won**. Keyboard: ↑/↓, Enter, Esc, /. Unsaved seat edits are kept while searching/filtering (the selection is held while the editor is dirty); switching election, a sidebar link, or closing/reloading the tab asks first. Declared seats keep their statuses when votes are corrected, with a warning if the winner is no longer ahead; saving a clean seat sends nothing.
- Seat locks (ids fixed in Phase 3: real constituency ids are accepted, not just UUIDs): soft, advisory, held in Redis `lock:seat:{election}:{const}` (TTL 120 s, heartbeat 45 s). Endpoints `GET/POST /admin/live/locks` and `POST /admin/live/locks/release`, SSE `seat-lock`. Take-over is audited (`SEAT_LOCK_TAKEOVER`). With Redis down, locking is disabled and saving still works. A read-only viewer takes the lock as soon as the holder leaves (release event, or a retry every heartbeat after a TTL lapse); the seat list hides locks older than the TTL.
- Styling: Tailwind v4 with preflight + Radix. The legacy `admin.css` layer was removed in Phase 3.

### Admin redesign: entity pages + ⌘K (2026-10)
- Elections, Parties, Persons, Candidates, Constituencies and Manifests share one list pattern (`components/entity/EntityPage`, `components/ui/{DataTable,Sheet}`): a page header with a count, a toolbar, one table style (sticky header, selected row, empty state), and a record panel on the right. The panel is a non-modal Radix Dialog rendered in place in the page's flex row, 400px wide (Manifests: full width). The old per-entity pages and the legacy landing cards / election pickers are gone. Parties, Persons, Candidates and Constituencies no longer open a side panel: they open a full record page (see "Admin record pages" below).
- URLs: `/x/:id` opens a record and `/x/new` creates one (`useEntityRoute`); old `/x/:id/edit` links redirect; the query string (`?election=`) is kept.
- Unsaved changes: every editor calls `useUnsavedGuard(dirty)` with per-owner dirty tracking. "Discard unsaved changes?" is asked on row switch, close, Esc, any sidebar link (including the current section), the election picker, ⌘K and tab close. The browser Back button is not guarded (BrowserRouter).
- Candidates and Constituencies use the global top-bar election.
- Role gating: Finalize (Elections), Merge duplicates (Persons) and Publish (Manifests) are SUPER_ADMIN only.
- Elections: Go live and Finalize ask first; new elections appear in the top-bar picker at once (`ElectionContext.reload`).
- Elections has no side panel: a full-width table (Election + "Current" tag, Year, Type, State, Status, Result date, Manifest published / not published) with row actions: Go live (upcoming) or Finalize (live, SUPER_ADMIN), and a ⋯ menu (Edit, Open manifest, Open live console for a live election, Make current). Open manifest and Open live console switch the global election to that row first, so the Live Console never shows another election's seats. Clicking a row, Edit, or New election opens a centred modal form (`components/ui/FormDialog`) at `/elections/:id` / `/elections/new`, with the same unsaved-changes guard. `DataTable` ignores clicks that bubble out of portals (menus, dialogs) so they never count as a row click.
- Result date: `elections.tentative_next_date` is the counting day (one date, however many polling phases). The admin labels it "Result date"; the public site counts down to it and polls around it only while the election is upcoming (the countdown hides itself once the date has passed). `database/seed_election_result_dates.sql` fills the real counting dates of the 20 seeded past elections, only where empty (it runs on every `setup.sh`, so a date cleared in the admin comes back).
- Parties (`/parties`, record page at `/parties/:id`): server-side search and paging, plus an ECI recognition filter.
- Persons (`/persons`, record page at `/persons/:id`): `?q=` search. Merge duplicates merges the found record **into** the open one, so the viewed person is kept.
- Candidates (`/candidates`, record page at `/candidates/:id`): one seat of the global election at a time (searchable Seat select, default lowest seat number; `?seat=` picks the seat once and is then dropped from the URL), name search in the seat. The record page holds the affidavit form (age and criminal cases must be whole numbers), the read-only person photo, "Change person" and "Split into new person" on the Master record card, and "Possible duplicates" (same name, other persons) that open the merge. A record of another election offers "Switch election".
- New candidate (`/candidates/new`, a `FormDialog`): name, party (Independent = the `IND` party row), seat of the global election, affidavit fields. `POST /admin/candidates` checks the seat belongs to the election (404 otherwise) and, in the same transaction, adds the candidate's results row (0 votes, `TRAILING`) so it shows up in the Live Console. A Finalized election is refused with 409 (`ELECTION_FINALIZED`); the page disables "New candidate" for it. After the commit the same post-commit steps as a result override run (live-version memo, cache purge, admin SSE `result-update`); a failure there is only logged.
- Constituencies (`/constituencies`, record page at `/constituencies/:id`): seats of the global election, 100 per page with a pager; a new search returns to page 1. District and tag filters are labelled "(this page)" because the API only searches by name. Select-all and bulk "Add tag" act on the visible rows only; the selection clears when the page, search, filter or election changes. "Compute all analysis" asks for confirmation. The record page edits demographics (population whole number; literacy, urban and SC/ST % from 0 to 100 with one decimal; 0 is kept as 0, emptied fields are cleared), district, region, seat number (whole number, 1 or more), phase and tags (15 suggested tags plus free text), and shows the seat history (see "Admin record pages").
- Manifests (`/manifests`, full-width panel at `/manifests/:electionId`): one row per election, "Published" or "Not published" from the election's manifest URL. The panel has Summary (read-only counts, alliances, vote splits, comparison history, watchlists, map, milestones), Edit (all ten editors, every section always open) and JSON tabs, a Draft badge, Save draft, and Publish (SUPER_ADMIN only, behind a confirm; unsaved edits are saved first). Invalid JSON blocks tab switches, Save draft and Publish. A failed load offers Try again; a 404 says the election was not found. Load order: draft, then published, then default.
- ⌘K / Ctrl+K palette: searches pages, seats (selected election), candidates (selected election first), parties and persons. Opening a record from another election switches the election first.
- Fixes: Party/Person paging; person merge direction (it used to delete the viewed person; also hot-fixed to production `main`, commit eb901a7); legacy `M`/`F` gender display and save; dead candidate photo field; `?q=` ignored on Persons; Constituencies capped at 100 rows; numeric 0 saved as null; NaN seat number.


### Admin record pages (2026-10)
- Layout (`components/record/RecordPage`): back link ("← Parties" etc., list search, filters and page are kept), a header (leading visual, title, tags, muted meta line; the dirty status, Cancel and Save changes on the right) and two columns, `2fr 1fr`: form cards on the left, related read-only cards on the right. Every section is visible (no accordions). The header wraps when the title is long. Cards are `RecordCard`; `RecordLink` opens related records, switching the election first when needed. A failed load shows `RecordLoadError` with Try again; a 404, or a 400 for an id the server cannot parse, shows "<Record> not found" with no retry and no toast (`recordLoadErrorKind`). After a failed reload, the inline Try again is disabled while the form has unsaved edits. Server field errors show under their field on all four pages.
- Pages: Party (`/parties/:id`: identity, colour, symbol, ECI recognition, usage by election), Person (`/persons/:id`: biography, photo, census tags, election history, merge duplicates for SUPER_ADMIN), Candidate (`/candidates/:id`: affidavit fields, seat, read-only result strip, other candidates in the seat, master record with person linking; the linked person shows "N contests · first YYYY" from `person_contests` on `GET /admin/candidates/:id`), Constituency (`/constituencies/:id`: demographics, district, region, reservation, seat number, polling phase, tags, seat history and analysis).
- Create: "New party" and "New candidate" open a `FormDialog` (`PartyCreateDialog`, `CandidateCreateDialog`) with the same fields as before; the new record page opens after saving. Persons and constituencies have no create flow.
- Unsaved changes: `useUnsavedGuard(dirty)` stays on every editor ("Discard unsaved changes?" on the back link, sidebar links, the election picker, ⌘K and closing the tab). Blank optional fields save as null.
- New data (migration `017_record_pages.sql`):
  - `updated_at TIMESTAMPTZ` on parties, persons, candidates and constituencies (default `now()`, set by a trigger only when the row actually changes). Each admin detail response carries `updated_at`.
  - Last edited by: admin edits write audit rows (`PARTY_CREATE`, `PARTY_UPDATE`, `PERSON_UPDATE`, `PERSON_MERGE`, `CANDIDATE_CREATE`, `CANDIDATE_UPDATE`, `CANDIDATE_LINK_PERSON` (change person), `CANDIDATE_SPLIT`, `PERSON_MERGE_UNDO`, `PERSON_DELETE` (orphan cleanup), `CONSTITUENCY_UPDATE`; entity types `party`, `person`, `candidate`, `constituency`), holding only the changed fields. Detail responses gain `last_edit: { at, by } | null`, the newest of those record-edit rows for the record (other rows on the same entity, such as `SEAT_LOCK_TAKEOVER`, do not count). A failed audit write is logged and never fails the save. The Audit logs filters list the new actions and entities.
  - `parties.eci_recognition` (`National` / `State` / `Unrecognised`, NULL = not set): editable on the party page and a Parties list filter. `database/seed_party_recognition.sql` sets National for BJP, INC, BSP, CPI(M), AAP and NPP where it is still NULL (it runs on every `setup.sh`, so a value cleared in the admin comes back).
  - Polling phase: `constituencies.phase` is the only store. The migration copies `metadata->>'phase'` into it where the column is NULL, then removes the `phase` key from `metadata` where it held a valid phase (so a phase cleared in the admin is not copied back on the next `setup.sh`); unparseable legacy values stay in metadata untouched and are never copied. The admin reads and writes the column, and the service drops a `phase` key from any metadata patch, so it never writes `metadata.phase`.
- Derived endpoints (read only, not stored):
  - `GET /admin/parties/:id/usage`: per election, candidate count and wins; totals "N candidates · M elections"; each row links to `/candidates?election=<id>`.
  - `GET /admin/persons/:id`: contests with election, seat and party. The Won / Lost badge is derived in the admin (`WON` is Won; any other status on a Finalized election is Lost; a Finalized contest with no result row shows no badge; otherwise the status as stored), plus an Incumbent tag.
  - `GET /admin/candidates/:id/result`: votes, vote share (of all votes in the seat), position, status, margin (winner: `results.margin`; others: vote gap to the winner, never above 0), a "Result declared" flag for Finalized elections and the other candidates in the seat (NOTA last). Seats with no vote counts (for example TN 2021, margins only) show "No vote counts recorded" and still list the candidates.
  - `GET /admin/constituencies/:id/history`: the same seat (state, election type, `const_no`) across elections, newest first, with winner, margin and turnout where known, and "Party changed K times in N elections". A seat with no earlier elections gets an empty list, not an error. Does not depend on Compute analysis.
- Dropped from the Stitch screens: see `docs/design/admin/NOTES.md`.

### Admin redesign: dashboard, login, admin pages, legacy CSS removed (2026-10)
- Dashboard (`/`), cards gated by role, refreshed every 30 s while the tab is visible:
  - SUPER_ADMIN and EDITOR, for the top-bar election:
    - KPIs: seats declared N / M, leading (with the party ahead in most seats), pending, last update (IST, "N min ago · Round R"), all from the admin live results
    - a Live console card: % of seats reporting, and who is editing which seat from the seat locks
    - System health: `/admin/status` for SUPER_ADMIN, the public `/health/ready` for EDITOR
    - Feedback: "N new", with three previews (kind badge, first line, page path as plain text, relative time)
  - SUPER_ADMIN only: Recent activity, the last 10 audit entries in readable sentences
  - VIEWER: only an elections overview (Live / Upcoming / Finalized). It never calls an admin endpoint.
  - Each card has its own loading, error ("Try again") and empty state.
- Login:
  - centred card with the real logo and show/hide password
  - errors by status: 401 and 400 → "Invalid email or password"; 429 → "Too many attempts — wait a minute and try again"; network → "Network error — check your connection"
  - a signed-in visit to `/login` redirects; after sign-in you return to the page you asked for (`ProtectedRoute` keeps it in the route state)
- Feedback (`/feedback`, panel at `/feedback/:id`):
  - status chips and paging (50) on the server
  - Mark read / Resolve / Mark new per row and in the panel, busy per row
  - the panel shows the full message, a mailto email and the page path as plain text
  - the page steps back when an action empties the last page
- Users (`/users`, panel at `/users/:id`, create at `/users/new`):
  - search over the list (max 200, "Showing first 200")
  - edit name, email, role and an optional new password, saved together (an empty password is not sent)
  - one confirm dialog to delete
  - your own role and delete are disabled
  - shown inline in the panel, not as toasts: the last-super-admin refusal (403), a duplicate email (409) and field errors
- Audit logs (`/logs`, panel at `/logs/:id`):
  - action and entity filters list what the backend actually writes (result override, bulk seat save, seat-lock take-over)
  - From / To are IST days and both are included
  - From after To is refused
  - stale saved filters are reset
  - the admin name comes from the `users` relation ("Deleted user" when the account is gone)
  - rows stay on screen while refreshing
  - "Showing latest 200"
  - CSV fields are all quoted, include the before/after JSON and are guarded against spreadsheet formulas
  - the panel shows the full before/after JSON
- System status: Tailwind cards; "Refreshing…" only for a manual refresh; after a failed poll the last data stays with "Showing data from hh:mm:ss (IST)".
- Live Console and shell:
  - Declare won asks first
  - Save seat is disabled on a clean seat
  - the live pill turns rose "Live updates offline" after 3 failed reconnects in a row
  - Log out and the health dot link ask before discarding unsaved edits
  - list searches wait 300 ms and ignore stale answers
- Manifest editor: every section is always open (no collapse); all editors use the shared Tailwind controls; the map centre and the live-tab seat list can be typed normally.
- Legacy CSS removed:
  - `admin.css` and the `legacy` cascade layer are deleted; Tailwind preflight is on
  - `tw-ui`, `AdminPageHeader`, `FieldError` and the padded legacy `<main>` are gone
  - `src/theme/legacy-free.test.ts` fails if a legacy class or variable comes back, or a file with classes sits outside the `@source` paths
- Hotfix: seat-lock `const_id` now accepts real constituency ids (letters, digits, `_`, `&`, `-`, max 100) instead of UUIDs only; before this, seat locks never worked with real data.

### Party Symbols
- [x] DB: `eci_symbol_url` column on `parties` table (migration 006)
- [x] Admin: party table shows logo + ECI symbol thumbnails, symbol filter dropdown, stats
- [x] Scraper: `scrape-party-symbols.py` — downloads colored logos from Wikipedia + b&w ECI symbols from Wikimedia Commons for 46+ major parties
- [x] Directory: `frontend/public/symbols/logos/` and `symbols/eci/` for scraped SVGs
- [x] `PartyIcon.tsx` simplified: DB `symbol_url` is primary source, hand-drawn SVGs as fallback, no hardcoded `SYMBOL_FILES` set
- [x] `KeyBattlesTicker` supports `party_id` and `party_symbol_url` for proper icon display

### Party page (2026-10-08)
- [x] `/party/:id`: national view: profile header (mark, recognition, founded, HQ, leader, links), headline at each state's latest election (seats held of seats, states, governs, largest party), state chips, every state with won / contested, vote share, change since the previous comparable election (lineage applied; "—" for seats across a redraw), seats sparkline and state president; lineage timeline with sources; about
- [x] `/party/:id?state=XX`: state view: state unit (president, legislature leader, past presidents), election record (chart + table; lineage events inline, only where the other party ran; redraw dividers; "vs BJP + JVM(P) 2019" after a merger), where-it-won map (the election's own map, year picker, click → seat page), seat changes (held / gained from / lost to, splits tagged), its MLAs (all, with search), strongest regions; sticky jump links. A party that contested one state opens on it
- [x] API `GET /parties/:id/record` (from stored seat analysis; `?state=` adds MLAs, seat flow and regions); role holder photos and lineage sources on `GET /parties/:id` and `/parties/lineage`
- [x] Entry points: "Full party page →" in the dashboard party dialog; party names on the person and constituency pages (none for IND / NOTA)
- Spec `docs/superpowers/specs/2026-10-08-party-page-design.md`; e2e `frontend/e2e/party.spec.ts`

### Live viewer e2e, layer 1 (2026-10-08)
- [x] `npm run e2e:live` (frontend; own config `playwright.live.config.ts`, kept out of `npm run e2e`): mock ECI + the real worker + Playwright play a counting day and check the dashboard against the backend snapshot of the version on screen (`e2e/live/`; oracle `e2e/live/oracle.ts` = `useLiveAnalysis`' input to `analyseLive`)
- [x] Checkpoints C0–C6 on desktop (before results → Finalized), a phone pass (390×844) and a light-theme screenshot; screenshots in `frontend/e2e/artifacts/live/` (gitignored)
- [x] Test hooks: `data-seat` on map seats, `data-chip` on insight chips, `data-live-version` (the snapshot version on screen) on the dashboard
- [x] Found and fixed on its first runs: the Too close chip clipped off the end of the Overview strip (now first); a countermanded / adjourned seat's dialog showed a "Not started" call; the picker kept a finalized election pinned as Live; `sim:setup` left the manifest's seat ids pointing at the source election (key leaders stayed Pending)
- Spec `docs/superpowers/specs/2026-10-08-live-e2e-layer1-design.md`; how to run: `docs/LIVE_RUNBOOK.md` §5. Layers 2–5 (network, background tab, restarts, load, admin drills, real ECI adapter): `2026-10-07-live-dashboard-testing-notes.md`

### Live Election Simulation System
- [x] Simulation config with shared constants (`scraper/src/simulation/config.ts`)
- [x] Setup script: clones Bihar 2025 → fictional Bihar 2027 Live election (`scraper/src/simulation/setup.ts`)
- [x] Mock ECI HTTP server with per-seat 16–24-round vote progression (staggered starts, every seat declared by global round 24), lead flips, S-curve easing (`scraper/src/simulation/mock-eci-server.ts`)
- [x] Replay orchestrator: advances rounds, scrapes mock, advances the mock server's rounds; the live worker posts them through the ingest API (`scraper/src/simulation/replay.ts`)
- [x] Cleanup script: tears down simulation data in FK order (`scraper/src/simulation/cleanup.ts`)
- [x] ECI VS adapter `BASE_URL` made configurable via `ECI_VS_BASE_URL` env var
- [x] Vote progression: `easeInOutCubic` S-curve with ±5% noise, monotonic enforcement, LEADING→WON transitions
- [x] Close-race lead flips in rounds 6-12 for constituencies with < 5% margin
- [x] Mock server generates HTML matching real ECI format (Cheerio-compatible)
- [x] Results reach the DB through the ingest API (admin Live Console via SSE; viewers pick them up by polling the live version)
- [x] Reset script: zeroes results without deleting election structure (`scraper/src/simulation/reset.ts`)
- [x] Round tracking: `round_no` in override API + SSE event, round progress badge in Dashboard header
- [x] Pre-poll constituency modal: candidate list, seat history, dominance, incumbency, revision — all shown before counting
- [x] `normalizeConstId` uses const_no only for VS elections (fixes 18 name spelling mismatches across years)
- [x] Incumbent badge shows "Contesting" before counting, "Retained/Lost" after results
- [x] Candidate table hides vote/share/status columns when no votes yet
- [x] System status (admin, SUPER_ADMIN only): `GET /api/v1/admin/status` + admin page "System status". In-memory counters (single instance, reset on restart, O(1) per request): uptime/version/git sha/memory; HTTP totals by status class, 429 count, 5-min and 60-min request and 5xx rates (per-minute ring buffer), 10 slowest routes by p95 of each route's last ≤200 requests within 60 min (route templates, at most 300 routes tracked); cache hits/misses/Redis fallbacks; Redis pub/sub states and publish counts/errors; SSE connections, events published, result overrides (per min, last at); DB `SELECT 1` latency (2 s timeout) and pool `connection_limit`. No secrets or hostnames in the response, `Cache-Control: no-store`. Works with OTel off; MetricsService call sites feed both OTel and StatusService. Page auto-refreshes every 10 s while visible.

### Persons and candidates (migration 018, 2026-10-02)

Spec: `docs/superpowers/specs/2026-10-02-person-required-design.md`. Every candidate has a person; duplicates are fixed by merging.

| Record | Holds | Fields |
|---|---|---|
| **Person**: who someone is, across all elections | Identity | `name` (display name), `date_of_birth`, `gender`, `education`, `photo_url`, `bio`, `wikipedia_url`, `caste`, `religion` (admin-only, not in the public API), home `state_id` / `district_id` / `region_id` |
| **Candidate**: one run, in one seat, in one election | Candidacy only | `person_id` (required, `ON DELETE RESTRICT`), `election_id`, `const_id`, `party_id`, `name` as filed on the ballot (results and live ingestion match on it), `is_incumbent`, affidavit for this run: `age`, `assets`, `liabilities`, `criminal_cases`. The result lives in `results`. |

`candidates.metadata` and `persons.metadata` are no longer used. Migration 018 copied their keys into the columns once and archived every non-empty value (`candidate_metadata_archive`, `person_metadata_archive`); the columns stay until a later migration drops them, so the previous backend keeps working during the deploy (`docs/DEPLOYMENT.md` §5.0).

- **Triggers:**
  1. `AFTER INSERT` on `candidates`: when `person_id` is null, creates a person (ballot name, the seat's state) and sets `person_id`. `AFTER`, so seeds using `ON CONFLICT DO NOTHING` create no stray persons on re-runs.
  2. Deferred constraint trigger (`DEFERRABLE INITIALLY DEFERRED`): enforces NOT NULL at commit, so the insert in 1 can run first. Inserts without a person (seeds, scraper, simulation, admin "New candidate") keep working.
  3. `AFTER UPDATE OF person_id` / `AFTER DELETE` on `candidates`: deletes the old person once no candidates point to it (change, split, merge, and `seed_bihar_persons.sql` re-pointing on a fresh database). The admin writes an audit row for it.
- **Merge** (SUPER_ADMIN, Person page): moves all candidates from the duplicate to the keeper, fills the keeper's empty fields from the duplicate (never overwriting), deletes the duplicate, and saves a `person_merges` row (duplicate's full row, moved candidate ids, filled fields). Merging a person into itself is rejected.
- **Undo merge** (SUPER_ADMIN, "Merge history" card on the keeper's page; `POST /admin/persons/merges/:id/undo`): recreates the duplicate with its original id, moves the logged candidates back, restores the filled fields. Refused (409) if any of those contests moved again, or the keeper no longer exists; each merge is undone once. Merge history shows "Undone <IST date>" or "Can't undo: a contest has moved since". Chained merges (X into K, K into Z) undo newest first (`keeper_ref`).
- **Change person** (`PUT /admin/candidates/:id/person`, SUPER_ADMIN and EDITOR): moves one candidacy to another existing person. When it is the person's last contest, the move is a merge of that person into the target (logged, fills the target's empty fields, undoable by a super admin from the target's Merge history); the confirm says so and the response carries `merge_id`. **Split** (`POST /admin/candidates/:id/split`): moves it to a new person created from it; replaces "Unlink"; refused (409) when it is the person's only contest.
- **Contests filter** on the admin Persons list: All / 1 / 2+ contests / None, so single-contest persons do not crowd the list. None lists persons with no contest (made on their own, e.g. by `POST /admin/persons`), which no trigger removes; open one to merge it.
- **Run-once seeds:** `seed_bihar_persons.sql` and `seed_bihar_person_regions.sql` apply once (marker in `seed_runs`, migration 018, and skipped where their curated persons already exist or appear in the merge log), so a deploy never undoes admin curation. `seed_party_recognition.sql` and `seed_election_result_dates.sql` are run-once by marker.
- **Public search** (`GET /search/candidates`) returns the public candidate summary plus `election_id` (`CandidateSearchHitDto`: no affidavit, so no BigInt).
- Public site: every candidate has a profile; `PersonDetail` reads the top-level `wikipedia_url` and `bio`. After a merge, a CDN-cached profile or seat detail can link to the merged-away person for up to about 6 minutes (s-maxage 60 + stale-while-revalidate 300); that link 404s until the cache refreshes.
- Follow-up: scored duplicate matching and a review queue (`docs/design/admin/NOTES.md`).

## In progress

### Admin record pages (branch `feat/admin-election-picker`)
- Plan: `docs/superpowers/plans/2026-10-02-admin-record-pages.md`.
- **Admin API (derived, read only, SUPER_ADMIN / EDITOR):**
  - `GET /admin/parties/:id/usage`: candidates and wins (status WON) per election, newest year first, plus totals; 404 for an unknown party.
  - `GET /admin/candidates/:id/result`: the candidate's row and every row of its seat (votes desc, NOTA last). Share is of all votes in the seat, NOTA included (1 decimal, null when the seat has no votes). Position ranks non-NOTA candidates by votes; with no votes only the winner gets 1. Margin is `results.margin` for the winner (WON, else LEADING, else top by votes) and the vote gap to the winner (negative) for the others. `declared` is true for a Finalized election.
  - `GET /admin/constituencies/:id/history`: winners of the same seat (same state, election type and `const_no` columns) across elections, newest first, read from results, not `constituency_analysis`. Volatility counts party changes between consecutive elections that have a winner. Unknown id → 404; a seat with no state or no earlier elections → only the current row.
- Polling phase: the `constituencies.phase` column is canonical (1–20); a `phase` key in a metadata patch is ignored.

### Studio dashboard (redesign, branch `feat/fe-redesign`)
- Non-scrolling dark tile wall (1440×900 / 1280×720) and map-first mobile layout with a swipeable card rail.
- Tiles: top bar, map (layers, Map|Hex when `geo.hex_url` is set), scoreboard (compact ~148px tile), party standings, key leaders, stats + live ticker. Any tile expands to a focus overlay; `?layer=`, `?seat=`, `?focus=` make every view linkable.
- Layer insight lives in a footer bar inside the map tile (chips + expand; headline shown on non-Overview layers, chips double as the map legend on Overview). Map focus view is height-bound (no scroll; seat panel scrolls internally).
- Key leaders strip shows only the manifest leaders that fit its width (as many as fit, no fixed cap) plus a "+N more" chip opening the leaders focus view. The user's own tracked seats live in a Parties / Watchlist tab of the Party standings card (and its focus view); seats are tracked with the `☆ Track` toggle in the seat panel. One shared `watchlist_<electionId>` localStorage list (baseline-compatible key). On mobile the rail has a Watchlist card that opens the standings focus on the Watchlist tab.
- **Summary tab (default) in the side card** (tabs: Summary · <layer> | Parties | Watchlist; the card title follows the tab: Election summary / Party standings / Watchlist). It replaces the old "Election Summary" panel and mirrors it per map layer, in the old order: key stats (Declared, Avg margin, Median) on every layer; Overview: margin distribution, closest battles (10), biggest mandates (5), reserved seats (SC/ST, "–" for 0), vote share vs seats (alliances and parties sections: difference, vote %, seat %), wasted votes (lakh) with the efficiency gap; Battle: margin distribution, closest contests (the seat summary was removed 2026-10-02 as redundant); Swing: flipped seats (closest 15, total in the header), net swing by alliance; History: seat dominance, dominance by party, swing seats, anti-incumbency, incumbent win rate by party, notable defeats, party switchers, switch directions, notable switchers, margin trend, per-party trend; Reserved: category breakdown, wins by category, average margin by category; Insights: vote split analysis, one table per split, seat classification; States (LS): state leaderboard, sweep states, most competitive states. Margins use the old compact format (950, 21.1K, 1.2L). The card lists every section with every row inside a scroll area (see "Scrollable side-card tabs"); section headers stick to the top while their rows scroll. **Collapsible sections (2026-10-02):** the key stats always show; of the other sections only the first (e.g. Margin distribution on Overview) starts open, the rest are collapsed headers with their row count and a ▸; a click on a header opens/closes it (several can be open); switching layer starts over. The expanded ⤢ Summary view stays fully open. Rows highlight on the map on hover and lock on click (a single-seat row selects the seat); see "Precise Map Highlighting".
- MVVM: `src/model` (pure), `src/viewmodels` (hooks), `src/views` (Tailwind + Radix); boundaries enforced by `npm run lint`.
- **Summary focus view** (side-card expand, the map footer's expand button, or the mobile "insight" card): every section of the active layer with all its rows (cells in `[value, ...extra]` order under column headers, same number formats as the compact card), key stats as three large numbers, and the charts (margin distribution bar / grouped-by-alliance bar, margin trend and per-party seats line charts, Reserved wins / average margin by category grouped bars per alliance, Overview vote % vs seat % bars per alliance with the seat-minus-vote gap above each pair and an Alliances | Parties toggle; plain SVG with a visually hidden data table and `role="img"`). Layer pills inside the view switch the layer (kept on close). Sections sit in a 2-column grid (1 column below 1024px); only the dialog scrolls. Sections that have a chart also carry plain rows so the compact card can show them.
- **Mobile layout (<1024px, checked at 390x844 and 360x740)**: a single column of top bar, scoreboard, map (takes the remaining height, `flex-1 min-h-0`) and the card rail (fixed height, never shrinks), so nothing overlaps and the page never scrolls. The top bar is one row of at most 56px: app title (truncates), an election chip ("VS · Bihar 2025", built by `useTopBarVM.electionLabel`) that opens a bottom sheet with the LS/VS toggle and state / year (or LS election) pickers, a search icon that opens a top sheet with the focused search box, and a more button that opens a sheet with WhatsApp / X share and the language picker (44px touch targets). The scoreboard uses the short bloc labels (NDA / MGB, full name in `title`/`aria-label`). Rail cards are read-only glances: the Party standings card shows the top four parties (dot, short id, thin bar, seats) plus "+N more parties"; the summary card shows key stats as plain text. Rail card titles are fixed (Party Standings is always "Party Standings"; only the standings focus dialog title follows the Parties / Watchlist tab). Desktop is unchanged.
- Spec: `docs/superpowers/specs/2026-09-29-studio-dashboard-design.md`.

## Known Limitations

- **Live ECI ingestion is built but untested against a real counting day.** The worker (`scraper/src/live`, adapter `eci-web`) matches ECI's results site as of 2026; the page format may change. Rehearse per `docs/LIVE_RUNBOOK.md`; the simulation exercises the same ingest path with the mock server.

- **Estimated / incomplete seed data** (audit 2026-10-01; listed publicly on `/about`, source of truth `frontend/src/model/about/about.ts`, update it whenever a seed is corrected):
  - Synthetic votes: none left in Vidhan Sabha data (Bihar and the five states fixed on 2026-10-03).
  - LS 2024: `voter_turnout` / `total_electors` implausible (e.g. Lakshadweep 1,474,599 electors; in 294 seats the votes exceed electors × turnout).
  - Candidate coverage: all candidates in every Vidhan Sabha election (Bihar 2010–2025, five states 2011–2026); top 5 + NOTA in LS 2024. TN 2016 has 232/234 seats (2 postponed polls).

- **Detail screens:** affidavit columns (age, assets, liabilities, criminal cases) appear only where admins or seeds filled them; the counting round in the seat dialog can trail the vote numbers by up to a few minutes (CDN cache); turnout and vote-share change versus the previous election are not shown (no source yet).

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
- [x] Only available for elections with full candidate data (Bihar 2010–2025 have every candidate since 2026-10-03)

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
- [x] All use same `bihar_ac_2008.geojson` (post-2008 boundaries)
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
- [x] Affidavit seed generator (`scraper/src/generate-affidavit-seed.ts`, retired 2026-10-08: affidavits now come from `scraper/src/bihar/affidavits-cli.ts`)
  - DB-connected: queries candidates + person_id, no seed SQL parsing
  - Matches MyNeta candidates by const_no + normalized name, fuzzy fallback (Levenshtein ≤ 3)
  - Outputs `database/seed_affidavit_<slug>.sql`
  - Dual writes (superseded by migration 018: the metadata columns are gone and the affidavit is in typed columns on `candidates`)
  - Match report: exact/fuzzy/unmatched counts, person linking stats
- [x] Affidavit data: criminal cases (count + IPC sections + serious flag), total/movable/immovable assets, liabilities, education, profession, age, source URL
- [x] Data was stored in JSONB `metadata` columns (superseded by migration 018: typed `candidates.age/assets/liabilities/criminal_cases`)
- [x] Workflow: every candidate already has a person → run affidavit scraper → person history builds up across elections

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
- [x] Admin Parties page uses server-side search (debounced 300ms) + Prev/Next pagination (25/page)
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

### Delimitation-aware history and maps (2026-10-03)
- [x] `elections.delimitation` (migration 019, filled by `seed_election_delimitation.sql`; Lok Sabha 2029 left empty until its boundaries are known), editable in the admin election dialog (4-digit year or empty).
- [x] Seat history (`ConstituenciesService.history`), the seat analysis (`computeAnalysis` filters `history_election_ids`) and the public manifest (`history` + `history_years`, `compare_with`, filtered on read; the stored manifest is unchanged) compare only elections of the same type, state and delimitation. NULL compares with nothing. A seat with no comparable past result is classified `new` (it used to come out `stronghold` from its one win).
- [x] Seat page header shows "Boundaries redrawn in YYYY" when earlier elections of the state used other boundaries (`model/derive/delimitation.ts`).
- [x] Map files are versioned per delimitation (`/geo/<code>_ac_2008.geojson`, `/geo/india_pc_2008.geojson`; the Lok Sabha default is `LS_MAP_URL` in `model/geo/maps.ts`). Migration 019 rewrites old paths in stored manifests; old paths redirect. A redraw (e.g. Assam 2023) adds `as_ac_2023.geojson` and that election's manifest points at it.
- Not planned: notional results (old votes recomputed onto new boundaries) — needs booth-level data.

### About page and feedback (2026-10-01)
- [x] Public `/about` (`src/pages/About.tsx` → `views/about/AboutView.tsx`, form VM `viewmodels/about/useFeedbackForm.ts`): what MatdaanPulse is, "not an official source" disclaimer with a link to results.eci.gov.in, per-dataset data quality (Real votes / Partly incomplete / Votes estimated, with notes) from `model/about/about.ts`, how live counting works, feedback form, contact email (`CONTACT_EMAIL` in the same file). en/hi/mr/ta.
- [x] About page redesign (2026-10-03, Stitch `docs/design/frontend/about-page*.html`): built on `PageShell` (header, footer). Hero with counts derived from `DATA_SOURCES` (elections covered, Lok Sabha + N states), an amber disclaimer band, three "how live counting works" steps, and the data quality as an election × year matrix (`dataMatrix` in `model/about/about.ts`): each cell is a dot in its quality colour; picking one shows its source, quality and notes in the panel beside it (starts on the newest dataset). On phones the matrix scrolls inside its card with the state column pinned. Feedback and contact (with the fix-it-fast tips) sit side by side.
- [x] Linked from the desktop top bar ("About") and the mobile More sheet; the link passes the current path so feedback records which screen it came from.
- [x] Feedback form: type (bug / wrong data / suggestion / other), message 5–2000 chars, optional email, hidden honeypot field; 429 shows a "try again in a minute" message.
- [x] Backend `POST /api/v1/feedback` (stricter per-IP rate limit, honeypot posts dropped, salted IP hash instead of raw IP), table `feedback` (migration `016_feedback.sql`); admin `GET /admin/feedback`, `PATCH /admin/feedback/:id`, and an admin "Feedback" page with status filter (new / read / resolved).
- [ ] Support page (UPI QR / donations): planned, not started.
- [x] Logo: `logo-mark.png`, favicons and `apple-touch-icon.png` in `frontend/public` and `admin/public`; mark shown in the top bars and admin sidebar.

### Admin image upload (2026-10-02, branch `feat/admin-image-upload`)
- [x] Backend `POST /api/v1/admin/media` (SUPER_ADMIN, EDITOR): multipart `file`, `kind` (`party-logo` | `party-eci` | `person-photo`), `owner_id`. Bytes sniffed (PNG/JPEG/WebP/SVG); 1 MB for party kinds, 2 MB for person photo (413 above). Stored in Vercel Blob (public, random suffix) at `parties/<id>/logo.<ext>`, `parties/<id>/eci.<ext>`, `persons/<id>/photo.<ext>`; returns `{ url, pathname, content_type, size }`. Code: `backend/src/modules/media/`, `admin/controllers/admin-media.controller.ts`.
- [x] Without `BLOB_READ_WRITE_TOKEN`: 503 `MEDIA_0001` "Image upload is not configured" (rest of the API unaffected). A failed Blob write: 502 `MEDIA_0002` "Image storage failed" (the Blob error is logged as the cause, not sent). BusinessException 5xx are logged as server errors but keep their client-visible code and message. `owner_id` is any 1–64 char string (party ids like `JD(U)`); only the blob path sanitises it (`[^A-Za-z0-9_-]` → `_`, so `JD(U)` → `parties/JD_U_/…`). The SVG sniff regex is linear (no ReDoS) and accepts a DOCTYPE internal subset. No upload audit row: the field change is audited by the party/person update on Save. Replaced or cancelled uploads leave orphaned blobs.
- [x] Admin: party Symbols card (`components/ui/ImageUpload`: Party logo + ECI symbol tiles) and a 72 px round header photo (`components/record/PhotoButton`) on person and candidate pages. Click the image (dashed "Upload" box / initial when empty) to open the file chooser; hover/focus dims it with a camera hint ("Replace" on tiles). A small round ⓧ at the top-right corner removes it (only when set, no confirm). Tiles also accept a dropped file. While uploading a spinner covers the image and the button is `aria-disabled` (keeps focus, ignores clicks/drops). Errors show as one line under the image. On the candidate page the note "Updates the photo on ‹name›'s record — every contest shows it." is the photo's `title` tooltip and `aria-describedby`. No URL text inputs for images. The file uploads on pick; the record changes only on Save, Cancel restores. `hooks/useImageUpload`: latest request wins, ignored after unmount/owner change.
- [x] Photo lives on the person only. The candidate header photo edits the person's photo (shared by every contest), saved on Save via `PUT /admin/persons/:id` with only `photo_url` after the candidate fields; if that fails the photo stays unsaved with an inline error and Save retries just the photo.
- [x] `utils/asset-url.ts` `assetUrl()` resolves site-relative `/symbols/...` paths against `VITE_PUBLIC_SITE_URL`; every symbol/photo URL in the admin renders through it. `VITE_PUBLIC_SITE_URL` is mandatory in the admin production build (see `docs/DEPLOYMENT.md`).
- [ ] Rule for ECI photos (D7): ECI may be a photo source but only fills `persons.photo_url` when empty; it never overwrites an admin-set photo. Not implemented: live ingest (below) writes results only, never photos.

### Detail screens (2026-10-02, branch `feat/detail-screens`)

One set of screens for drilling into a seat, a party or a person, shared by every dashboard entry point: the seat dialog (`?seat=`), the party dialog (`?party=`), the constituency page and the person page. Constituency and person pages are studio MVVM pages (`src/viewmodels/pages`, `src/views/constituency`, `src/views/person`); party marks render through `views/ui/PartyMark`. The legacy detail components (candidate table/card, party icon and symbol cache, old detail hooks) and the legacy header with its search bar are removed; every route is a studio screen and the detail pages scroll themselves. Stacked dialogs (seat over the map focus, party over the seat) dim the ones beneath. While the constituency detail loads, the seat dialog shows skeletons for the stats, the number/place chips and past winners; the live rows show at once. The party dialog's key candidates are the party's manifest leaders (matched to this election's candidates by name when the manifest has no seat), then its biggest wins: up to 8 cards in a snap-scrolling strip (`views/ui/ScrollStrip`) with Netflix-style edge arrows on hover and ←/→ keys. Each card shows the photo (from the seat's constituency detail, the party's candidate there), seat name, a Party leader badge, "Seat #N" and the status pill; a hover ☆ button tracks the seat on the dashboard watchlist. The party and seat dialogs end with a compact site footer (`views/ui/SiteFooter`). The "MatdaanPulse" wordmark is two-colour (`views/ui/Wordmark`: ink + saffron `--color-brand`) in every header and footer. e2e: `frontend/e2e/detail.spec.ts` and `dashboard.spec.ts`.

#### Seat dialog

- [x] Any seat click (map, search, leaders, stats, summary, watchlist) opens a seat dialog instead of focusing the map; the map focus view now uses the full width (the old side seat panel is removed). Desktop ≥1024 px is a centred Radix dialog, narrower screens a bottom sheet.
- [x] Contents: constituency number and reservation type, district · state, a Counting (with round N/M) or Declared chip, a Track toggle, stat tiles (electors, turnout, margin, phase; hidden when unknown), the top 5 candidates with photo, party mark, votes, share bar and Leading/Won pill (+N others row), past winners with party marks, "3-way contest" / spoiler notes, and a link to the full constituency page. Candidate names link to the person page; the party cell opens the party dialog.
- [x] Live numbers (votes, status, margin) come from the dashboard's versioned snapshot, so rows appear at once; the facts (electors, turnout, phase, round) come from the CDN-cached constituency detail endpoint and refetch on every new live version while counting. A failed detail keeps the rows and shows "Details unavailable". No "updated X ago" is shown, as the detail can be older than the snapshot.
- [x] Party marks use the party logo, then the ECI symbol, then a colour dot. New `--color-warn` / `--color-warn-text` theme tokens style the notes.

#### Party dialog and party marks

- [x] Party dialog, URL `?party=<id>`: opened from the party mark button in each standings row, the party button on each key-leader card and watchlist row (a separate button beside the seat button; party-less rows have none), and the party cell in the seat dialog (it stacks over the seat dialog, which it dims; closing it leaves the seat dialog open). On the constituency and person pages the party name links to `/election/<id>?party=<party>` (on the person page the link sits outside the contest card's link). The mobile rail's watchlist glance stays non-interactive. Desktop is a centred dialog, narrower screens a bottom sheet. An id that is neither in the party list nor in this election's results opens nothing.
- [x] Contents: party mark, short name and recognition (National / State / Unrecognised party), "This election" Won / Leading / Contested / Vote share tiles with a seats bar against the majority line, a profile card (leader, founded year, headquarters, alliance from this election's alliance groups, website and Wikipedia links, description; empty fields are hidden), and the party's key candidates, each opening that seat. The profile comes from the party endpoint; if it fails the dialog still shows the election numbers.
- [x] Party marks (logo, then ECI symbol, then colour dot) now appear in the standings rows, the watchlist rows, the key-leader cards and the map hover tooltip (which also shows the SC/ST type and the seat's state: the PC map state for Lok Sabha, the election's state for Vidhan Sabha). The standings row keeps its lock/highlight button; the mark is a separate details button.

#### Studio constituency page

- [x] `/election/:electionId/constituency/:constId` rebuilt in the studio style on a shared page shell (slim top bar with logo and back link, scrolling column). Not-found (404), error and loading states are shown in the shell.
- [x] Header: breadcrumb (election, state, district), seat name, "No. N · SC/ST" chip, Declared / Counting chip, Track (shares the dashboard watchlist for that election) and Share.
- [x] Tiles: head-to-head for the top two candidates (votes, share, margin), seat facts (electors, votes polled, turnout, phase, region, district, counting progress from round/total rounds; empty facts are hidden), and a locator map of the seat (the seat's state for Lok Sabha).
- [x] All candidates table (no cap, NOTA last): rank, candidate (links to the person page), party mark, votes, share bar, Won/Leading pill, age, assets, liabilities and criminal cases (amber chip only when above zero). Below 1024 px the table becomes stacked candidate rows (rank, photo, name, party, votes, share bar, pill and a one-line affidavit summary such as "Age 64 · Assets ₹4.8 Cr · Liabilities ₹32 L · Criminal cases 1", parts without data left out). Live votes come from the versioned snapshot while the election is upcoming or live (it follows the /live status), and the counting round refetches on every new live version.
- [x] Seat history (past winners with margin, vote share and runner-up) and insights (three-way contest, spoiler) appear only when there is data. No ECI/ADR sourcing claims, AI copy or adjacent seats.

#### Studio person page

- [x] `/person/:id` rebuilt in the studio style on the shared page shell (scrolling column; not-found (404), error and loading states shown in the shell).
- [x] Header: photo (initials when none) with the current party's mark as a badge (party of the most recent contest), name, party, an "Incumbent" chip when the latest contest is an incumbency, a facts line (age from date of birth, gender, education, district and state; each hidden when unknown), a Wikipedia link and the full biography. Gender `M`/`F`/`O` (or Male/Female/Other) is translated; any other stored value is shown as is. Caste and religion are never shown.
- [x] Stats: contests, wins, win rate (wins over decided contests, i.e. finalized or already won; hidden when none are decided) and parties contested for, with the latest party switch ("RJD → BJP in 2014") under it.
- [x] Contest timeline, newest first: one card per contest linking to the constituency page, with party mark, votes, vote share, margin, a Won / Leading / Trailing / Pending / Lost pill (Lost only once the election is finalized) and "First contest under <party>" on the first contest under each new party.
- [x] Affidavit tile (hidden when no contest has affidavit values): latest assets and liabilities, criminal cases (amber chip only when above zero), a grouped bar chart of assets and liabilities by affidavit year (inline SVG) and the per-year list.


### Live results ingest (2026-10-03, branch `feat/live-ingest`)
Spec `docs/superpowers/specs/2026-10-03-live-ingest-design.md`; operations in `docs/LIVE_RUNBOOK.md`.
- [x] Ingest API for the counting-day worker: `/api/v1/ingest/elections/:id/{roster,config,lease,seats,tally}` with Bearer machine keys; the worker is the only writer of live results (migration 020)
- [x] Machine keys (`mpk_...`): SUPER_ADMIN creates and revokes them on Admin -> Ingest keys; stored as sha256, shown once
- [x] Shards and leases: named seat sets plus an implicit `rest` shard; a worker holds a shard by a 90 s lease, renewed by a 30 s heartbeat while a cycle runs and re-claimed before every posted chunk (a 409 ends the cycle cleanly), so a backup worker takes over within 90 s
- [x] One active source per election (null = paused), with per-shard source overrides; writes from any other source are refused
- [x] Holds: a seat correction holds the seat for `hold_minutes` (default 10) or until a later round; Holds panel releases early
- [x] Admin Live Console: Feed panel (source select / Paused / Other, hold minutes, confirmed switch, shard table: job, lag, recent counts, rejected list, tally badge), Shards... dialog, Holds panel, seat editor with Seat state and "On hold until ..."; Admin -> Ingest keys page; Elections -> Reopen for corrections (`POST /admin/elections/:id/reopen`, SUPER_ADMIN)
- [x] Admin routes: `/admin/elections/:id/ingest` (GET/PUT), `/ingest/sources`, `/ingest/shards/:name` (PUT/DELETE), `/holds` (GET, DELETE `:constId`), `PUT /admin/elections/:id/seats/:constId`
- [x] Alerts (lag, lapsed lease, rejected seats, refused requests, tally mismatch) shown in the console and posted to `INGEST_ALERT_WEBHOOK_URL` (optional, `{ text }`; repeats at most every 15 min; marked sent only after the webhook returned 2xx, so a failed post is retried next minute); `GET /api/v1/health/ingest` (memoised 10 s, no lease holder, counts only)
- [x] Rejected seats persist (`seat_ingest_state.last_rejected_reason` / `last_rejected_at`, migration 021) until the seat is next applied or unchanged; a rejected seat that was never applied has a row with no `state`, invisible to viewers
- [x] Refused requests (`no_lease`, `inactive_source`, `not_live`) are logged to `ingest_log.refused` (migration 021) and alert as "refused: no_lease ×N in last 5 min"; a Live shard with a source that never posted lags from the feed settings' `updated_at`, so the lag alert fires
- [x] Ingest and admin seat corrections serialise per seat (`pg_advisory_xact_lock`, sorted); ingest reads seat state, holds and results rows under the lock, so a correction made during a batch keeps the seat held
- [x] Seat rules also reject `missing_result_rows` (a roster candidate without a results row), votes or rounds past INT (`invalid_votes` / `invalid_round`); a seat sent without a round keeps its stored round
- [x] Tally: the `rest` shard (or `scope: "election"`) compares every seat of the election; only the worker's `rest` loop posts it by default (`tasks[].tally` overrides); unmapped party-wise rows are logged
- [x] Snapshot carries per-seat `state` and `rounds`; live-results returns `seat_state`; the public seat chip shows Counting (Round N/M), Declared, Countermanded, Adjourned
- [x] Worker `scraper/src/live/`: `npm run live -- --config live.config.json` (env `INGEST_KEY`, `INGEST_API_URL`, `LIVE_HOLDER`); `npm run live:check -- --election <id> --source eci-web [--shard rest]` prints READY / NOT READY; adapters `eci-web` (`baseUrl`, `stateCode`, `intervalMs`, `partyAliases`, `fetchTimeoutMs` default 15 s) and `mock-eci`; example `scraper/live.config.example.json`. Seats are posted up to 500 per request (the API max, `POST_CHUNK`), so a state (UP: 403 seats) is one request — one transaction, one snapshot version for viewers — per cycle (measured locally: 403 seats ≈ 0.7–2 s, ~260 KB; `ingest-batch.db.spec.ts`). The adapter's per-seat bookkeeping is committed per delivered chunk, only for seats the server took (held / rejected seats are sent again); each cycle logs its duration (WARN over 60 s); the client retries 5xx, 408 and 429 (honouring `Retry-After`)
- [x] Counting-day scale fixes (2026-10-08): `/live` and `/results` skip the per-IP throttlers (the CDN serves viewers); `results?v=` and seat detail `?v=` ahead of the current version → `404 GEN_0006 no-store` (cheap, "not yet": the poller retries on its next poll without counting a failure; the seat page loads the unversioned detail; the detail carries `seat_state`); seat detail `GET /elections/:id/constituencies/:constId?v=<version>` (v = current while Live → immutable if the DB version is still v after the read, else no-store; older → 302 to `?v=<current>`; not counting → status policy, never immutable); Finalized elections' unversioned reads and the party record → `s-maxage=3600, stale-while-revalidate=86400` (`CACHE_CONTROL.FINISHED`), `/parties` → same TTL (`REFERENCE`, only the 7 public columns read); each verified snapshot version's gzipped body is replayed from an in-process 32 MB LRU (`SnapshotBodyCache`); seat advisory locks in one statement; Prisma P2024 / P2028 → `503 GEN_0005` + `Retry-After: 2` (was 409); results purges no longer SCAN versioned keys
- [x] Logging, errors and health (review 2026-10-08):
  - Access log = the first Express middleware (`accessLog`, `common/logger/logging.middleware.ts`): one flat JSON line per request (`requestId`, `method`, `route` template, `url` (redacted), `statusCode`, `duration`, `ip`, `election_id` when the path has one, `auth: true` when an Authorization header was sent; never the user agent or the header value). Requests answered before Nest (origin shield 403, ingest key gate 401/429, body limit 413) are logged too, with the request id their error body carries.
  - Load shedding (`LoadSheddingException`: DB pool full `503 GEN_0005`, live stream cap `503 GEN_0009` + `Retry-After: 5`) is a warn without a stack, at most once a minute per code; pool rejections are counted (`serviceBusy503`, admin System status "DB pool full 503").
  - Prisma: every log is an event routed to the app logger (no plain-text stdout), errors/warnings once a minute per message, first line only; the error filter logs Prisma errors as class + code + first line, without the stack (the rest can render query arguments); the debug query log has no parameters; `LOG_LEVEL` is case-insensitive everywhere.
  - Error codes: a bare 400 → `GEN_0003` (`VALIDATION_9001` only for DTO validation, with `fields`), 413 → `GEN_0007`, 429 → `GEN_0008` ("Too many requests; please wait and try again").
  - `unhandledRejection` / `uncaughtException` → one JSON `fatal` line with the stack, traces flushed (≤ 2 s), exit 1 (`common/lifecycle/process-handlers.ts`).
  - `/health/ready`: 503 `unhealthy` only when the DB fails; Redis down → 200 `degraded`; one answer shared for 2 s (`HEALTH_MEMO_MS`).
  - Tracing (when enabled): `ParentBased(TraceIdRatio)` sampler (`OTEL_TRACE_SAMPLE_RATIO`, default 0.05), health probes and preflights not traced, no Express middleware spans, `request.id` on the server span.
- [x] API shape fixes (2026-10-08): `GET /search/constituencies` returns the public seat summary (`ConstituencySearchHitDto`: no `metadata` / `updated_at` / `region_id`, `voter_turnout` a number, `district: { id, name }`, so the dashboard search shows the district again)
- [x] API shape fixes (2026-10-08): `GET /elections/:id/manifest` returns `{ election_id, draft }` only (`draft` = the published manifest, parsed and comparable-filtered; the raw `manifest_url` text is no longer sent); `GET /elections/:id` returns the election summary fields only (no `manifest_url` / `manifest` / `summary`, which no client read there; two fewer queries per miss)
- [x] API shape fixes (2026-10-08): `GET /parties?q=` alone is honoured (bare array filtered by name / id / abbreviation); no params → bare array of every party (CDN-cached); any of `page` / `limit` / `election_id` / `state_id` / `eci_recognition` → paged envelope (also filtered by `q`)
- [x] API shape fixes (2026-10-08): unversioned `GET /elections/:id/results` rows carry `person_id`, like the `?v=` snapshot rows
- [x] Simulation runs through ingest: `sim:mock-eci`, `sim:setup`, `sim:live`, `sim:replay`, `sim:smoke`, `sim:cleanup`
- [x] Removed: `/admin/results/override` and `/admin/results/override-bulk`; the old scraper stubs (`scheduler/`, `normalizer/`, `eci-adapter.ts`, `cache/`)

### Live ingest security hardening (2026-10-08)
- [x] No leaks: `GET /api/v1/health/ingest` no longer returns each shard's `source` (it returns `paused: boolean`); the lease 409 (`INGEST_0004`, also on refused posts) and `GET …/config` no longer name the current lease holder, only `expires_at`. The worker logs `lease held by another job until …` / `lease lost to another job (held until …)`; holder names stay in the admin Feed panel
- [x] Election-scoped, expiring keys (migration 026: `ingest_keys.election_id` → elections ON DELETE CASCADE, `expires_at`): `POST /admin/ingest-keys` takes `election_id` (required) and `expires_at` (optional, default now + 7 days, at most 90 days, must be in the future; unknown election 404, taken name 409 `INGEST_0011`). The ingest guard answers 401 `INGEST_0009` for an expired key and 403 `INGEST_0010` for another election's key; keys from before 026 (NULL election / expiry) still work everywhere. Admin -> Ingest keys picks the election (default: the selected one) and the expiry (1–90 days presets) and lists election, expiry and an `expired` badge. `sim:setup` scopes its key to the sim election, expiring in 7 days
- [x] Gate before the 5 MB ingest parser (`ingestKeyGate` in `app.setup.ts`, replacing `requireBearerHeader`, which only the ingest path used): anything but `Bearer mpk_` + 43 base64url chars is 401 `INGEST_0001` without parsing; an IP with `INGEST_AUTH_FAIL_LIMIT` (default 10) failed key checks in a minute (malformed, unknown, revoked or expired; counted by the gate and `IngestKeyGuard` in `IngestAuthLimiter`, in memory per instance, at most 10 000 IPs) gets 429 `INGEST_0012` with `Retry-After` before parsing, unless its key was verified on that instance in the last 10 minutes. `IngestKeysService.verify` caches successful lookups for 30 s (failures never): a revoke applies at once on the instance that made it and within 30 s elsewhere
- [x] Lease take-overs are visible: a claim that changes a shard's holder (another key or holder name, after expiry or after a release; never a first claim or a renew) writes an `INGEST_LEASE_TAKEOVER` audit row (system, no user; old/new holder and key) and raises a warn alert "Shard X changed hands: A → B" for 10 minutes (Feed panel + webhook, once per take-over; `ShardStatus.takeover`). Admin shard put / delete and hold release write `INGEST_SHARD_UPDATE` / `INGEST_SHARD_DELETE` / `INGEST_HOLD_RELEASE` audit rows; Audit logs labels them
