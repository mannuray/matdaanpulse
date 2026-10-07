# Live map: showing the count as it moves (design)

Status: **draft for review** (brainstorm 2026-10-07). It draws the live signals that seat analysis Phase B computes
(`analyseLive`; `DashboardSources.liveAnalysis`): calls, momentum, lead changes, comebacks and upsets. It is a frontend
change only; the data and endpoints exist.

Stitch mockups (project "Election Tracker Redesign", 7025431006647439600; local copies in `.playwright-mcp/`):

| Screen | Stitch id |
|---|---|
| Desktop Overview, mid-count | `0b2199443acd4d57835764059329e6be` |
| Desktop Battle, mid-count | `01ffabeedaaa4043b747bf4729fbdfa9` |
| Seat dialog, mid-count | `61d96702a88c46d2a8f6a8e4c80e9333` |
| Mobile Overview | `448c33328ceb4c18b1e6cc19f7741f99` |
| Mobile Battle | `97964eded11043c58578129396e11542` |

The mockups use a stylised grid instead of the real map. Where this spec and a mockup differ, this spec wins (§6
lists the corrections).

## 1. Goal

On counting day, one look at the map shows the battle: who leads and how firmly (**Overview**), and where it is moving
(**Battle**). Viewers are on desktop and phones, in the dark studio look. The non-scrolling TV layout and the
no-accordion rule stay. After counting, every seat is declared and the dashboard is today's final-result view.

## 2. What exists and what changes

| Piece | Today | After |
|---|---|---|
| Overview fill | party colour, opacity 1 | party colour, **opacity by call** while live (§3.1) |
| Battle | party colour, 5 opacity steps by absolute margin; margin-bucket chips | **momentum colours** while live (§3.2); margin buckets when nothing is counting |
| Swing | flipped solid, held faded; flow chips | unchanged (works live from the baseline) |
| Pulse | one outline flash for every change, 3 s | **typed** flash: lead switch / declared / upset (§3.3) |
| Seat dialog | LiveChip "Counting · Round 8 of 20" | + round progress bar, call and momentum badges, margin trend chart, upset badges, narrowed line (§4) |
| Ticker | "won" / "lead" text | + "Lead switch" and "Upset" lines |
| Hex toggle | shown when `geo.hex_url` exists, but draws the real map | **hidden** until a hex renderer exists |
| `spoiler-hatch` SVG pattern | defined, unused | unused (stripes on the Overview were considered and rejected) |

"While live" means: the election is Live **and** `liveAnalysis` is present (a baseline exists). Without it, every layer
behaves as today.

## 3. Map layers

### 3.1 Overview: who leads, and how firmly

- **Fill:** the leading or winning party's colour, as today.
- **Strength:** from `SeatLive.call`.

  | Call | Look |
  |---|---|
  | `declared`, `safe` | opacity 1 |
  | `likely` | opacity 0.6 |
  | `too_close` | opacity 0.3 **plus a dashed outline in the party colour** (reads as undecided, not missing) |
  | `counting` (no estimate) | opacity 0.6 |
  | `not_started` | `--color-map-pending`, as pending seats are today |

- **Legend** under the map: **Safe · Likely · Too close · Not started**. No vote thresholds. A tooltip on the legend
  explains the rule: lead against the votes still to count.
- **Insight strip:** today's party chips, plus a **"Too close · N"** chip that filters the map to those seats (the
  existing chip filter mechanism). The chip is shown only while live and N > 0.
- **Hover card:** the existing map tooltip gains the call ("Too close") and, if the lead switched in the last trail
  points, "Lead switch". The mockup's "Flipped from RJD" line is the Swing layer's job and stays off the Overview card.

### 3.2 Battle: where it is moving

- **While live, fill by `SeatLive.momentum`**, ignoring party:

  | Momentum | Colour token | Value (dark theme) |
  |---|---|---|
  | `switched` | `--color-map-mo-switched` | accent violet, `#8A80FF` |
  | `narrowing` | `--color-map-mo-narrowing` | magenta, `#E04FB0` |
  | `widening` | `--color-map-mo-widening` | pale grey-blue, `#7D93B8` |
  | `stable`, declared, or no trail | `--color-map-mo-stable` | `#3A4260` |
  | not started | `--color-map-pending` | |

  None of these is a party colour (design rule). Light-theme values are defined alongside them in `studio.css`.
- **Legend:** Switched · Narrowing · Widening · Stable / declared, each with its count.
- **Headline:** "N lead changes so far" (sum of `lead_changes`), replacing the median-margin headline while live.
- **Chips** (existing mechanism; each filters the map):
  - Lead switched N;
  - Narrowing N;
  - Widening N;
  - Comebacks N (`comeback`);
  - Upsets N (any `upsets`).
- **When nothing is counting** (Upcoming before the first result, or Finalized), Battle keeps today's margin buckets,
  so the layer still means something on a finished election.

### 3.3 Typed pulse

- Today `diffLeaders` yields `won` / `lead` changes and `markRecent` keeps seat ids for 3 s. The change: keep a
  **type** per seat. Precedence: `upset` > `switch` > `declared` > `update`.
  - `switch`: the leader's party differs from the previous snapshot's.
  - `upset`: the seat's `upsets` list gained an entry since the previous snapshot.
  - `declared`: the status became WON.
- **Outline flash colour by type:**
  - switch = `--color-map-mo-switched`;
  - upset = `--color-live` (red);
  - declared = ink/white;
  - plain update = today's style.

  Reduced motion keeps no animation (as today).
- **Ticker lines:** "Lead switch: Danapur · RJD → BJP" and "Upset: Sitting MLA trailing in Danapur", next to today's
  won / lead lines.

## 4. Seat dialog (live)

The dialog gains these, all from data that exists:

1. **Status line:** "Counting · Round 9 of 20" plus a thin **progress bar** (round current / total), a **call badge**
   (Too close shown with the dashed style; Likely; Safe) and a **momentum badge** (Narrowing / Widening / Switched in
   its momentum colour).
2. **Margin trend:** a small chart over the seat's timeline from `GET /elections/:id/constituencies/:constId/rounds`:
   - x = round, y = the leader's margin;
   - segments coloured by the leading party;
   - markers at lead switches ("Lead switch R6");
   - the current value labelled ("Now +342").

   It is fetched when the dialog opens for a live seat and refreshed with the snapshot version. It is hidden when the
   seat has fewer than 2 points.
3. **Upset badges**, one per entry in `upsets`:
   - "Sitting MLA trailing · <name> (<party>) −<margin>";
   - "Stronghold at risk · held by <party> since <year>" (from `class_before`);
   - "Heavyweight trailing · <name>".
4. **Narrowed line** under the table when momentum is narrowing or widening: "Lead narrowed from 2,890 to 342 over the
   last 3 rounds", computed from the trail.
5. The candidate table's pills already say Leading / Trailing while counting; no change.

Left out (the mockup invented them; there is no data): "next round expected in N min", "EVMs: Table 1–14".

## 5. Mobile

- **Same encodings:** Overview strengths and the dashed too-close outline; Battle momentum colours.
- The **chips** live in the existing swipeable bottom card ("Too close · N" on Overview; the Battle chips row with
  "N lead changes so far").
- The legend wraps onto two lines when needed.

## 6. Corrections to the mockups

1. **Momentum colours:** narrowing magenta (not red, not orange), widening pale grey-blue (not saturated blue).
2. **Too close:** a faint fill **plus a dashed outline**; faint alone looked "missing" on the dark background.
3. **Legend:** no vote thresholds ("Safe (>5k)" etc.).
4. **Seat dialog:** no next-round time, no EVM table text.

## 7. Where it goes in the code

- **`model/derive/mapFill.ts`:**
  - `layerFill` takes the seat's `SeatLive` (via the context);
  - Overview: opacity by call and a `dashed` flag;
  - Battle: momentum colour while live, margin buckets otherwise.
  - `SeatFill` gains `dashed?: boolean`.
- **`views/map/MapCanvas.tsx` / `useMapRendering.ts`:**
  - a dashed outline (`stroke-dasharray`, party colour) when `dashed`;
  - the pulse class carries the type (`studio-seat-pulse--switch|upset|declared`).
- **`theme/studio.css`:** the four momentum tokens (dark and light) and the typed pulse keyframes.
- **`model/derive/layerInsights.ts`:**
  - Overview adds the Too close chip while live;
  - Battle builds the live headline and chips from `liveAnalysis`, and keeps the margin buckets otherwise.
- **`model/live/liveUpdates.ts` + `viewmodels/sources/useDashboardSources.ts`:** typed changes, with `recentSeats`
  becoming a map from seat to type; ticker lines.
- **Seat dialog:**
  - `viewmodels/tiles/useSeatDialogVM.ts` gets the seat's `SeatLive` and the rounds (fetch + refresh);
  - `views/seat/SeatDialog.tsx` gets the status line, badges, upset badges and narrowed line;
  - new `views/seat/MarginTrend.tsx` (SVG, no chart library).
- **`views/map/MapTile.tsx`:** hide the Map / Hex toggle.
- **i18n:** new keys in en / hi / mr / ta (legend, chips, badges, ticker, upsets).
- **Live analysis plumbing:** `liveAnalysis` is already on `DashboardSources`; the map and insight contexts gain it.

## 8. Testing

- **Unit (model):**
  - `mapFill` (each call and momentum maps to the right colour, opacity and dashed flag; the non-live fallback is
    unchanged);
  - `layerInsights` (Too close chip; Battle live headline and chips, with the bucket fallback);
  - typed `diffLeaders` (precedence);
  - the narrowed-line text;
  - `MarginTrend` point and segment derivation (pure helper).
- **Viewmodel:** `useSeatDialogVM` fetches rounds only for a live seat, and refetches on a version change.
- **Views:** `SeatDialog` renders the badges, the upset list and no chart when there are fewer than 2 points;
  `MapTile` has no hex toggle.
- **Manual / simulation:** replay a simulated count (LIVE_RUNBOOK §5) and check:
  - Overview strengths and dashed too-close seats;
  - Battle colours and chips;
  - typed pulses;
  - the seat dialog chart growing per round;
  - mobile at 390×844;
  - light theme.
- **e2e:** the existing suite stays green (Finalized dashboards are unchanged).

## 9. Out of scope

- A hex renderer.
- Stripes on the Overview.
- New tiles.
- Changing the call thresholds. They stay provisional, in `live.ts`.
