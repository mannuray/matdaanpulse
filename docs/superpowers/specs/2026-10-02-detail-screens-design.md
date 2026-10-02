# Detail screens: party logos, seat dialog, party dialog, constituency and person pages — design

Date: 2026-10-02 · Status: approved in chat, awaiting spec review

Designs: Stitch project "Election Tracker Redesign" (7025431006647439600); exported screens, HTML and the per-screen fix lists are in `docs/design/frontend/` (`NOTES.md` is part of this spec).

## Problem

- Parties have logos (`parties.symbol_url`, ~200 parties, plus admin uploads to Vercel Blob) and ECI ballot symbols (`eci_symbol_url`, 18 parties), but the studio dashboard shows only a colour dot. The only user of symbols is the legacy `components/atoms/PartyIcon`, which fetches data from inside a view.
- Clicking a seat anywhere dispatches `selectSeat`, which also sets `focus: 'map'` (`viewmodels/store/dashboardStore.ts:35`): the viewer gets the full-screen map dialog with a thin `SeatPanel` (candidates only). The pre-redesign `ConstituencyModal` (removed in `190cdb8`) showed a compact dialog with constituency info, stats, badges and the candidate table — that is what viewers expect.
- The backend holds party, candidate (affidavit), person and constituency information that the public site never shows, and the constituency and person pages are still legacy (pre-studio) pages.

## Decisions

| # | Decision |
|---|----------|
| D1 | Party mark = **logo** (`symbol_url`) → else **ECI ballot symbol** (`eci_symbol_url`) → else the **colour dot**. An image that fails to load also falls back to the dot. The hand-drawn SVG set (`components/atoms/partySymbols.tsx`) is dropped. |
| D2 | Marks appear next to party names (seat dialog, party dialog, standings, leaders/watchlist, map tooltip, constituency and person pages). Colour stays wherever colour is the data: map fills, alliance blocs on the scoreboard, vote-share bars, chart legends. |
| D3 | Three levels of detail: **map tooltip** (glance) → **seat dialog** (click a seat anywhere) → **full constituency / person pages**. A **party dialog** (no party page) opens from any party name. |
| D4 | Selecting a seat no longer opens map focus. The seat dialog opens over the dashboard; the ⤢ map expand stays as it is, minus the side panel. A seat clicked inside the expanded map opens the seat dialog on top. |
| D5 | Live numbers (votes, status, margin, round) always come from the versioned results snapshot the dashboard already polls (CDN-cached, `results?v=`). The detail endpoints supply only slow-changing data. A click never adds an uncached, per-viewer DB read on counting day. |
| D6 | Caste and religion are never shown publicly (already admin-only in `PersonProfileDto`; stays so). |
| D7 | Constituency and person pages are rebuilt in the studio style (MVVM, Tailwind) and **scroll normally**; the result and key facts sit above the fold. The no-scroll rule stays for the dashboard only. |
| D8 | Seat history is extended to store the runner-up (name, party) and the winner's vote share per year (backend `SeatHistoryStrategy`). |
| D9 | No copy that claims what the data isn't: no "ECI live / synced with ECI / verified via ADR", no AI analysis, confidence scores or round ETAs, no narrative text. Results are admin-entered. Fields without data are hidden, never shown as "—" placeholders (except per-cell gaps in tables). |
| D10 | Dialogs get a mobile bottom-sheet variant built from the desktop design (no separate Stitch screens); the two pages have mobile designs. |

## Screens

Per-screen corrections to the Stitch output are listed in `docs/design/frontend/NOTES.md` and are part of the requirements.

### Map tooltip (hover)

Seat name, state, SC/ST badge; leading/winning candidate with party mark and abbreviation; margin; "Round x/y" while counting (when `total_rounds` is known).

### Seat dialog — `seat-dialog.png`

Opens from the map, search, leaders, stats, summary and watchlist (everything that dispatches `selectSeat`). Centred dialog over the dimmed dashboard on desktop; `BottomSheet` on mobile (stat cells 2×2).

1. Header: name, "No. N · SC/ST" badge, "District · State", live status chip ("Counting · Round 12/24 · updated 2 min ago" / "Declared"), Track toggle, close.
2. Stats: Electors · Turnout · Margin · Phase (each hidden when unknown).
3. Ranked candidates: rank, photo (initials when none), name (+ "Incumbent"), party mark + abbreviation, votes, share % with bar, status pill only for LEADING / WON. Top rows plus "+N others" (rest of the votes summed).
4. Footer: past winners chips (year, mark, party, share), then the 3-way / spoiler note on its own row when the analysis flags it, and "Full constituency page →".
5. Candidate name → person page; party → party dialog.

Loading: live rows render at once from the snapshot; header facts / photos / history show a skeleton until the detail request returns. If it fails, the dialog still shows the live rows and a small "Details unavailable" line.

### Party dialog — `party-dialog.png`

Opens from a party name in standings, leaders/watchlist, the seat dialog and both pages. URL `?party=<id>` (shareable, like `?seat=`). Mobile: bottom sheet.

1. Header: large mark, full name, abbreviation, ECI recognition badge (`eci_recognition`), close.
2. This election: Won · Leading · Contested · Vote share (with change vs the previous election of the same type/state when known); seat bar won (solid) + leading (striped) with the majority mark.
3. Profile: Leader, Founded (year), Headquarters, Alliance (from this election's alliance groups), Website, Wikipedia; description. Empty fields hidden.
4. Key candidates: this party's entries in the leaders list (name, seat, Won/Leading); click → seat dialog. Hidden when none.

### Constituency page — `constituency-page.png`, `constituency-page-mobile.png`

Route unchanged: `/election/:electionId/constituency/:constId`.

1. Header band: breadcrumb (election › state › district), name, "No. N · SC/ST", live status chip, Track, Share.
2. Above the fold: **head-to-head** tile (leader vs runner-up: photo, mark, votes, share, status, margin bar incl. others/NOTA) · **seat facts** tile (electors, votes polled, turnout, phase, region, district; counting progress bar from `current_round / total_rounds` when known) · **locator map** (state outline, seat highlighted; from the geojson already loaded).
3. **All candidates** table: rank, photo, name (+ Incumbent), party mark + abbreviation, votes, share + bar, status pill (LEADING/WON only), Age, Assets, Liabilities, Criminal cases (amber chip when > 0). NOTA last, party cell empty. Mobile: stacked rows with a one-line affidavit summary.
4. **Seat history** (year, mark, winner, share, margin, runner-up) with the seat classification chip (Stronghold / Swing) · **Insights** tile (3-way, spoiler, turnout change when the previous turnout is known). Tiles hide when empty.

### Person page — `person-page.png`, `person-page-mobile.png`

Route unchanged: `/person/:id`.

1. Profile header: photo with current-party mark, name, current party, facts line (age from `date_of_birth`, gender, education, home district/state), Wikipedia link, full bio.
2. Stats: Contests · Wins · Win rate · Parties (with the switch, e.g. "RJD → BJP in 2014").
3. Contest timeline (newest first): election name + year, constituency, party mark, status (Leading / Won / Lost, Lost only once the election is Finalized), votes, share, margin; each card links to that constituency page. A party change is marked on the first contest under the new party.
4. Affidavit tile: latest assets and liabilities, criminal cases, a small chart of assets and liabilities per contest, and the per-contest list. Hidden when no contest has affidavit data.

## Backend

No new tables, no migration.

- **`GET /elections/:id/constituencies/:constId`** (`ResultsService.getConstituencyDetail`):
  - Candidates gain `age`, `assets`, `liabilities`, `criminal_cases` (rupees; BigInt sent as numbers via the existing `bigintTransform` / `common/util/json-safe.ts`, as `CandidateResponseDto` does) and `person.wikipedia_url`.
  - `party` trimmed to `id, name, abbreviation, color, symbol_url, eci_symbol_url`.
  - Adds `region` and `analysis` (from `constituency_analysis`: `dominance`, `dominance_party`, `incumbency.seat_history`, `incumbency.spoiler`, `incumbency.swing`).
  - Response through a DTO (`MapToDtoInterceptor`) so nothing else leaks. Cache stays `CACHE_CONTROL.PUBLIC`.
- **`SeatHistoryStrategy`**: each entry also stores `vote_share` (winner's share of the seat's votes), `runner_up` (candidate name) and `runner_up_party`. Existing analysis rows refresh on the next analysis run; the frontend tolerates entries without the new fields.
- **`GET /candidates/persons/:id`** (`PersonsService.findWithCandidates`): each candidacy gains `age`, `assets`, `liabilities`, `criminal_cases`, `vote_share`, `party_abbreviation`, `party_symbol_url`, `party_eci_symbol_url`. `PersonProfileDto` keeps excluding caste and religion.
- **`GET /parties/:id`**: used as is for the profile (check it returns `leader_name`, `founded_year`, `headquarters`, `website`, `wikipedia_url`, `description`, `eci_recognition`).
- Tests: service specs for the new fields, the trimmed party shape, the share computation (zero-vote seats → 0), and that caste/religion never appear.

## Frontend (MVVM)

**model** (pure)
- `partyMark(party): string | null` — D1 order; image URLs go through the existing asset-URL handling (relative `/symbols/...` and Blob URLs both work).
- Party meta map (abbreviation, mark) built from the one cached `getParties` call (replaces `model/api/partySymbolCache` + `services/partySymbolCache`).
- Derivations: seat dialog / page view data (share, "+N others", status pill rule), person stats (contests, wins, win rate, party switches), affidavit series, insight list from the analysis.

**store**
- `selectSeat` no longer sets `focus`. New `selectedParty` (+ `selectParty` action) synced to `?party=`. Closing focus no longer clears the seat.

**viewmodels**
- `useSeatDialogVM` (replaces `useSeatPanelVM`): live rows + `getConstituency` detail (cached per election+seat), loading/error states.
- `usePartyDialogVM`: `GET /parties/:id` + this election's alliance/vote-share numbers + leaders filtered by party.
- `useConstituencyPageVM`, `usePersonPageVM`: page data; the constituency page reads live numbers from the same versioned snapshot source as the dashboard.
- Standings, leaders/watchlist and tooltip VMs expose each row's mark and an `onSelectParty`.

**views**
- New: `ui/PartyMark` (img → dot fallback, sizes 16/24/64), `seat/SeatDialog`, `party/PartyDialog`, `constituency/*` and `person/*` tiles. Dialogs reuse a shared dialog shell (Radix Dialog desktop, `BottomSheet` mobile).
- Changed: map tooltip, standings / leaders / watchlist rows (mark + clickable party).
- Removed: `views/map/SeatPanel.tsx`, the map-focus `seatPanel` slot.

**pages**
- `pages/ConstituencyDetail.tsx` and `pages/PersonDetail.tsx` rebuilt as thin compositions of the new VMs and views. Legacy components used only by them are deleted (`ConstituencyModalSubComponents`, `CandidateTable`, `CandidateCard`, `atoms/PartyIcon`, `atoms/partySymbols`, the old hooks they use); anything still used elsewhere (e.g. `Header`, `ErrorBoundary`) stays.
- Tailwind: the new views live under `src/views`; if a page file uses classes, add its `@source` line in `src/theme/studio.css`.
- i18n: new keys in `en` and `hi` (and `mr`, `ta` fall back to English).

## Error handling

- Images: `PartyMark` and photos fall back (dot / initials) on error; no broken-image icons.
- Seat dialog: detail failure keeps the live rows (above). Unknown `?seat=` / `?party=` ids are dropped from the URL (as `?seat=` already is).
- Pages: not-found and error states in studio style; a person with no contests still renders the header.

## Testing

- Unit: `partyMark` fallback order; store (`selectSeat` leaves `focus`, `?party=` round-trip); seat-dialog derivation (share, "+N others", pill rule); person stats and party-switch detection; affidavit series; `PartyMark` image-error fallback.
- Backend: specs listed above.
- e2e (`frontend/e2e`): click a seat → seat dialog (not the map focus); open party from standings → party dialog, URL has `?party=`; constituency page and person page render with a mark, the candidate table and the timeline; mobile viewport opens bottom sheets.
- `npm run lint` (MVVM boundaries) passes.

## Docs

- `docs/FEATURES.md`: seat dialog, party dialog, party marks, rebuilt constituency and person pages.
- `CLAUDE.md`: note that the constituency/person pages are studio MVVM pages (no longer legacy).

## Out of scope

- A party page, party history across elections.
- Photos per candidacy (persons only, as decided in the image-upload spec).
- New data sources (ECI ingestion, ADR affidavits); affidavit fields are shown only where admins/seeds filled them.
