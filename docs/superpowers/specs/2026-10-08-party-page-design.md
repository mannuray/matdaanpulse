# Party page (design)

Status: **draft for review** (brainstorm 2026-10-08). Decisions on purpose and sections:
`2026-10-06-party-page-notes.md` §8. This spec turns them into a page, an endpoint and a build order.

Stitch mockups (project "Election Tracker Redesign", 7025431006647439600; local copies in `.playwright-mcp/party-*.png`):

| Screen | Stitch id |
|---|---|
| National, desktop | `d1c17a950f794805997148641ac67699` |
| State (BJP · Jharkhand), desktop | `4ab54c0c793446cf9ccefe7e080b592c` |
| National, mobile | `587b1f3094d1475abd1173df8c2adc71` |
| State, mobile | `aa845732977741f5a7e075c45affddc5` |

The mockups use placeholder numbers. Where this spec and a mockup differ, this spec wins (§7 lists the corrections).

## 1. Goal

One page per party for the general public (curious voters, journalists): who the party is (profile) and how it has
done (track record), equally. Useful on any day; **final results only** (no live tallies; on counting day the dashboard
is the place). Vidhan Sabha only while Lok Sabha is hidden.

- `/party/:id`: the **national view** (all states).
- `/party/:id?state=JH`: the **state view** (same page, shareable link).
- A party that contested only one state opens on its state view (the chip row still offers "All states").

The page is a scrolling profile page in the studio look (like the person and constituency pages); the dashboard's
no-scroll rule does not apply. No accordions or expanders.

## 2. Data: `GET /parties/:id/record`

Public, cached like the other final-result endpoints. Read from stored seat analysis, so no new tables.

```
{
  party_id,
  elections: [                         // every Finalized VS election the party contested, newest first
    { election_id, state_id, state_code, state_name, year, delimitation,
      contested, won, votes, share,              // election_analysis.data.parties[] row of this party
      held, gained, lost, split_gained, split_lost,
      seats_total,                               // assembly size (constituency count)
      largest: boolean,                          // its won is the highest of any party in that election
      formed_government: boolean | null }        // manifest government.parties includes it; null = no record
  ],
  lineage: [ { party_id, predecessor_id, kind, effective_date, state_id, note, source_url } ]
                                                 // events touching this party's family (party, predecessors, successors)
}
```

With `?state=XX` it also returns, for that state's **latest** election in `elections`:

- `mlas: [{ person_id, name, photo_url, const_id, const_name, margin }]`, the party's winners, by margin descending;
- `flow: [{ from, to, seats, split }]`, the analysis flow rows where this party is `from` or `to`;
- `regions: [{ region, seats, won }]`, from the analysis region breakdown; omitted when the state has no regions.

Rules:

- Elections without stored analysis (`election_analysis.data` null) are skipped. Rollout computes every VS election.
- Unknown party → 404. A party with no VS contests → `elections: []`.
- Lineage comparisons (family totals across a merger or split) are applied in the browser with
  `model/derive/comparableParties.ts`, the one shared rule.

Small additions alongside:

- `GET /parties/:id`: each `units[].roles[]` gains `photo_url` (from its person, null otherwise).
- `GET /parties/lineage`: each event gains `source_url`.

## 3. National view (`/party/BJP`)

Every figure uses the latest Finalized election in each state the party contested.

1. **Header:** mark (logo → ECI symbol → dot, `PartyMark`), name, abbreviation chip, recognition badge
   (`eci_recognition`), founded, HQ, national leader (`leader_name`), website and Wikipedia links; a party-colour glow
   on the header edge. Missing fields are left out (never "—"). Caption: "Final results only".
2. **Headline numbers** (4 cells; 2×2 on phones):
   - "Holds **Σ won** of **Σ seats_total** seats", caption "at each state's latest election";
   - "in **K** states" (states with won > 0), caption "contested in N";
   - "Governs **G**" (latest election `formed_government = true`); shown only when some state has a government
     record, else the caption "not recorded";
   - "Largest party in **L**" (latest election `largest = true`).
3. **State chips:** "All states" first, then the states it contested by seats won; a chip opens `?state=`.
4. **States table** (main body; stacked rows on phones): state · latest year · won / contested with a bar · vote share
   · change · sparkline · state president.
   - **Change:** against the previous election in that state with the same delimitation, lineage applied; ▲/▼ seats and
     points, or "—" when there is none (e.g. first after a redraw).
   - **Sparkline:** seats won across its elections in that state, party colour.
   - **State president:** the current holder (`to_date` null) from `units[].roles`, with avatar; blank if unknown.
   - Sorted by seats won; every state listed; a row opens the state view.
5. **Lineage:** a vertical timeline of the family's events (rename, merger, split, breakaway): year, kind, note,
   "source ↗". Hidden without events.
6. **About:** `description`, and an "Image credits" line for the logo (`image_credits`).

A party with no VS contests shows header, lineage and about, and the line "No assembly results on MatdaanPulse yet."

## 4. State view (`/party/BJP?state=JH`)

**Header:** as §3.1 with the state's recognition (`party_units.eci_recognition`), the state president as leader, the
unit's office and website; on the right "21 / 81 seats · 2024" with vote share and its change. Chip row with the state
selected.

**Jump links:** a sticky strip under the header: Record · Map · Seat changes · MLAs · Regions. Scroll to the section;
the active link follows the scroll; links of hidden sections are dropped. On phones one horizontally scrolling row.

**Layout:** desktop two columns, left Record, Map, MLAs; right State unit, Seat changes, Regions. Phones: header →
unit → record → map → seat changes → MLAs → regions.

1. **State unit:** current state president and legislature party leader (photo, name, "since", person link); past
   holders as name · years. Hidden when the state has no unit rows.
2. **Election record:** a small chart (bars = seats won, line = vote share) above a table, newest first: year · won /
   contested · vote share · Δ seats · Δ share.
   - Deltas compare with the previous election on the same delimitation, lineage applied.
   - Lineage events in this state (or all states) sit inline between the years they fall in, e.g. "+ JVM(P) merged into
     BJP · 2020"; the next Δ is against the family's combined earlier total and says so ("vs BJP + JVM(P) 2014").
   - A redraw is a divider row ("New boundaries from 2023"): seat Δ stops at it, vote-share Δ continues.
3. **Where it won:** the election's own map (`manifest geo.map_url`) with the existing map drawing: won = party
   colour, contested and lost = faint party tint, not contested = pending colour. A year picker redraws it for that
   election (its own map file). Hover: seat name and result; click: constituency page.
4. **Seat changes at the latest election:** Held / Gained / Lost (from the record row); "Gained from" and "Lost to" bars
   from `flow`; split moves tagged "split", not counted as flips. Without an earlier comparable election the card reads
   "First election on these boundaries".
5. **Its MLAs:** the latest election's winners: photo, name, constituency, margin; person and constituency links. A
   search box filters by name or seat. No expanders.
6. **Strongest regions:** one bar per region (won of its seats), sorted by won. Hidden without regions.

## 5. Entry points

- Dashboard party dialog: "Full party page →" to `/party/:id?state=<the election's state code>`.
- Party names on the person and constituency pages link to `/party/:id` (not for IND and NOTA).

## 6. Errors and edge cases

- Unknown id: a "Party not found" page with a link home.
- `?state=` the party never contested: the national view with a note "BJP has no results in Kerala yet".
- Independents (IND) and NOTA have no party page.
- Missing photos: initials avatar (as on the person page).
- If `/record` fails: header (from `/parties/:id`) plus a retry card for the body; the two requests are independent.
- All four locales (en / hi / mr / ta) for every new string.

## 7. Corrections to the mockups

1. No "Live feeds active / Updated" bar, no "Studio desk" tag, no "broadcast network" footer: the normal page bar and
   footer.
2. No "Alliance leadership · NDA" header block (alliances are per election; later, per state).
3. No "View all 28 states": every state with data is listed.
4. No "Key electoral cornerstones" chips and no "registration ID" (no data).
5. Sparklines in the party colour.
6. "Where it won" is the real boundary map, not a grid or tiles.
7. Jump links are named after the sections (Record · Map · Seat changes · MLAs · Regions).
8. Phones put the state unit first (as the mobile mockup).

## 8. Where it goes in the code

- **Backend:** `PartiesService.record(id, state?)` + `PartyRecordDto` in `backend/src/modules/parties`; route
  `GET /parties/:id/record` (before `:id`); `photo_url` on roles; `source_url` on lineage events.
- **Model (pure):** `frontend/src/model/derive/partyRecord.ts`: national headline numbers; per-state latest rows with
  lineage-aware deltas; sparkline series; record rows with inline events and redraw dividers. API calls in
  `model/api`.
- **View-model:** `frontend/src/viewmodels/pages/usePartyPageVM.ts`: fetches both endpoints, reads `?state=`, the
  one-state redirect, MLA search.
- **Views:** `frontend/src/views/party/` (`PartyPageView`, `StatesTable`, `RecordCard`, `PartyMapCard`,
  `SeatChangesCard`, `MlasCard`, `RegionsCard`, `UnitCard`, `LineageCard`, `JumpLinks`); route in `App.tsx`; page
  file listed via `@source` if outside `src/views`.

## 9. Testing

- **Backend:** record builder unit tests (merger, redraw, party missing from an election, `largest`,
  `formed_government`, `?state` extras); a DB test on local seeds: BJP's latest Jharkhand row equals
  `analysis/summary`.
- **Model:** headline sums; Δ rules (lineage, redraw); inline events; sparkline series.
- **View-model / views:** state switch, one-state redirect, hidden sections without data, MLA search.
- **e2e:** `/party/BJP` (table rows, chip → state), `/party/BJP?state=JH` (record, map drawn, MLA search),
  `/party/JMM` (opens on its state view), 404, a phone pass; screenshots of each.

## 10. Build order and rollout

1. Backend endpoint and the small additions. 2. Model derive. 3. Page + VM: header, chips, national view. 4. State view
sections. 5. Map card. 6. Entry links. 7. i18n and docs (FEATURES.md, CLAUDE.md).

Rollout: Render deploy by CLI (new endpoint), then the frontend (Vercel on push); check every VS election has stored
analysis on prod and run the recompute CLI for any missing.

## 11. Out of scope

Lok Sabha; live tallies; alliance partners; candidate-level history; a national all-states map.
