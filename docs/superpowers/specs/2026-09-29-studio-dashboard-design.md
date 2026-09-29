# Studio Dashboard Redesign — Design Spec

- **Date:** 2026-09-29
- **Branch:** `feat/fe-redesign` (baseline for comparison: tag `fe-baseline-v1`, served on :3086)
- **Scope:** the public election dashboard (`/election/:id`, and `/` once an election is selected). Constituency detail page, person page and home are **out of scope** and get their own specs later.
- **Design reference (Google Stitch project `7025431006647439600`):**
  - Desktop: "TV Studio Results Wall (Updated)" — screen `0d72e44e01b84200b5f0d35ed2f03a4f`, with the bottom split into two full-width rows (leaders row, stats row).
  - Mobile: "TV Studio Results Screen" — screen `c91ebbd345e34e65b4e81b4e6dbb45c1`.
  - Design system: "Election-Night Studio" — `assets/10287494040489820382`.
  - Stitch mockups contain some placeholder shapes (blocky map, dotted "river"). Everything numeric comes from the API; see §6.

## 1. Goal

Replace the current dashboard (map + collapsible sidebar) with a **TV election-night results wall**: every key fact visible at once, nothing hidden behind accordions, and any tile can be pulled into focus.

Success looks like:
1. At 1440×900 and 1280×720 the dashboard shows the whole grid with **no page scroll and no tile scrollbars**.
2. The headline result, party standings, leaders and key stats are readable **without a single click**.
3. Every feature the baseline dashboard offers still exists (parity checklist, §9).
4. On a phone, the map and scoreboard fill the screen and the other tiles are swipeable cards — still no page scroll.

## 2. Decisions already made (from the design discussion)

| Topic | Decision |
|---|---|
| Look | Election-night studio: dark only. No light theme, no light/dark toggle. |
| Scrolling | None on desktop or mobile. Tiles show what fits and end in a "+N more" row. |
| Hidden content | No accordions / collapsibles for core info. |
| Focus | Every tile has an expand control (⤢). Expanded tile = focus overlay over the dimmed grid; only there may content scroll. `Esc`, click outside or ⤡ closes. |
| Map | Normal-sized tile (not full-bleed), expandable to full screen. |
| Mobile | Map + scoreboard fill the screen; other tiles are a swipeable card rail at the bottom; tap to focus. |
| Map/Hex | Toggle in the map tile header. Hex cartogram is **phase 2** (§8). |

## 3. Layout

### 3.1 Desktop grid (≥ 1024px wide)

The dashboard root is `100vw × 100vh`, `overflow: hidden`, CSS grid, 12px gaps and padding.

```
┌──────────────────────────────────────────────────────────────────────┐
│ TOP BAR  logo · LS|VS · state ▾ · year ▾ · search · status · share · lang │  48px
├───────────────────────────────────────┬──────────────────────────────┤
│ MAP TILE                          ⤢   │ SCOREBOARD TILE           ⤢  │
│ layer pills · Map|Hex                 │                              │
│                                       ├──────────────────────────────┤
│                                       │ PARTY STANDINGS TILE      ⤢  │
│                                       │                              │
├───────────────────────────────────────┴──────────────────────────────┤
│ LAYER INSIGHT STRIP (content follows active map layer)          ⤢    │  ~56px
├──────────────────────────────────────────────────────────────────────┤
│ LEADERS STRIP                                                   ⤢    │  ~64px
├──────────────────────────────────────────────────────────────────────┤
│ STATS STRIP  declared · closest · biggest win · flipped · TICKER     │  ~64px
└──────────────────────────────────────────────────────────────────────┘
```

- Columns: map column `minmax(0, 1.4fr)`, right column `minmax(360px, 1fr)`.
- Rows: `48px auto(1fr) 56px 64px 64px`. The map row takes all remaining height.
- Right column: scoreboard fixed height (~220px), standings take the rest.
- Minimum supported desktop size: 1280×720. Between 1024 and 1280 wide the right column narrows to 340px; standings/leaders show fewer items.

### 3.2 Mobile (< 1024px wide)

Root is `100dvh`, no scroll:
1. Floating top bar (logo, election chip ▾, search icon, language).
2. Scoreboard tile (compact).
3. Map tile (fills remaining height), layer pills scroll horizontally inside the tile.
4. Card rail (~150px): horizontal CSS scroll-snap row of cards — Layer insight, Party standings, Leaders, Stats — first card fully visible, next one peeking, page dots. Tapping a card opens its focus view as a full-screen sheet.

### 3.3 Focus overlay

- Opens from any tile's ⤢ (and on mobile by tapping a card).
- The tile animates (scale/position, ~200ms) to a centered panel ~90vw × 88vh (full screen on mobile) over a dimmed, blurred grid.
- Content inside may scroll. Focus is trapped; `Esc` / close restores focus to the ⤢ button.
- URL reflects focus: `?focus=standings|leaders|insight|stats|map`, so focused views are shareable and the back button closes them.

## 4. Tiles

Each tile = `<Tile title actions onExpand>` shell + a body component with a **compact** view (grid) and an **expanded** view (focus). Compact views never scroll: list-like bodies measure available height (ResizeObserver) and render `N` items + a "+M more" row.

| Tile | Compact (grid) | Expanded (focus) | Data source (existing) |
|---|---|---|---|
| **Top bar** | LS/VS switch, state & year pickers, search, status chip ("Final result · 243/243 declared" / "● LIVE · 180/243"), share, language | — | `Header`, `SearchBar`, `useElection` |
| **Map** | D3 choropleth, layer pills (Overview, Battle, Swing, History, Reserved, Insights; States for LS), Map/Hex toggle, zoom ±/reset, compact legend, hover tooltip | Full-screen map + right side panel showing the selected seat's detail (candidates, votes, margin, history, AI summary) or, with nothing selected, the layer summary | `InteractiveMap`, `useMapRendering`, `MapTooltip`, `MapLegend`, `useConstituencyDetail`, `ConstituencyModalSubComponents` |
| **Scoreboard** | Alliance names + badges, HUGE seat numbers (NDA 202 / MGB 34), vote %, "Others N", stacked seat bar with "N to win" marker | Alliance breakdown: each alliance's member parties, seats, vote %, head-to-head comparator | `useDashboardData` (alliances, vote share), `AllianceTally` logic |
| **Party standings** | Rows: party badge, short name (+ full name if room), bar, seats; ends "+N more parties · M seats" | Full table of all parties (seats, vote %); clicking any row highlights that party on the map (replaces the old alliance filter / "+ Party" picker) | `useDashboardData` |
| **Layer insight** | One-line headline + clickable chips, per layer (§5) | Full layer analysis (today's `summary/*Section` content, restyled) | `useAnalysis`, `useHistoryAnalysis`, `summary/*` logic |
| **Leaders** | Leader cards that fit: avatar/initials, name, seat, party badge, status (Won/Lost/Leading/Trailing + margin) | All watchlist leaders + user's tracked seats (star) | manifest `watchlists`, `WatchlistPanel` logic, `tracked_{electionId}` localStorage |
| **Stats** | 4 stat tiles + ticker: Declared N/total · Closest contest (seat, margin, party) · Biggest win · Seats flipped vs previous election · Ticker | Lists: 10 closest contests, 10 biggest wins, all flipped seats, full live feed | results + analysis (§6) |

### 4.1 Cross-linking

- Hovering a standings row, insight chip or leader card highlights the related seats on the map; clicking locks the highlight (shown as a removable chip on the map tile).
- Clicking a seat on the grid map opens the map focus view with that seat's detail.
- Search result → opens map focus on that seat.

### 4.2 Live behaviour

- SSE (`useSSE` + `utils/liveUpdates`) updates tiles in place (no refetch storm; the existing 4s debounce stays).
- Changed seats pulse once on the map; changed tiles pulse their border once.
- Ticker shows the latest events ("RJD leads in Raghopur · round 12/24"). For finalized elections it shows a static "All N results declared".
- Live toasts (`LiveToast`) are **replaced** by the ticker on desktop and mobile (no overlapping toasts on a no-scroll wall); on mobile the ticker is the Stats card in the rail.

## 5. Layer insight content

| Layer | Headline | Chips (each filters/highlights the map) |
|---|---|---|
| Overview | "NDA 202 · MGB 34 · Others 7" | Top parties by seats |
| Battle | "Median margin N · X seats won by < 1,000" | Margin buckets: < 1k, 1–5k, 5–10k, > 10k |
| Swing | "111 of 243 seats changed hands vs 2020" | Top from→to flows, e.g. "RJD → JD(U) 31" |
| History | "N strongholds · N swing seats" | Stronghold / loyal / swing / anti-incumbency buckets |
| Reserved | "SC N · ST N reserved seats" | Reserved seats by winning alliance |
| Insights | "N seats where a third party exceeded the margin" | Spoiler parties |
| States (LS only) | "States led by NDA N · INDIA N" | States by leading alliance |

If a layer has no data for the election (e.g. no previous election for Swing), the layer pill is hidden, as today.

## 6. Data rules

- Every number comes from the API / derived from API data. **No invented numbers.** Stitch placeholders (turnout, "women elected", seat-change deltas) are not built unless the data exists.
- Stats available today (verified against Bihar 2025): declared count, closest contest (min margin among WON), biggest win (max margin), seats flipped vs previous election (by `const_no`), top flip flows. **Turnout and gender are not stored** → not shown.
- "Others" vote % = 100 − sum of listed alliances' vote %, computed in one helper.
- Previous election for Swing comes from manifest `compare_with` / `history` (existing logic).

## 7. Visual system

Tokens replace the current light palette in `src/theme/` (one token file, dark only):

- **Surfaces:** page `#0A0F1E`, tile `#111933`, tile border `#1E2A4A` (1px), radius 16px, no heavy shadows.
- **Text:** primary `#F4F6FB`, secondary `#8C96B0`.
- **Accent:** `#8B7CFF` (selection, focus rings, expand controls only). **Live:** `#FF3B3B` dot + "LIVE".
- **Type:** Barlow Condensed (numbers, headlines; tabular figures), Inter (labels, body), Noto Sans Devanagari / Tamil fallbacks for hi/mr/ta. Self-hosted via `@fontsource/*` (no runtime Google Fonts dependency).
- **Party colours:** the database `parties.color` stays the source of truth. Colours that clash on dark (JD(U) vs RJD, HAM(S) vs BJP, AIMIM vs RJD) are fixed **in the data** (a seed/migration update), not overridden in the frontend. The frontend applies only a small brightness lift for dark backgrounds.
- **Map on dark:** dark canvas, party fills, margin-based opacity (safe = solid, close = dim), hovered seat white outline, state borders subtle.
- **Motion:** focus zoom ~200ms ease-out; live pulse once; respect `prefers-reduced-motion`.
- **Styling approach (decided 2026-09-29): Tailwind CSS v4 + Radix primitives (shadcn/ui style), Vite and D3 kept.**
  - `tailwindcss` + `@tailwindcss/vite`; the tokens above are defined once as CSS variables and exposed through Tailwind's `@theme`, so Tailwind classes, D3 map code and any remaining legacy CSS all read the same values.
  - Radix primitives (unstyled, accessible), copied/owned in `src/ui/` shadcn-style: `@radix-ui/react-dialog` (focus overlay), `react-tabs` / `react-toggle-group` (layer pills, Map|Hex), `react-select` (state/year pickers), `react-tooltip`. Helpers: `clsx` + `tailwind-merge` via a `cn()` util.
  - Stitch's Tailwind HTML is the starting point for each view, translated into React components that use our tokens (no raw hex values in class names).
  - **Preflight (Tailwind's CSS reset) stays OFF** while legacy pages (constituency detail, person, home) still use `index.css`, so they don't change by accident. It is enabled once those pages are migrated and `index.css` is deleted.
  - No full component library (MUI/Chakra/Mantine) and no meta-framework (Next.js/Remix).

## 8. Hex cartogram (phase 2, not in this build)

The Map|Hex toggle needs a per-state hex layout (each seat → hex cell), which doesn't exist yet. Phase 1 ships the toggle **only when** a layout file (`public/geo/hex/{state}.json`) exists — so it is hidden everywhere at first. Generating layouts (algorithm or hand-tuned per state) is a separate spec.

## 9. Parity checklist (baseline → redesign)

Every item must work on :3080 as on :3086 before the old dashboard code is deleted:

- [x] LS/VS switch, state and year selection, last-election memory
- [x] Global search (seats, candidates) → opens the seat
- [x] Map layers: Overview, Battle, Swing, History, Reserved, Insights, States (LS)
- [x] Alliance / party filters and the party comparison ("+ Party") → click-to-highlight on standings/scoreboard, alliance breakdown in the scoreboard focus view
- [x] Hover tooltip, click → seat detail, zoom/pan/reset, labels by zoom
- [x] Alliance tally with majority mark; party standings with vote %
- [x] Leaders & watchlist; tracked seats (star, localStorage)
- [x] Election summary stats
- [x] Live: SSE updates, pulse on change, live status, reconnect
- [x] Share (WhatsApp / Twitter) → share control in the top bar
- [x] i18n: en / hi / ta / mr for every new string
- [x] Link to the full constituency page and person page
- [ ] **Intentionally dropped:** light theme and the theme toggle

## 10. Architecture — MVVM

The redesign follows **Model–View–ViewModel**. In React terms: the **Model** is plain TypeScript (data access + pure domain logic), **ViewModels** are hooks that turn model data and user intent into view-ready state, and **Views** are presentational components that only render props and forward events.

### 10.1 Layers and rules

| Layer | Contains | May import | Must NOT |
|---|---|---|---|
| **Model** `src/model/` | `api/` (existing services: HTTP, SSE client), `types/` (domain types: Election, Party, Result, Alliance…), `derive/` (pure functions: scoreboard totals, standings, stats, flips, layer insights, "others" %, fit math), `live/` (existing `liveUpdates` reducer) | other model files only | import React, hooks, JSX or DOM APIs (except `api/` using `fetch`/`EventSource`) |
| **ViewModel** `src/viewmodels/` | Data hooks (existing `useDashboardData`, `useAnalysis`, `useHistoryAnalysis`, `useSSE`, moved here) and **one VM hook per tile**: `useScoreboardVM`, `useStandingsVM`, `useLayerInsightVM`, `useLeadersVM`, `useStatsVM`, `useMapVM`, `useTopBarVM`; plus the shared `DashboardStore` | model, React hooks, router (URL state) | return JSX, touch the DOM (except the map VM's size/zoom state), format for display in ways that belong to i18n |
| **View** `src/views/` | `dashboard/` (grid, tiles, focus overlay, mobile rail), `ui/` (Radix-based primitives: Dialog, Tabs, ToggleGroup, Select, Tooltip, `cn()`), `map/` (D3 renderer component) | `ui/`, VM **types**, i18n (`t()`), Tailwind | fetch data, import `model/api`, compute business values (winners, margins, flips), read/write localStorage or the URL |
| **Composition** `src/pages/` | Route components: call VM hooks, pass results to views. The only place VMs and Views meet. | viewmodels, views | contain business logic |

Dependency direction is one-way: **View → ViewModel → Model**. Enforced with an ESLint `import/no-restricted-paths` (or `boundaries`) rule so a violation fails lint. The frontend has no ESLint today; this work adds it (flat config, TypeScript + React hooks rules + the boundary rule) with an `npm run lint` script.

### 10.2 Shared dashboard state

`DashboardStore` (context + `useReducer`, in `viewmodels/`) holds cross-tile UI state: active layer, map mode (map|hex), selected seat, highlighted seats (from hover/locked chips), focused tile. It is synced to the URL (`?layer=swing&seat=…&focus=standings`) by one hook, so every view state is linkable and the back button works. Tile VMs read from the store and dispatch intents (`selectParty`, `lockHighlight`, `focusTile`, `selectSeat`); views never talk to each other directly.

### 10.3 The D3 map in MVVM

- `useMapVM` (ViewModel) produces the render input: features, fill colour + opacity per seat for the active layer, highlighted/selected ids, tooltip data, and intents (`onHover`, `onSelect`, `onZoom`).
- `MapCanvas` (View) owns the SVG and D3 imperatively, but only draws what `useMapVM` gives it — no result lookups or colour logic inside D3 code (today these live in `InteractiveMap`/`useMapRendering`; they move to `model/derive/mapFill.ts`).

### 10.4 Example: scoreboard tile

```ts
// model/derive/scoreboard.ts        — pure, unit-tested
export function deriveScoreboard(alliances: AllianceTally[], totalSeats: number): Scoreboard

// viewmodels/useScoreboardVM.ts     — hook
export function useScoreboardVM(): ScoreboardVM   // { blocs, others, majority, declared, onExpand, onSelectAlliance }

// views/dashboard/ScoreboardTile.tsx — presentational
export function ScoreboardTile(props: ScoreboardVM): JSX.Element
```

### 10.5 What happens to existing code

- **Moves to Model:** `services/*` → `model/api/`, `types/` → `model/types/`, `utils/liveUpdates`, `regionMatching`, `normalizeConstId`, `geoHelpers` → `model/`; calculations embedded in `summary/*Section.tsx`, `AllianceTally`, `ElectionSummary`, `InteractiveMap` → `model/derive/*` (extracted, with tests, before their components are deleted).
- **Moves to ViewModel:** `hooks/*` → `viewmodels/` (data hooks), plus new tile VMs and `DashboardStore`.
- **Reused as Views (restyled with Tailwind):** `MapTooltip`, `SearchBar`, `CandidateTable`, `ConstituencyModalSubComponents` (inside the map focus panel), `partySymbols` / `PartyIcon`.
- **New Views:** `DashboardGrid`, `Tile`, `FocusOverlay`, `ScoreboardTile`, `StandingsTile`, `LayerInsightStrip`, `LeadersStrip`, `StatsStrip` + `Ticker`, `MobileCardRail`, `MapCanvas`, `ui/*`.
- **Deleted after parity (§9):** old `Dashboard.tsx` layout, `AllianceTally`, `ElectionSummary`, `summary/*Section` presentation, `WatchlistPanel`, `KeyBattlesTicker`, `CollapsibleCard`, `ConstituencyModal`, `ThemeProvider` light/dark toggle, and the dashboard's rules in `index.css`.
- Legacy pages (constituency, person, home) keep working unchanged: moved imports get re-export shims until those pages are migrated.
- `docs/FEATURES.md` gets a "Studio dashboard" entry as the work lands (project rule).

## 11. Testing

- **Model (vitest, pure functions — most coverage lives here):** every `model/derive/*` function against fixture data from Bihar 2025 and LS 2024: scoreboard totals, standings + "+N more · M seats" footer, stats (closest, biggest, flips, "others" %), each layer insight (headline + chips), map fill/opacity, fit-count math.
- **ViewModel (vitest + `@testing-library/react` `renderHook`):** each tile VM with mocked data hooks — correct view state, intents dispatch to `DashboardStore`, URL sync round-trips.
- **View:** kept thin, so no per-component snapshot tests; covered by the browser checks below.
- **Architecture:** the ESLint boundary rule runs in CI/`npm run lint` so View→Model imports fail.
- **Browser checks (Playwright) at 1440×900, 1280×720 and 390×844:**
  - `document.scrollingElement.scrollHeight <= innerHeight` (no page scroll) and no tile body overflows;
  - focus overlay opens/closes with ⤢ and `Esc`, URL `?focus=` round-trips;
  - side-by-side screenshots vs the baseline on :3086 for Bihar 2025 (VS) and Lok Sabha 2024 (LS).
- **Live:** run the simulation (`scraper` `sim:*` scripts) and confirm ticker, pulses and in-place updates.

## 12. Out of scope

Constituency detail page, person page, home/landing page, admin panel, hex layouts (§8), turnout/gender data, 2026 elections scraping. Each is a follow-up.
