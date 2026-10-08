# Feature Guide — MatdaanPulse

A detailed walkthrough of every feature in MatdaanPulse, how it works under the hood, and how data flows through the system.

---

## Table of Contents

1. [Interactive Map (D3 Choropleth)](#1-interactive-map-d3-choropleth)
2. [Map Tabs](#2-map-tabs)
   - 2.1 [Overview](#21-overview)
   - 2.2 [Battle](#22-battle)
   - 2.3 [Swing](#23-swing)
   - 2.4 [History](#24-history)
   - 2.5 [Demographics (Reserved Seats)](#25-demographics-reserved-seats)
   - 2.6 [States](#26-states-ls-only)
   - 2.7 [Insights (Spoiler Analysis)](#27-insights-spoiler-analysis)
3. [Alliance Tally & Party Standings](#3-alliance-tally--party-standings)
4. [Election Summary](#4-election-summary)
5. [Constituency Modal](#5-constituency-modal)
6. [Watchlist Panel](#6-watchlist-panel)
7. [Live Updates (SSE + Toast)](#7-live-updates-sse--toast)
8. [Vidhan Sabha (State Election) Support](#8-vidhan-sabha-state-election-support)
9. [Manifest System](#9-manifest-system)
10. [Data Pipeline](#10-data-pipeline)

---

## 1. Interactive Map (D3 Choropleth)

**File:** `frontend/src/components/organisms/InteractiveMap.tsx`

The centerpiece of the dashboard — a zoomable, pannable SVG map rendered with D3.js.

### How it renders

1. **GeoJSON loading**: On mount (or election switch), fetches the GeoJSON file specified by `manifest.geo.map_url` (default: `/geo/india_pc_2008.geojson` for Lok Sabha). For VS elections, also calls `fitSize()` to auto-zoom to the state boundary.
2. **Projection**: Uses `d3.geoMercator()`. LS uses fixed India center `[82, 23]`. VS uses the manifest's `geo.center` and `geo.zoom`, then `fitSize()` for tight fit.
3. **Path rendering**: Each GeoJSON feature becomes a `<path class="pc">` element inside a `<g>` group. State boundaries (`india_states.geojson`) are drawn as `<path class="state">` on top (LS only).
4. **Zoom/pan**: `d3.zoom()` with scale extent `[1, 80]`. Transforms the `<g>` group. Stroke width adjusts inversely with zoom level so borders don't thicken.

### Region matching

The key challenge: matching API result IDs (like `BR_VS_131_KALYANPUR`) to GeoJSON feature properties (like `ac_name: "Kalyanpur"`).

`buildRegionLookup()` creates a multi-key `Map` indexed by:
- Uppercase full ID (`BR_VS_131_KALYANPUR`)
- Normalized name (stripped to alphanumeric: `KALYANPUR`)
- Number-qualified key (`131:KALYANPUR`) — handles duplicate names
- State-qualified key (`BIHAR:KALYANPUR`) — handles cross-state duplicates (Aurangabad, Hamirpur, Maharajganj)

`findRegion()` tries keys in priority order: number-qualified → state-qualified → name-only.

### Coloring

A single `getFill(feature, region)` function determines every path's fill color. It switches on `mapTab` and delegates to tab-specific logic. All recoloring happens in a `useEffect` that re-runs whenever `regions`, `mapTab`, `selectedPartyColors`, or tab-specific data changes.

### Interactions

- **Click**: Opens the constituency modal via `onRegionClick(id)`
- **Hover**: Shows `MapTooltip` (candidate name, party, margin)
- **Recent changes**: Paths with `recentChange: true` get a CSS `pulse` animation class

---

## 2. Map Tabs

Tab bar sits above the map. Each tab changes the fill logic and shows/hides a tab-specific legend and chip UI. Tabs are defined in `availableTabs` — some are conditional (Swing requires `compare_with`, History requires `manifest.history`, States hidden for VS).

### 2.1 Overview

**What it shows:** Every declared constituency colored by the winning party's color (solid fill).

**Coloring logic:**
- If no alliance/party chips selected: each seat gets its party color from `mapRegions`
- If chips selected: selected parties show their color, unselected still show their own color (not grayed out — Overview always shows full picture)

**Legend:** Colored acronym swatches for each selected entry.

**Footer:** Shows count of reporting constituencies.

### 2.2 Battle

**What it shows:** Margin-shaded comparison between selected alliances/parties.

**Coloring logic:**
- No chips selected → all seats gray
- Chips selected → matching seats colored with `blendWithWhite(color, marginIntensity(margin))`
  - Tighter margins = more white (faded), larger margins = deeper color
- Non-matching seats → gray

**Margin intensity** maps absolute vote margins to 5 tiers:
- LS: `< 5K → 0.10 | 5–25K → 0.30 | 25–75K → 0.55 | 75–200K → 0.80 | 200K+ → 1.0`
- VS: `< 1K → 0.10 | 1–5K → 0.30 | 5–15K → 0.55 | 15–50K → 0.80 | 50K+ → 1.0`

**Legend:** Full margin gradient per selected alliance/party, with bucket labels.

**Special:** When exactly 2 entries are selected, ElectionSummary shows a Head-to-Head comparator.

### 2.3 Swing

**Visibility:** Only when `manifest.compare_with[0]` exists (previous election to compare against).

**Data flow:**
1. Dashboard fetches previous election results via `getResults(prevElectionId)`
2. Builds `swingMap: Map<string, SwingEntry>` by matching constituencies via `normalizeConstId()` (strips `BR_VS_` / `BR_VS20_` prefixes)
3. For each seat: compares current winner's effective group (alliance if in one, else party) vs previous winner's group
4. `flipped = true` if groups differ

**Coloring logic:**
- Flipped seats → winner's party/alliance color (or filtered by chips)
- Held seats → light gray `#d4d4d4`
- No data → default gray

**Legend:** "Flipped" (green dot) / "Held" (gray dot).

**Footer:** Shows flipped seat count.

### 2.4 History

**Visibility:** Only when `manifest.history` array has election IDs.

**Data flow:**
1. Dashboard reads `manifest.history` (array of historical election UUIDs, oldest first)
2. Fetches all historical results in parallel via `Promise.all(historyIds.map(getResults))`
3. For each current constituency, collects winners across all elections by normalizing IDs
4. Classifies at **party level** (not alliance — alliances shift between elections):
   - **Stronghold**: one party won 3+ times (or all elections if ≤3)
   - **Loyal**: one party won exactly 2 times
   - **Swing**: no party won more than once
   - **New**: no historical match found (only current election data)
5. Tracks `dominantParty` (party with most wins) and `streak` (consecutive wins by current holder)

**Coloring logic:**
- Stronghold → full party color of dominant party
- Loyal → `blendWithWhite(partyColor, 0.6)` — faded
- Swing → amber `#f59e0b`
- New / no data → gray

Chip filtering works: if chips selected, only matching dominant parties show color.

**Legend:** Stronghold / Loyal / Swing swatches.

**Footer:** Shows counts per classification.

**Anti-incumbency** (also computed when History data available):
- Matches previous election winners to current candidates by normalized name (uppercase, trim, strip "ALIAS" suffix)
- Tracks: did the incumbent win again?
- Shown in ElectionSummary and Constituency Modal

**Party Switcher Tracker** (also computed when History data available):

Detects candidates who won in one election and then contested the next election on a different party's ticket.

*Data flow:*
1. Dashboard builds an ordered array of all elections: `[hist0, hist1, ..., current]` using `manifest.history` results + current `results`
2. `manifest.history_years` (parallel array, e.g. `[2010, 2015, 2020]`) provides year labels; `election.year` for current
3. For each consecutive pair (N, N+1):
   - Builds a winner map for election N: `normalizeConstId(const_id)` → `{ name, party }`
   - For each candidate in election N+1 on the same normalized seat:
     - Normalizes names (uppercase, trim, strip ALIAS suffix, strip non-alpha)
     - If names match AND parties differ → `PartySwitchEntry`
4. Produces `PartySwitchEntry[]` with: constId, candidateName, fromParty, toParty, fromYear, toYear, wonInNewParty, margin

*ElectionSummary sections:*
- **Quick stats**: Total switchers / won on new ticket / success rate %
- **Switch Directions** (Section, defaultOpen): Table grouped by "From → To" direction with count and won columns
  - `switcherDirections` useMemo groups by `${fromParty}→${toParty}`, sorted by count descending
- **Notable Switchers** (Section, collapsible): Table with name, party dots (from → to), year range, result (Won/Lost), margin

*Constituency Modal badge:*
- "Switched" pill badge with colored dots: `[dot fromColor] FromParty (year) → [dot toColor] ToParty (year) — Switched`
- `modalSwitchEntry` filtered from `partySwitchData` by `modalConstId`

**Margin Trend Over Time** (also computed when History data available):

Tracks how competitive elections are over time by computing average and median margins across all elections.

*Data flow:*
1. Dashboard `marginTrend` useMemo: for each election (all history + current):
   - Filters WON/LEADING results
   - Sorts margins, computes: average (mean), median (sort + midpoint), seat count
   - Uses `history_years[i]` for year, `election.year` for current
2. Dashboard `partyTrend` useMemo: for each election:
   - Groups winners by `party_id`
   - Per party: seats won + average margin
   - Produces `PartyTrendPoint[]` with: party, year, seatsWon, avgMargin

*ElectionSummary sections:*
- **Margin Trend** (Section, defaultOpen): Horizontal bar chart with one row per election year
  - Bar width = `avgMargin / maxAvgMargin * 100%`, color = `var(--accent)`
  - Shows formatted margin value (e.g. "21.1K") to the right of each bar
- **Per-Party Trend** (Section, collapsible): Table with parties as rows, years as columns
  - Each cell shows "**seats**/avgMargin" (e.g. "89/23K")
  - `partyTrendTable` useMemo filters to parties with seats in 2+ elections, sorted by latest year's seat count descending
  - Scrollable when many years/parties

### 2.5 Demographics (Reserved Seats)

**What it shows:** SC/ST/GEN seat reservation categories.

**Chips:** GEN / SC / ST toggle buttons with counts from GeoJSON `pc_category` / `ac_category`.

**Coloring logic:**
- No category selected → all gray
- Category selected + no party chips → white fill for matching seats
- Category selected + party chips → margin-shaded party color for matching seats in that category

**ElectionSummary:** Category breakdown, win rate by category per alliance, average margin by category.

### 2.6 States (LS only)

**Visibility:** Hidden for VS elections (already a single-state map).

**UI:** State dropdown + removable chips. Each selected state renders as its own zoomed-in mini-map (`StatesMiniMap` component) in a scrollable container.

**How mini-maps work:**
- Filters GeoJSON features by `st_name`
- Creates its own `d3.geoMercator().fitSize()` projection for that state's features
- Renders constituency paths with party coloring
- Each mini-map has a header showing party-wise seat counts

Main SVG is hidden (`display: none`) when States tab is active to prevent double rendering.

### 2.7 Insights (Spoiler Analysis)

**What it shows:** Vote-splitting and spoiler effects.

**Configuration:** `manifest.vote_splits` array defines spoiler parties:
```json
[
  {"spoiler": "AIMIM", "hurts": "MGB", "label": "AIMIM split"},
  {"spoiler": "BSP",   "hurts": "MGB", "label": "BSP split"}
]
```

**Spoiler detection logic:**
1. For each constituency with 3+ candidates:
2. Check if any `vote_splits` spoiler party's votes exceed the winner's margin
3. AND the runner-up belongs to the `hurts` alliance
4. If both true → seat is "spoiler-affected"

**Three-way detection:** 3rd candidate has ≥15% vote share.

**Coloring logic:**
- Spoiler-affected → winner's party color + hatched SVG overlay pattern
- Three-way → amber `#f59e0b`
- Two-way/safe → light gray `#e5e7eb`
- Fallback (no spoiler config): competitiveness gradient (blue = competitive, gray = safe)

**Legend:** Spoiler-affected (hatched swatch) / Three-way (amber) / Two-way (gray).

---

## 3. Alliance Tally & Party Standings

**File:** `frontend/src/components/organisms/AllianceTally.tsx`

**Data flow:**
1. Dashboard calls `getAlliances()` (per-party seat counts) and `getVoteShare()` (per-party vote percentages)
2. `buildStandings()` merges these with manifest alliance definitions to create `StandingsData`:
   - `groups`: Alliance groups (NDA, MGB, etc.) with aggregated seats + vote share
   - `independents`: Parties not in any alliance
3. Each group shows a stacked bar with per-party segments
4. Bar segments are shaded by margin vulnerability (lighter = thinner margins)

**Features:**
- Majority mark indicator line
- Expandable alliance groups showing member party breakdown
- "+" button to add/remove tracked alliances and individual parties
- Vulnerability insight: "NDA: 8 seats won by <5K" warning label
- Danger label when thin-margin flips could change majority outcome

---

## 4. Election Summary

**File:** `frontend/src/components/organisms/ElectionSummary.tsx`

A sidebar card showing tab-specific analytics. Content switches based on `mapTab`.

### Overview tab sections:
- **Quick stats**: Declared count, average margin, median margin
- **Margin Distribution**: Vertical bar histogram with LS/VS-specific buckets
- **Closest Battles**: Top 10 narrowest-margin seats
- **Biggest Mandates**: Top 5 largest-margin seats
- **Reserved Seats (SC/ST)**: Per-party SC/ST win counts
- **Vote Share vs Seats**: Disparity chart (vote % vs seat %) with alliance/party toggle
- **Wasted Votes**: Per-alliance wasted vote analysis + efficiency gap

### Battle tab sections:
- **Grouped Margin Distribution**: Side-by-side bar chart per selected alliance
- **Seat Summary**: Seats, close wins, avg margin per entry
- **Closest Contests**: Tightest battles among selected entries
- **Head-to-Head** (2 entries selected): Direct comparison with closest H2H battles

### Swing tab sections:
- **Flipped Seats**: Table of seats that changed hands (from → to, margin)
- **Net Swing by Alliance**: Gained / Lost / Net table

### History tab sections:
- **Seat Dominance**: Quick stats (strongholds, loyal, swing counts)
- **Dominance by Party**: Per-party stronghold/loyal breakdown table
- **Swing Seats**: List of seats that changed hands across elections, with winner history trail
- **Anti-Incumbency**: Re-contested / Won / Win Rate stats
- **Incumbent Win Rate by Party**: Per-party breakdown
- **Notable Incumbent Defeats**: Sorted by margin
- **Party Switchers**: Quick stats + direction summary + notable switchers table (see §2.4)
- **Margin Trend**: Horizontal bar chart + per-party trend table (see §2.4)

### Demographics tab sections:
- **Category Breakdown**: GEN/SC/ST seat counts
- **Win Rate by Category**: Per-alliance wins in each category
- **Avg Margin by Category**: Per-alliance average margin in SC/ST/GEN seats

### Insights tab sections:
- **Vote Split Analysis**: Quick stats (analyzed, three-way, spoiler-affected)
- **Per-spoiler tables**: Seats where spoiler party's votes exceeded winner margin
- **Seat Classification**: Two-way / three-way / multi-cornered counts

---

## 5. Constituency Modal

**File:** `frontend/src/components/organisms/ConstituencyModal.tsx`

A fixed-position overlay triggered by clicking any constituency on the map.

**Content:**
- Header: Constituency name + type badge (GEN/SC/ST) + "Full page →" link
- **Info chips**: State name, constituency number, phase
- **Numeric stats**: Total electors, votes polled, turnout %, win margin
- **Insight badges** (conditional):
  - **Swing flip**: "MGB → NDA Flipped" or "NDA — Retained" with colored dots
  - **Spoiler impact**: "AIMIM split 12,000 from MGB — margin was only 8,000"
  - **Seat type**: Two-way / Three-way / Multi-cornered
  - **Dominance**: "BJP Stronghold (2/2)" or "Swing Seat" (when history data available)
  - **Incumbency**: "Incumbent Nitish Kumar Retained" (green) or "Lost" (red)
  - **Party Switcher**: "RJD (2020) → BJP (2025) — Switched" with party color dots
- **Candidate table**: All candidates sorted by votes with vote share bars

**Navigation:** "Full page →" opens `/election/:id/constituency/:constId` route.

---

## 6. Watchlist Panel

**File:** `frontend/src/components/organisms/WatchlistPanel.tsx`

Shows VIP seats, party leaders, and cabinet members defined in the manifest.

- **Leaders**: e.g. "Nitish Kumar (JDU)" — shows their constituency result
- **Cabinet**: Role + name + constituency result
- **VIP seats**: Labeled seats of special interest

Each entry shows live result status (WON/LEADING/LOST) and is clickable to open the constituency modal.

---

## 7. Live Updates (SSE + Toast)

### Server-Sent Events

**Hook:** `frontend/src/hooks/useSSE.ts`

When election status is "Live", Dashboard subscribes to SSE endpoint for the election. Two event types:
- `result-update`: Single constituency result changed — triggers `refetchResults()` + toast
- `tally-update`: Alliance totals changed — triggers `refetchAlliances()` + `refetchVoteShare()`

### Toast Notifications

**File:** `frontend/src/components/atoms/LiveToast.tsx`

- Fixed bottom-right stack (max 5 visible)
- Each toast: party dot + party name + constituency name + margin
- Auto-dismiss after 5 seconds with `toast-out` slide animation
- Constituency names extracted from const_id by stripping state prefix

### Pulse Animation

Constituencies with recent result changes get a `pulse` CSS class that triggers a pulsing border animation for 30 seconds.

---

## 8. Vidhan Sabha (State Election) Support

The system supports both Lok Sabha (national, 543 seats) and Vidhan Sabha (state assembly) elections.

**Key differences handled:**

| Aspect | Lok Sabha | Vidhan Sabha |
|--------|-----------|-------------|
| GeoJSON | `india_pc_2008.geojson` (543 PCs) | Per-state, e.g. `bihar_ac_2008.geojson` (243 ACs) |
| Projection | Fixed India center | `fitSize()` on state bounds |
| Feature props | `pc_name`, `pc_category` | `ac_name`, `ac_category` |
| ID format | `BR_PATNA_SAHIB` | `BR_VS_131_KALYANPUR` |
| Margin buckets | 5K / 25K / 75K / 200K | 1K / 5K / 15K / 50K |
| States tab | Shown | Hidden |
| State boundaries | Drawn | Skipped |

**How it works:**
- `manifest.geo.map_url` tells the map which GeoJSON to load
- `electionType` prop (`'LS' | 'VS'`) switches margin buckets and hides/shows tabs
- `featureName()` / `featureCategory()` helper functions abstract over `pc_*` vs `ac_*` properties
- `buildRegionLookup()` handles VS ID prefixes: strips `VS_` or `VS20_` for matching

### Currently seeded VS elections:
- **Bihar VS 2025** — full candidate data (6 per seat), election ID `c3d4e5f6-...`
- **Bihar VS 2020** — winner + runner-up only, election ID `b2c3d4e5-...`

---

## 9. Manifest System

The manifest is a JSON blob stored in the `elections.manifest_url` column. It drives all election-specific UI configuration without code changes.

**Structure** (`ManifestData` type):

```typescript
{
  alliances: [                          // Alliance groupings
    { id: "NDA", name: "...", color: "#FF6B00", parties: ["BJP", "JDU", ...] }
  ],
  leaders: [{ name, party_id, const_id }],   // VIP leader watchlist
  cabinet: [{ name, role, party_id, const_id }],
  tracked: ["NDA", "MGB"],              // Default-visible alliances
  vip_seats: { "BR_VS_131": { label, candidate } },
  milestones: [{ label: "Majority", value: 122 }],
  compare_with: ["<prev-election-id>"], // Enables Swing tab
  history: ["<hist-election-id>", ...], // Enables History tab (oldest first)
  history_years: [2010, 2015, 2020],   // Parallel array — year labels for each history entry
  vote_splits: [                        // Enables Insights spoiler detection
    { spoiler: "AIMIM", hurts: "MGB", label: "AIMIM split" }
  ],
  geo: {                                // Map configuration
    map_url: "/geo/bihar_ac_2008.geojson",
    center: [85.5, 25.6],
    zoom: 8
  }
}
```

**How it's loaded:** `Dashboard` calls `getManifest(electionId)` → backend reads `manifest_url` column → parses JSON → returns as `{ draft: ManifestData }`.

**Adding a new election:** Insert election row + set `manifest_url` to a JSON string with the above structure. No code changes needed — the frontend adapts entirely from the manifest.

---

## 10. Data Pipeline

### Database schema (key tables)

- `elections` — id, name, type (LS/VS), year, status, manifest_url
- `constituencies` — id, election_id, name, const_no, type (GEN/SC/ST), state_id
- `candidates` — id, election_id, const_id, party_id, name, is_incumbent
- `results` — candidate_id, const_id, votes, status (WON/LEADING/LOST), margin
- `parties` — id, name, color
- `states` — id, name, code

### API endpoints used by Dashboard

| Endpoint | Returns | Used for |
|----------|---------|----------|
| `GET /elections/:id/alliances` | Per-party seat counts | Alliance tally bars |
| `GET /elections/:id/vote-share` | Per-party vote percentages | Vote share display, disparity chart |
| `GET /elections/:id/results` | All candidate results | Map coloring, swing, spoiler, history |
| `GET /elections/:id/manifest` | Manifest JSON | Alliance defs, tabs, config |
| `GET /elections/:id/constituencies/:cid` | Single constituency detail | Modal content |

### Seed data

Election data is loaded via SQL seed files in `database/`:
- `seed.sql` — 2024 Lok Sabha (543 seats, full ECI data)
- `seed_bihar_vs_2025.sql` — Bihar 2025 (243 seats, scraped from ECI)
- `seed_bihar_vs_2020.sql` — Bihar 2020 (243 seats, winner + runner-up)
- `seed_bihar_vs_2015.sql` — Bihar 2015 (243 seats, winner + runner-up)
- `seed_bihar_vs_2010.sql` — Bihar 2010 (243 seats, winner + runner-up)

### ECI Scraper

**Dir:** `scraper/src/`

- `adapters/eci-vs-adapter.ts` — Scrapes Vidhan Sabha results from ECI website
- `bihar/` — Bihar VS 2010–2025 seeds from ECI statistical reports (fetch → parse → cross-check → committed JSON → seeds)

---

## Appendix: Key File Map

| File | Purpose |
|------|---------|
| `frontend/src/pages/Dashboard.tsx` | Main dashboard — fetches data, computes derived state, renders layout |
| `frontend/src/components/organisms/InteractiveMap.tsx` | D3 map with all tab rendering logic |
| `frontend/src/components/organisms/ElectionSummary.tsx` | Tab-specific analytics sidebar |
| `frontend/src/components/organisms/AllianceTally.tsx` | Party standings stacked bar |
| `frontend/src/components/organisms/ConstituencyModal.tsx` | Constituency click modal |
| `frontend/src/components/organisms/WatchlistPanel.tsx` | Leaders & VIP watchlist |
| `frontend/src/components/organisms/StatesMiniMap.tsx` | Per-state zoomed mini-map |
| `frontend/src/components/atoms/LiveToast.tsx` | Toast notification stack |
| `frontend/src/model/types/index.ts` | All shared TypeScript types |
| `frontend/src/model/api/*.service.ts` | API client functions |
| `frontend/src/viewmodels/data/useApi.ts` | Generic data-fetching hook |
| `frontend/src/theme/index.css` | All styles (map-tabs, battle-chips, legends, etc.) |
| `frontend/public/geo/*.geojson` | Map boundary files |
| `database/seed*.sql` | Election seed data |
