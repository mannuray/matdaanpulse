# Party page (`/party/:id`): handoff notes

Status: **intent, state handling and sections agreed (2026-10-07, §8); not designed in Stitch yet.** Paused so the
seat analysis improvements land first (the state view's seat changes read the stored analysis, and the prod recompute
should run once). Resume at §8 → Stitch design → spec → plan. §§2, 4 and 5 are the original notes; §8 supersedes them.

## 1. Where things stand (2026-10-07)

- **Data seeding is complete through Phase 4.** On production: VS results for 20 states (BR, WB, AS, KL, TN, PY, GA,
  MN, UK, PB, UP, DL, HR, JH, OD, SK, AR, AP, MH, JK). Every candidate has real ECI votes. Each state's latest
  election has the current track (leaders, top-party profiles, party units, top-4 photos, affidavits). Lok Sabha
  data exists but is hidden from the site.
- **The 2027 elections** (GA, UK, PB, MN, UP; counting 27 Feb 2027) are still ahead. Their current track waits for
  ECI's final nominations list.
- **Party model is shipped** (migration 023, design `2026-10-06-party-model-design.md`):
  - 34 lineage events: renames, mergers, splits, breakaways. Examples: SHS/SHSUBT and NCP/NCPSP splits,
    PRP → INC merger, JVM → BJP merger, YSRCP ← INC, MNS ← SHS, Apni Party ← PDP, DPAP ← INC.
  - 166 state units with 316 roles (state president, legislature leader). About 190 roles link to a person; the rest
    are people who never contested (`no_candidacy`) or deliberate gaps.
  - Unit files `scraper/data/parties/units-1..9.json` map to run-once seeds v1–v6.
- **Party profiles:** about 76 parties have a profile (description, leader, founded, HQ, website, Wikipedia, logo and
  ECI symbol images with credits).
- **Shipped UI:** the party dialog on the dashboard (`frontend/src/views/party/PartyDialog.tsx`). It shows the
  profile, the state unit and lineage notes.
- **No party page exists yet.**

## 2. Intent (as understood, not yet confirmed)

- **One page per party.** BJP gets one page, not one per state; state units live inside it.
- **What it shows:**
  - who the party is;
  - where it is strong;
  - how it has done over time, following lineage (JVM's seats count for BJP after the 2020 merger; a split shows
    the faction and the name-holder);
  - who leads it in each state.
- **How it is built:** a public studio MVVM page, like the person and constituency pages (`src/viewmodels/pages`,
  `src/views/<page>`, composed under `src/pages`).
- **Entry points:**
  - the party dialog on the dashboard ("Open party page");
  - party chips on person pages;
  - the winner's and candidates' parties on constituency pages;
  - search.
- **Admin editing** of lineage and units is a separate piece, for later.

## 3. Data available

- **`parties` table:** name, abbreviation, colour, `symbol_url`, `eci_symbol_url`, leader, founded year, HQ,
  website, Wikipedia, description, ECI recognition.
- **`GET /parties/:id`** (`backend/src/modules/parties/parties.controller.ts`):
  - returns `units`: per state, the recognition, office, website and terms (president / legislature leader, with
    `person_id`, current first);
  - returns `lineage`: events where the party is on either side.
- **`GET /parties/lineage`** and the shared rule: `frontend/src/model/derive/comparableParties.ts` =
  `backend/src/common/comparable-parties.ts` (the two must stay identical; a test enforces it). It handles
  carry-forward, split vs flip, and the party family.
- **Results:** every VS election where the party contested gives seats won, seats contested and vote share. They can
  be derived from `results` / `candidates`. **There is no per-party aggregate endpoint yet**, so the page needs one.
  Keep it cache-friendly: production traffic is spiky (see the roadmap memory).
- **Seat history** compares only elections with the same type, state and delimitation
  (`backend/src/common/comparable-elections.ts`). Across a redraw (Assam 2026, J&K 2024) a party's state record
  still lists every election, but seat-level "held/gained" stops at the redraw.
- **Two data quirks:**
  - Some unit leaders are unlinked on purpose because they switched parties (e.g. Kewal Dhillon, Janardan Paswan);
    link them once admin editing exists.
  - Several older seeds are partly estimated (see the About page / `frontend/src/model/about/about.ts`). Show
    nothing that the data can't support.

## 4. Open question: how the page handles states

1. **(Recommended) National page + state switch.**
   - Opens on the national view: profile, results across all states, list of state units.
   - `?state=JH` turns it into that state's view: the unit and its leaders, the state's election-by-election record
     with lineage applied, and its seats on the map.
   - The party dialog links to the state view.
2. **National page only**, with every state as a section below. Simpler, but long for BJP and INC (15+ states), and
   there is no shareable "BJP in Jharkhand" link.
3. **Separate state pages** (`/party/BJP/state/JH`). Same content as option 1, but two page types, more routes and
   more design.

## 5. Candidate sections (to agree after §4)

- **Header:** mark (logo → ECI symbol → dot, via `views/ui/PartyMark`), name, abbreviation, recognition, founded,
  HQ, current leader (national, or the state president in the state view), links.
- **Track record:** seats won / contested and vote share per election, lineage-adjusted. Lineage events are marked
  on the timeline (merger, split, breakaway note), with the family total after a split.
- **State units:** recognition, office, current president and legislature leader (person links), past holders.
- **Where it wins** (state view): strongest seats and regions; a map of seats won at the latest election, using the
  election's own map (`geo.map_url`).
- **Lineage:** predecessors, successors and factions, with sources.

## 6. Process when resumed

1. **Brainstorm (architectural path):** confirm the intent in §2, settle §4, agree the sections.
2. **Design in Stitch.** This is a new screen, so it is designed in Stitch. Discuss each change before every Stitch
   command (memory: discuss-before-stitch). The existing Stitch project and layout direction are in the
   election-redesign-direction memory.
3. **Spec and plan:** the spec goes in this folder (`YYYY-MM-DD-party-page-design.md`), then the plan. Execution so
   far has been native (inline), with one fresh reviewer at the end.
4. **Build:**
   - the backend per-party aggregate endpoint, with tests;
   - the frontend MVVM page (`npm run lint` checks the import direction; add an `@source` line in
     `frontend/src/theme/studio.css` for any new file with Tailwind classes outside `src/views`);
   - entry-point links;
   - `docs/FEATURES.md`.
5. **Ship:** the backend changes, so deploy Render by CLI (service `srv-dav07gl9fdbs73aluc2g`) as well as Vercel.

## 7. Related next work (not part of this page)

- **Seat analysis improvements:** to be discussed in their own session. The stored seat analysis has not been
  recomputed on production since the party model shipped. The recompute is
  `cd scraper && npx ts-node src/recompute-analysis-cli.ts --type VS`, run against production with a backup first.
  Settle the improvements before running it, so it runs once.
- **Admin editing** of lineage and units.
- **By-elections.**
- **The 2027 current track,** once nominations close.

## 8. Decisions (brainstorm 2026-10-07)

- **Purpose: profile + track record, equally (option C).** A profile header, then the track record as the main body.
  Audience: the general public (curious voters, journalists); useful on any day, final results only on counting day
  (no live tallies). VS only, while LS is hidden.
- **States: national page + state switch (§4 option 1).** `/party/:id` is the national view; a state chip row
  ("All states" first) or `?state=JH` turns the same page into the state view, with a shareable link. A party that
  contested only one state opens straight on its state view. The dashboard party dialog links to `?state=<its state>`.

### National view (`/party/BJP`)

1. **Header:** party mark (logo → ECI symbol → dot), name, abbreviation, recognition, founded, HQ, national leader,
   links.
2. **Headline numbers:** MLAs today = seats won at each state's latest election, summed over covered states ("holds
   N of M seats in K states"), labelled "at each state's latest election" because the years differ; states where it
   governs / is the largest party.
3. **States table (the main body):** one row per state contested: latest year, seats won / contested, vote share,
   change vs the previous comparable election (lineage applied; blank across a redraw), seat sparkline, current
   state president. A row opens the state view.
4. **Lineage:** predecessors, successors, factions, each with its source.
5. **About:** profile description, image credits.

Left out: a national all-states map (mixes years; the table does it better), Lok Sabha.

### State view (`/party/BJP?state=JH`)

Same header, with the state president as leader and the state's recognition; state chips at the top.

1. **State unit:** current state president and legislature party leader (photo, person link), past holders below,
   state office / website.
2. **Election record:** newest first: year, seats won / contested, vote share, deltas; lineage applied with events
   inline ("+ JVM(P) merged 2020", family total after a split); a redraw is a divider (seat comparison stops, vote
   share continues); a small seats + vote share chart above.
3. **Map, where it won:** latest election's own map (`geo.map_url`), seats won in party colour, contested-lost faint;
   year picker; click → constituency page.
4. **Seat changes at the latest election:** held / gained (from whom) / lost (to whom), splits labelled "split" not
   flips. Reads the stored seat analysis, so it follows the seat analysis improvements (§7). Kept.
5. **Its MLAs:** winners at the latest election (name, photo, constituency, margin; person / constituency links);
   a search box for long lists, no expanders.
6. **Strongest regions:** seats won per region / district at the latest election, as a bar list; only where the
   regions seeds exist, hidden otherwise. Kept.

Left out for v1: alliance partners (per-election manifest data; later), candidate-level history.

### Next

Seat analysis improvements first (their own discussion), then: Stitch design of both views (discuss before every
Stitch command) → spec `YYYY-MM-DD-party-page-design.md` → plan → build (§6 step 4).
