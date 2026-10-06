# Party page (`/party/:id`) — notes for later

Status: **not designed yet** (parked 2026-10-06 to continue data filling). These are brainstorming notes, not an
approved spec: resume with the open question in §3, then write the spec and plan.

## 1. Intent (as understood, not yet confirmed)

- One page per party: BJP is one page, not one per state. State units live inside it (party model, migration 023,
  `docs/superpowers/specs/2026-10-06-party-model-design.md`).
- Shows who the party is, where it is strong, how it has done over time (following lineage: JVM's seats count for BJP
  after the 2020 merger), and who leads it in each state.
- Public, studio MVVM page like the person page (`src/viewmodels/pages`, `src/views/…`). Entry points: the party dialog
  (dashboard), person pages (party chip), constituency pages (winner/candidate party). Admin editing of lineage and
  units is a separate, later piece.

## 2. Data already available

- `parties`: name, colour, symbol / ECI symbol, abbreviation, leader, founded year, HQ, website, Wikipedia,
  description, ECI recognition. Profiles are filled for the top parties of each state's latest election.
- `GET /parties/:id` returns `units` (per state: recognition, office, website, president / legislature-leader terms
  with `person_id`, current first) and `lineage` (events where the party is either side).
- `GET /parties/lineage` + the shared rule (`comparableParties.ts`): carry-forward, split vs flip, family.
- Results: every election (VS of the shown states; LS hidden from the site) where the party contested — seats won,
  contested, vote share per election — derivable from results/candidates; no per-party aggregate endpoint yet.
- 4 unit leaders are unlinked on purpose (party switchers: Kewal Dhillon, Janardan Paswan, M. V. Shreyams Kumar,
  G. Nehru Kuppusamy) — link them once admin editing exists.

## 3. Open question: how the page handles states

1. **(Recommended) National page + state switch.** Opens on the national view (profile, results across all states,
   list of state units). `?state=JH` turns it into that state's view: the unit and its leaders, the state's
   election-by-election record with lineage applied, its seats on the map. The party dialog links to the state view.
2. National page only, every state a section below. Simpler, but long for BJP/INC (15+ states) and no shareable
   "BJP in Jharkhand" link.
3. Separate state pages (`/party/BJP/state/JH`). Same content as 1 with two page types; more routes and design.

## 4. Candidate sections (to agree after §3)

- Header: mark, name, abbreviation, recognition, founded, HQ, current national/state leader, links.
- Track record: per election seats won / contested and vote share, lineage-adjusted, with lineage events marked on
  the timeline (merger, split, breakaway note) and the family total after a split.
- State units: recognition, office, current president and legislature leader (person links), past holders.
- Where it wins: strongest seats / regions in the selected state; map of seats won at the latest election.
- Lineage: predecessors, successors, factions, with sources.

## 5. Process when resumed

Studio screen → discuss before each Stitch command (memory: discuss-before-stitch); new screen, so design in Stitch
first. Then spec in this folder, plan, build (needs a per-party results aggregate endpoint).
