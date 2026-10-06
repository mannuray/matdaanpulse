# Phase 4B-2: Arunachal Pradesh (2009-2024): design

Date: 2026-10-06. Status: agreed in discussion (user, 2026-10-06: "cool go ahead").
Context: Phase 4B-1 Sikkim (`2026-10-06-phase4b-sikkim-design.md`), whose pipeline, depth and production steps this
follows; `docs/SEEDING_PLAYBOOK.md`.

## 1. Goal

Every Arunachal assembly election since the 2008 delimitation on the site (2009, 2014, 2019, 2024; 60 seats): every
candidate + NOTA with real ECI votes, seat types, electors, turnout; seats won unopposed shown as such; manifests;
districts and regions; person links; About. 2024 is the sitting assembly: current track (leaders, top-party profiles,
party units, top-4 photos, affidavits).

## 2. Decisions (user, 2026-10-06)

- Years 2009, 2014, 2019, 2024; delimitation `'2008'`. Earlier years results only.
- **Seats won unopposed** (no poll; 2024: 10, all BJP, incl. CM Pema Khandu; earlier years counted from the reports):
  the winner is stored as WON with 0 votes and is the seat's only candidate (no NOTA row); seat turnout and voters are
  NULL. One shared rule decides "unopposed": a declared seat whose only non-NOTA candidate won with no votes polled
  (`isUncontested`, frontend model; the backend uses the same definition). Unopposed seats:
  - count in seat tallies and are coloured for the winner on the map (Battle/margin layers show them as "unopposed",
    not as a 0-vote margin);
  - are left out of margins (closest / biggest lists, margin buckets, averages), turnout averages and swing;
  - show "Elected unopposed" on the seat page (and in the seat's history rows).
  The same rule covers Surat in the Lok Sabha 2024 data if its seed ever carries 0 votes (not changed here).
- **Regions = the 2 Lok Sabha seats** (Arunachal West, 33 assembly seats; Arunachal East, 27), by seat (`seatRegions`,
  as Delhi); **districts = the current districts**, seat → district from a sourced list.
- **No lineage events**: the 2016 moves (Congress MLAs → PPA → BJP) were defections, not renames or mergers; person
  pages show each MLA's party changes.
- Party units for Arunachal (BJP, NPP, NCP, PPA, INC as they apply) in a new run-once `seed_party_units_v3.sql`
  (`units-6.json`; `UNITS_SEEDS` gains v3).
- 2024 current track: leaders (CM Pema Khandu, Deputy CM Chowna Mein, cabinet, Speaker, party chiefs; curated,
  user-approved), profiles of the top parties (seat won, 1 %+ vote, or alliance member), top-4 photos (results site
  `AcResultGen2ndJune2024/`, ECI code S02), winners' affidavits (MyNeta `arunachal2024`).

## 3. Sources (verified 2026-10-06; statistical-reports listing)

| | Source | Format | Counting |
|---|---|---|---|
| AR 2009 | old-site docid 4039 | one PDF | 22 Oct 2009 |
| AR 2014 | docid 4040 | one PDF | 16 May 2014 |
| AR 2019 | docid 11675 | XLS set | 23 May 2019 |
| AR 2024 | new-site category 3 | XLSX set (`-`, like Sikkim 2024) | 2 Jun 2024 |

Phases, reserved seats (ST) and unopposed seats per year are read from each report's Highlights and checked against
the seats. Map `ar_ac_2008.geojson`: 61 features, every seat 1-60 numbered, no unassigned area (checked). State id 3.
Other ECI categories found for later phases: Andhra 2024 = 2, J&K 2024 = 7, Maharashtra 2024 = 8.

## 4. Approach

- Registry: 4 `p4` elections (ids `a0030000-0000-4000-8000-00000000<year>`).
- Parser, test-first, only where Arunachal differs: how each file lists an unopposed seat (expected: in the summary
  with electors but no poll, in Detailed Results as one candidate marked uncontested or absent) → one WON candidate
  with 0 votes, no NOTA, voters/turnout null; a seat-type table if the files label ST inconsistently.
- Unopposed seats in the product: the `isUncontested` rule and its uses (§2), test-first, in the model layer, so
  views and viewmodels only read the flag.
- Checks: winners match ECI's party totals per year (incl. unopposed); unopposed counts match the Highlights.
- Manifests: pre-poll alliances only if sourced (BJP and NPP contested separately in 2024), majority 31.
- Districts/regions, person links, current track, About, docs: as Sikkim.
- Not in scope: seat analysis recompute; by-elections; Surat LS data.

## 5. Done when

The 4 elections load on a fresh and an upgraded (production copy) DB, setup twice changes nothing, winners and
unopposed counts match ECI, unopposed seats show as won-unopposed (map, seat page) and never as the closest contest,
every seat has a district and region, the map colours 60 seats, 2024 shows leaders, party profiles, units, photos and
affidavits, About lists the 4 elections; then on production (backup branch first, setup twice, Render deploy if
backend files changed, prod checks).
