# Seat analysis rework: design

Status: **draft for review** (brainstorm 2026-10-07). Two phases: **A** (one engine, fixes, stored final analysis,
per-election summary, the one production recompute) unblocks the party page; **B** (baseline, seat timeline, live
analysis) is built with the live dashboard testing work (`2026-10-07-live-dashboard-testing-notes.md`) before counting
day, 27 Feb 2027. The stored shape is fixed in A, so production is recomputed once.

Out of scope here: the map's visual design (its own brainstorm later: overview = state of play, a Battle layer =
movement, hex glyphs were floated), the "who won" profile (women, age, assets, cases; affidavits are partial),
by-elections, new dashboard tiles. UI changes in this work are only what keeps current screens working on the new
shape (dashboard layers and Summary, constituency page, seat dialog, admin analysis card).

## 1. Why

Today's analysis (`backend/src/modules/constituencies/`, strategies registered as `ANALYSIS_STRATEGIES`) has:

- **Two engines.** The backend stores analysis for Finalized elections; the browser recomputes its own
  (`frontend/src/viewmodels/data/useHistoryAnalysis.ts`, `model/derive/intelligence.ts`) for other elections and as
  a fallback (`viewmodels/sources/useDashboardSources.ts:73`). They disagree (e.g. "new" = no comparable past winner
  on the server, = only one winner in the browser).
- **A bug.** `earlierComparableElectionIds` returns newest first, but swing and incumbency take the *last* id as
  "previous" (`swing.strategy.ts:12`, `incumbency.strategy.ts:16`). With no history given (the admin button) they
  compare with the oldest election. The CLI sends oldest first, so it happened to work.
- **Trigger drift.** The admin "Compute all analysis" button sends no history and no manifest, so spoiler and revision
  come out empty; the CLI sends both.
- **Thin output.** Only flipped / split per seat; nothing per party or per election. A "stronghold" is the party with
  the most wins even if it lost the seat since. Incumbency matches by normalised name. Seat history ignores lineage.
  Spoiler needs hand-made `vote_splits` (3 elections); revision is Bihar 2025 only. The frontend's
  `anti_incumbency` seat class is never produced.

## 2. The model: baseline → live → final

One pure module computes everything; three phases use it.

| Phase | What | Computed | Read by |
|---|---|---|---|
| **Baseline** (B) | What was known before counting: holder, streak, class before this election, sitting MLA and whether / for whom they re-contest, previous margin and shares, heavyweights, rematches, switchers, battleground | Server, once the candidate list is final, and on demand | `GET /elections/:id/baseline`, CDN-cached |
| **Live** (B) | Outcome (provisional), swing so far, too close to call, upsets, lead changes and momentum, live seat-flow and alliance tallies | The viewer's browser, at each results version | The dashboard |
| **Final** (A) | Everything settled, stored per seat and per election | Server, when the election becomes Finalized, and by the admin button / CLI (one path) | Historical pages, party page, constituency page |

Live and final run the same code on the same inputs, so the number a viewer saw on the last snapshot equals the
stored one (a test checks it).

## 3. The shared module

- **Files:** `backend/src/common/seat-analysis/*.ts` = `frontend/src/model/derive/seatAnalysis/*.ts`, kept
  byte-identical with a test on each side, like `comparable-parties.ts` / `comparableParties.ts`. It imports only the
  lineage rule (`comparable-parties`) and its own types. No Prisma, no React, no I/O.
- **Inputs** (plain data, assembled by a backend loader or a frontend viewmodel):
  - `election`: id, year, type, state, delimitation, date window (as `compareWindow` uses today);
  - `history`: the comparable earlier elections, **oldest → newest** (the module asserts the order by year), each
    with per-seat ranked candidates (person_id, name, party_id, votes, status) and its manifest alliances and
    `government`;
  - `previousAny`: the previous election of the same type and state **regardless of delimitation** (for party-level
    totals across a redraw; §4.2);
  - `current`: per-seat ranked candidates with status (WON / LEADING / TRAILING / …), seat reserved type, region,
    turnout, electors; Phase B adds round info and the seat trail;
  - `lineage` events, the current manifest (alliances, `government`, `vote_splits`, leaders, `cabinet`, `vip_seats`),
    party unit roles active at the election date.
- **Outputs:** `SeatAnalysis` per seat (§4.1) and `ElectionAnalysis` (§4.2); Phase B adds `SeatBaseline` and
  `SeatLive` (§5).
- **Rules shared by every field:**
  - Seats link across elections by `const_no` within one delimitation only (`comparable-elections.ts`); the first
    election after a redraw has no seat-level history (every seat `new`).
  - Party comparison goes only through `relation()` / `carryForward` from `comparable-parties` (rename / merger =
    same; split successor keeps history; the other faction holding the seat = `split`).
  - NOTA (stored as a candidate with `party_id = 'NOTA'`) is never a winner, runner-up or third candidate; it counts
    in totals and vote shares (share = votes ÷ all votes polled in the seat, NOTA included, as ECI reports).
  - The old engine (strategies, `useHistoryAnalysis`, `intelligence.ts`'s dominance / incumbency) is deleted.

### 3.1 Person matching

Rematch, incumbency, party switcher and revenge all need "the same person in two elections". Measured on the local DB
(previous winners found among the next election's candidates): person_id finds fewer than names do in every state
(TN 98 vs 284, KL 124 vs 255, UP 272 vs 454, MH 372 vs 392), because older elections are linked only where the person
link seeds reach. So:

1. Match by **person_id** first.
2. Fall back to the **normalised name within the same seat** (today's behaviour).
3. Then the normalised name **anywhere in the state's election**, only if that name is unique in that election.
4. Each match records `match: 'person' | 'name'`, so the UI and later data work can tell them apart.

Better person linking for older elections is separate data work (new `person_links` seeds); the module improves as it
lands, with no code change.

## 4. Phase A

### 4.1 Per seat (`SeatAnalysis`, stored)

`prev` = the newest comparable earlier election; absent after a redraw or for a first election.

- **Outcome:** `retained` | `gained` (with `from`: previous holder party) | `split` (with `from`) | `new` (no
  `prev`). Seen from the losing side, the per-election summary counts a `lost` (§4.2). `provisional: true` while the
  current leader is only LEADING (live use).
- **Vote swing:** the winner's party share now minus the same party's share in `prev` (carried through lineage; a
  party that did not contest = 0); and the previous holder's share change.
- **Class** (lineage-carried throughout; `holderStreak` = consecutive comparable elections won by the holder's
  party, ending with this one):
  - `new`: no comparable earlier election;
  - `stronghold`: the holder's party won every comparable election, and there are at least 3 (this one included);
  - `loyal`: `holderStreak` ≥ 2 and not a stronghold;
  - `swing`: the seat changed hands at this election.
  - Stored with `holder`, `holderStreak`, `since` (first year of the streak), `wins` / `total`.
  - `dominance` / `dominance_party` columns keep the class and holder, for the existing list endpoint.
  - The constituency page's `anti_incumbency` class is removed; "sitting MLA lost" comes from incumbency.
- **Incumbency** (§3.1 matching): the previous winner's `person_id` (or name), `match`, `recontested`, `seat` (`same` |
  the other `const_id`), `party` now, `switched` (party not comparable to their old one; following a split faction is
  `followedSplit`, not a switch), `won`. `recontested: false` = not a candidate anywhere in the election (no separate
  `denied` field).
- **Seat history:** per comparable election, oldest → newest: year, winner (name, person_id, party), margin, vote
  share, runner-up; each party also carries its **lineage family id** (`carryForward` to this election), so "JVM 2014"
  can render as BJP's line while keeping the real party.
- **Seat type:** `two-way` | `three-way` | `multi-cornered` (today's definition and values, kept).
- **Notes** (a list, rendered by the UI):
  - `spoiler`: the third candidate's votes exceed the winning margin (every election); where the manifest has
    `vote_splits` / alliances, the richer alliance note (which split hurt which alliance) replaces it;
  - `nota`: NOTA votes exceed the margin;
  - `rematch`: the top two are the same two people as in `prev` (either order);
  - `revenge`: the winner was the runner-up in `prev`, and `prev`'s winner contested this seat and lost;
  - `switcher`: a top-two candidate whose last earlier candidacy in the state (any seat, any comparable or older
    election) was for a party not comparable to their party now;
  - `heavyweight`: a candidate who is a manifest leader / cabinet member / `vip_seats` entry, or holds a party unit
    role in this state at the election date; carries the reason;
  - `bellwether`: §4.2.
- **Roll revision** leaves the engine. Bihar 2025's `revision` figures stay in its manifest and render as that
  election's seat note.

### 4.2 Per election (`ElectionAnalysis`, stored)

- **Party summary**, per party (and per lineage family after a split, as the "family total"): seats contested and
  won, votes and vote share; changes against `previousAny` (party totals compare across a redraw); `held` /
  `gained` / `lost` / `split` counts only against `prev` (seat-level, same delimitation).
- **Seat flow matrix:** previous holder party (resolved to this election's ids via `carryForward`) → winner party,
  counts; `split` moves listed separately. Empty after a redraw.
- **Alliance change** (only when both this and `prev`'s manifest have alliances): seats moving between alliances,
  moves inside an alliance, and alliance vote share swing. Alliances match by manifest alliance `id`, with the agreed
  rule that Congress-led UPA before 2023 counts as INDIA; anything unmatched is "others".
- **Close seats:** margin under 3% of the seat's votes; **narrowing seats:** margin % fell at each of the last 3
  comparable elections. (Phase B's battleground list = these, taken from the previous election.)
- **Bellwethers:** seats whose winner's side (party or alliance, lineage-carried) matched the manifest `government` at
  every comparable election, at least 3 of them, this one included. Computed only when every one of those elections
  has `government` filled; otherwise empty.
- **Breakdowns:** per party, seats won and vote share by reserved type (GEN / SC / ST), by region, and by
  turnout-change band (turnout vs `prev`, where both are known; turnout is filled for ~99.7% of VS seats).

### 4.3 New manifest field: `government`

- `government: { parties: string[]; label?: string; source: string }` lists the parties that formed the government
  **after these results**: the first government that took office and was not out before its floor test, counting only
  ministry or coalition parties (outside support excluded). A post-poll coalition fits (MH 2019 = SHS, NCP, INC).
  Later re-alignments, e.g. Bihar 2017 or Maharashtra 2022, are not recorded.
- It is filled for every seeded VS election by a fill-only seed (`seed_election_government.sql`, sets the manifest key
  only where empty; sources noted per row; generated from `scraper/data/government.json`) and is editable in the admin
  manifest editor (JSON tab).
- Missing → no bellwethers for that state.

### 4.4 Storage (migration 024, idempotent, no seed data dependency)

- **`constituency_analysis`** keeps its rows and key `(const_id, election_id)`. It gains:
  - `data JSONB` (the `SeatAnalysis`);
  - `schema_version SMALLINT`;
  - `computed_at TIMESTAMPTZ`.
- `dominance` / `dominance_party` stay (filled from the class). `incumbency` is no longer written. It stays readable
  as the fallback for rows not yet recomputed, and a later migration drops it (expand / contract, like `metadata`).
- **`notes` becomes admin-only and survives every recompute.** The compute upserts `data` / `dominance*` /
  `computed_at` and never touches `notes`; today's delete-and-reinsert goes. (No row has notes on the local DB;
  production is checked before the recompute.)
- **`election_analysis`** (new): `election_id` PK → elections, `data JSONB` (the `ElectionAnalysis`), `schema_version`,
  `computed_at`.
- `backend/prisma/schema.prisma` in sync; check with `prisma migrate diff`; the known drift
  (`candidates.person_id SET NOT NULL`, the `metadata` drops) is never applied.

### 4.5 Computing: one server path

- `SeatAnalysisService.compute(electionId)` loads the comparable history itself (oldest → newest), `previousAny`, the
  lineage, the manifest and the unit roles. It runs the module, upserts both tables in one transaction and purges the
  analysis caches.
- **Triggers:**
  - the election's status changing to Finalized (admin elections update);
  - `POST /admin/constituencies/analysis/compute/:electionId` (the body is ignored and dropped from the DTO);
  - the admin "Compute all analysis" button;
  - `scraper/src/recompute-analysis-cli.ts` (calls the endpoint without history).
  - All give the same result.
- **Public API:**
  - `GET /elections/:id/analysis` returns `{ const_id, dominance, dominance_party, data }` per seat;
  - new `GET /elections/:id/analysis/summary` returns the `ElectionAnalysis`;
  - both are CDN / Redis cached as today.
- **Compatibility:** Render deploys before Vercel, so for one release the per-seat endpoint also returns the old
  fields (`incumbency` JSON shape) built from `data` by an adapter. A follow-up removes them.

### 4.6 Frontend

- `useAnalysis` maps `data` into the existing maps (swing, dominance, incumbency, party switches); the views barely
  change.
- **Moved to Phase B (decided when planning, 2026-10-07):** running the shared module in the browser for elections
  that are not Finalized. It needs inputs the browser lacks today (person ids, lineage events, every candidate of the
  history), and the baseline (§5.1) brings exactly those. Until Phase B, `useHistoryAnalysis` stays the fallback for
  non-Finalized elections, so two engines remain only for elections that aren't Finalized. Phase B must land before
  counting day (27 Feb 2027).
- The constituency page and seat dialog read class, history (with lineage family), notes and incumbency from `data`.
- The admin analysis card shows the new fields and `notes` (editable through `PATCH`; no editor UI).

### 4.7 Rollout

1. Merge; deploy Render, then Vercel.
2. On production: check `constituency_analysis.notes`, take a backup (Neon snapshot), fill `government` (seed runs
   on deploy), then recompute every VS election once (`cd scraper && npx ts-node src/recompute-analysis-cli.ts --type VS`
   with production admin credentials).
3. Spot-check Bihar 2025 vs 2020 (previous = 2020, not 2010), a split (MH 2024: SHS / SHSUBT), a merger (JH: JVM →
   BJP), a redraw (AS 2026, JK 2024: every seat `new`, party totals still compared).
4. Remove the compatibility fields in a follow-up release.

## 5. Phase B

### 5.1 Baseline

- `SeatBaseline` per seat of an upcoming / live election:
  - previous holder (lineage-carried to this election's parties) and its alliance last time;
  - the class **before** this election (holder, streak, since);
  - sitting MLA (§3.1), re-contesting or not, seat, party now, `switched` / `followedSplit`;
  - previous margin and shares;
  - previous seat type;
  - rematch candidates;
  - switchers;
  - heavyweights;
  - battleground flags (close / narrowing last time).
- Stored in `election_analysis.baseline` (JSONB column added in migration 024 so Phase A fixes the schema). **Decided
  2026-10-07:** computed on demand (admin button / compute endpoint / CLI) and automatically when an election goes
  Live, with no hook in candidate CRUD; `live:check` reports NOT READY when it is missing or older than the latest
  candidate change.
- `GET /elections/:id/baseline` returns it, CDN-cached (it never changes during counting).

### 5.2 Seat timeline (migration 025)

- **`seat_rounds`:**
  - `election_id`, `const_id`, `seq` (per seat, increasing), `round_no`, `round_total`;
  - `leader_candidate_id`, `runner_up_candidate_id`, `margin`, `votes_counted`;
  - `observed_at`, `source` (`ingest` | `correction`);
  - PK `(election_id, const_id, seq)`.
- **Written in the same transaction as the results write**, only when the leader, runner-up, margin or status
  changed:
  - by `IngestService.write`;
  - by `SeatCorrectionService` (source `correction`, so a correction shows in the timeline);
  - a reopen appends, never rewrites.
- **The versioned snapshot carries a bounded trail per seat:**
  - the last 6 entries as `{ r, lp, m, v }` (round, leader party, margin, votes counted; `v` decided 2026-10-07, for
    comeback);
  - `lc`: lead changes so far;
  - `pk`: the largest margin so far.
  - This is at most ~50 KB uncompressed for UP's 403 seats.
  - The full timeline is `GET /elections/:id/constituencies/:constId/rounds` (short cache), for the seat dialog's
    sparkline.

### 5.3 Live (`SeatLive`, in the browser, each version)

- **Outcome** against the baseline, provisional while LEADING; swing so far.
- **Too close to call:**
  - remaining votes are estimated from round info (`votes_counted ÷ round_current × (round_total − round_current)`),
    or else from `total_electors × previous turnout − votes_counted`;
  - with neither, the seat is `counting` (no label);
  - `f = lead ÷ remaining`:
    - `too_close` when `f < 0.05`;
    - `likely` when `0.05 ≤ f < 0.2`;
    - `safe` when `f ≥ 0.2`;
    - WON seats are `declared`.
  - The thresholds are constants, tuned against simulation replays (`scraper/src/simulation/`) during Phase B.
- **Momentum** over the trail's last 3 entries:
  - `switched`: the leader changed within them;
  - `narrowing`: the margin fell by at least max(10%, 200 votes);
  - `widening`: it rose by as much;
  - `stable` otherwise.
  - `comeback`: the current leader trailed by more than 5% of votes counted at some point.
- **Upsets:** a stronghold's holder party trailing; a heavyweight trailing; the sitting MLA trailing.
- **Live tallies:** party summary, seat flow and alliance change (§4.2) on current leads + wins.
- **Live vs final:** on the final snapshot, the browser's result equals the stored final analysis (test).

## 6. Testing

- **Module (both sides, same fixtures):**
  - previous-election order;
  - retained / gained / split / new;
  - each class boundary;
  - redraw (seat `new`, party totals still compared);
  - JVM → BJP merger;
  - SHS / SHSUBT split (`split`, family total, `followedSplit`);
  - person vs name matching, including a non-unique name;
  - NOTA excluded from places;
  - spoiler generic and alliance;
  - rematch, revenge, switcher, heavyweight;
  - bellwether with a missing `government`;
  - breakdowns.
- **Identical-file tests**, backend and frontend.
- **Service (DB spec):**
  - triggers give the same rows;
  - `notes` survives a recompute;
  - a Finalized transition computes;
  - a Bihar 2025 regression (previous = 2020).
- **Phase B:**
  - ingest and correction write timeline rows only on change;
  - snapshot trail bounds;
  - too-close / momentum fixtures;
  - the live = final check on a replayed simulation.

## 7. Docs

- `docs/FEATURES.md`: replace the seat analysis section and the stale recompute notes.
- `CLAUDE.md`: the shared module rule (identical files) and the `government` manifest field.
- `docs/LIVE_RUNBOOK.md` (Phase B): the timeline and baseline steps.
- Party page notes: seat changes now read `ElectionAnalysis`.
