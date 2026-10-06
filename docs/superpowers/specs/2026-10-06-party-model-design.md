# Party model: lineage (splits, mergers, renames) and state units — design

Date: 2026-10-06. Status: agreed in discussion. Comes before Results Day
(`docs/superpowers/specs/2026-10-06-results-day-home-design.md`, which will use it); the `/party/:id` page is the next
phase.

## 1. Goal

Parties split, merge and rename often (Shiv Sena 2022, NCP 2023, LJP 2021, JVM → BJP 2020, TRS → BRS 2022, the
Kerala Congress factions…), and every "compared with last time" number depends on it. Today all ~13 cross-election
comparisons use raw party-id equality, so a renamed party looks like a different one, a split faction's seats count as
flips, and the successor "inherits" history only when ECI happened to keep its name. Separately, a party is one entity
(BJP has one identity and page) but each state has its own unit with its own leaders and its own ECI recognition.

## 2. Decisions (user, 2026-10-06)

- **Lineage events**: `rename`, `merger`, `split`, each with a date, an optional state (a state unit breaking away
  applies only in that state's comparisons), a **successor** flag (the faction ECI recognised as the original: name and
  symbol), a note and a source. Curated by us, sourced, seeded (admin editing later).
- **Comparison rule, everywhere, through one function**:
  - rename / merger → the same party for comparison (BRS vs TRS 2018; JVM's 2014 seats count in the BJP's "previous");
  - split → the successor inherits the old party's history; the other faction is **new** (no change number); a seat
    the old party held and the other faction now holds is labelled **split**, not a flip (a seat it takes from any
    other party is a normal flip);
  - a **family** view (successor + factions, e.g. "Shiv Sena family: SHS 57 + UBT 20 = 77 (2019: 56)") on hover/expand.
- **State units**: one `parties` record per party; per state a unit with ECI recognition in that state, state office,
  and leadership terms (state president, legislature party leader) linked to persons, with from/to dates. Depth now:
  current leaders + the leaders at each state's latest election.
- **Scope now**: the data, the rule applied in every comparison, and a state-unit block (+ lineage note) in the
  existing party dialog. Next phase: `/party/:id` page and admin editing of lineage and units.

## 3. Data model (migration 023, idempotent)

- `party_lineage (id, party_id → parties, predecessor_id → parties, kind ('rename'|'merger'|'split'), effective_date,
  state_id → states NULL, is_successor bool, note, source_url)`; unique `(party_id, predecessor_id, COALESCE(state_id,0))`.
  A split has one row per faction (the successor row `is_successor = true`); a merger has one row (absorber ← absorbed);
  a rename one row (new ← old, successor).
- `party_units (party_id, state_id, eci_recognition, office, website, updated_at; PK (party_id, state_id))`.
  `parties.eci_recognition` stays (national view; the unit value wins in a state context).
- `party_unit_roles (id, party_id, state_id, role ('state_president'|'legislature_leader'), person_id → persons NULL,
  person_name, from_date, to_date NULL, source_url)`; current = `to_date IS NULL`.
- Prisma schema in sync; read API: `GET /parties/lineage` (the whole small table, CDN-cached), `GET /parties/:id` gains
  `units` (with current roles) and `lineage` (events touching the party).

## 4. The rule (one function per side, same test table)

`backend/src/common/comparable-parties.ts` and `frontend/src/model/derive/comparableParties.ts`, identical behaviour,
tested with the same case table (Shiv Sena, NCP, LJP, JVM→BJP, TRS→BRS, HJC(BL)→INC, RLSP→JD(U), INLD/JJP, Apna Dal,
a state-scoped Kerala Congress split):

- `carryForward(partyId, fromDate, toDate, stateId) → partyId`: what an earlier party counts as by a later election
  (renames/mergers followed; a split followed to its successor).
- `relation(prevPartyId, curPartyId, ctx) → 'same' | 'split' | 'different'`: `same` after carry-forward; `split` when
  the current party is a non-successor faction of the previous party's family; else `different` (a flip).
- `familyOf(partyId, date, stateId) → { root, members[] }` for the family view.
Only events dated between the two elections (and in their state, when state-scoped) apply.

**Applied in**: backend `swing.strategy` (flipped / new `split`), `incumbency.strategy` (a person following the split is
not a "switch"), `dominance.strategy` (counts by carried-forward id); frontend `useHistoryAnalysis`, `intelligence.ts`
(dominance, incumbency, party switches, party trend series), `seatInsights` (flip/streak/margin), `personPage` (switches),
`regionComparison` (previous party ids carried forward before grouping), `layerInsights` and `summary/swing` (flip flows
with a "split" bucket), `stats` (flipped count excludes split). The stored seat analysis is recomputed for every
election after deploy (also clears the long-deferred recompute).

## 5. Party dialog (state context)

Under the header: "**<Party> <State>** · recognised as <unit recognition> · state president <person link> · legislature
leader <person link>", then the national leader line; a lineage note when one applies ("Formed in 2022 from the split
of Shiv Sena; ECI recognised it as Shiv Sena" / "Faction of Shiv Sena since 2022; the other faction is …"), and the
family total for this election when the party has a family. Without state context the dialog is as today.

## 6. Data (sourced)

- `scraper/data/parties/lineage.json` → run-once-free idempotent seed `seed_party_lineage.sql` (ON CONFLICT DO NOTHING;
  rows are curated, not admin-edited yet): the events that touch our 15 states' elections since 2008.
- `scraper/data/parties/units.json` → `seed_party_units_v1.sql` (run-once: admins will edit units later): units for every
  party that won a seat or is an alliance member in each state's latest election; roles current + at that election, with
  person links where the person exists.

## 7. Done when

The case table passes on both sides; a dashboard comparison shows Shiv Sena (UBT) as new with its seats labelled split
(Maharashtra when loaded; tested now with fixtures), BRS compared with TRS, JVM's seats in the BJP's previous; the
recomputed seat analysis has no flips for pure renames; the party dialog shows the state unit and lineage note in Bihar,
Jharkhand (JVM→BJP), Uttar Pradesh (Apna Dal) and Haryana (INLD/JJP); setup twice clean; on prod after a backup.
