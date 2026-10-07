# Party page (`/party/:id`): handoff notes

Status: **not designed yet.** Parked on 2026-10-06 to finish the data; updated 2026-10-07 for a fresh session. These
are brainstorming notes, not an approved spec. Resume at §5: settle the open question, design the screen in Stitch,
then write the spec and plan.

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
