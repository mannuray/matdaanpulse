# Phase 4B-1: Sikkim (2009-2024): design

Date: 2026-10-06. Status: agreed in discussion (user, 2026-10-06: "all good go ahead").
Context: `docs/SEEDING_PLAYBOOK.md`; Phase 4A spec (`2026-10-05-phase4a-dl-hr-jh-od-design.md`), whose pipeline and
depth this follows. Phase 4B fills the remaining 2024/25 states one at a time (Sikkim → Arunachal → Andhra →
Maharashtra → J&K), each pushed to production on its own.

## 1. Goal

Every Sikkim assembly election since the 2008 delimitation on the site (2009, 2014, 2019, 2024): every candidate +
NOTA with real ECI votes, seat types, electors, turnout; manifests; districts and regions; person links; About.
2024 is the sitting assembly, so it gets the current track (leaders, party profiles, top-4 photos, affidavits).

## 2. Decisions (user, 2026-10-06)

- Years 2009, 2014, 2019, 2024; delimitation `'2008'`; 32 seats each. Earlier years results only.
- **Bhutia-Lepcha (BL) seats are stored as `ST`** (Bhutia and Lepcha are Scheduled Tribes; ECI's own Highlights call
  them ST in 2014/2019 and "ST (BL)" in 2024). Like "(SC)" elsewhere, "(BL)" is stripped from the stored
  name and the type carries it (ST), so names match across years for links and the map. Reserved
  per election: SC 2, ST 12.
- **Sangha (AC 32) is a `GEN` seat with no map shape**: monastic electorate (registered monks of the state's
  monasteries), no territory. It is in lists, tallies and its seat page; the map has 31 shapes and does not draw it
  (a seat without a feature is not drawn; no code change). Its seat page / About note: "Sangha: a seat reserved for
  the Sanghas (monastic electorate), with no territory".
- **Regions = the 4 pre-2021 districts** (East, West, North, South); **districts = the 6 current ones** (Gangtok,
  Mangan, Namchi, Gyalshing, Pakyong, Soreng), each seat mapped from a sourced AC → district list. Sangha: district
  Gangtok (the seat's returning office), region East; noted as an administrative choice.
- Lineage: SKM ← SDF, `breakaway` (founded 2013 by leaders who left SDF; exact date from a source, note only). Other Sikkim events only if sourced.
- 2024 current track: leaders (CM P. S. Golay, cabinet, Speaker, party chiefs; no Leader of Opposition: SDF won one
  seat), profiles of the top parties (seat won, 1 %+ vote, or alliance member), top-4 candidate photos per seat,
  winners' affidavits (MyNeta `sikkim2024`). Curated lists are user-approved before seeding.
- Party units for Sikkim (SKM, SDF, BJP, INC, CAP1): added to `units-*.json` and seeded as `seed_party_units_v2.sql`
  (v1 is run-once and already on production).

## 3. Sources (verified 2026-10-06; found through `get-election-data?page_seo_name=statistical-reports`)

| | Source | Format | Seats (SC/ST) | Phases | Counting |
|---|---|---|---|---|---|
| SK 2009 | old-site docid 3364 | one PDF `2009.pdf` (text layer) | 32 (2/12 BL) | 1 | 16 May 2009 |
| SK 2014 | docid 3365 | one PDF `2014.pdf` | 32 (2/12) | 1 | 16 May 2014 |
| SK 2019 | docid 11677 | XLS set; names with spaces: `10-Detailed Results.xls`, `8-Constituency Data Summery .xls` | 32 (2/12) | 1 | 23 May 2019 |
| SK 2024 | new-site category 5 | XLSX set (`-`, no padding): `10-Detailed-Results.xlsx`, `8-Constituency-Data-Summery-Report.xlsx` | 32 (2/12) | 1 | 2 Jun 2024 |

Seat-type labels differ by file (parser traps):
- 2009 PDF: `(BL)` / `(SC)` suffixes, sometimes without a space; Sangha unlabelled.
- 2014 PDF: summary pages say `(ST)`; Detailed Results label only SC seats.
- 2019: Detailed Results show `(BL)` but not `(SC)`; the CATEGORY column is the candidate's, not the seat's.
- 2024: upper-case names with `(BL)` / `(SC)`; summary sheets `1-YUKSOM-TASHIDING-(BL)`.
Seat types therefore come from **one fixed table** (SC: AC 8, 18; ST: AC 1, 5, 6, 9, 16, 21, 23, 24, 27, 29, 30, 31;
the rest GEN), checked against each file's labels where present, not from the labels alone.
AC 1 is "Yoksam-Tashiding" up to 2019 and "Yuksom-Tashiding" in 2024 (keep each year's ECI spelling).

Latest election: results site `results.eci.gov.in/AcResultGenJune2024/` (Wayback) for photos; ECI state code S21.
Map: `sk_ac_2008.geojson` (31 numbered seats + 5 unnumbered slivers, no AC 32). State id 30. Parties SDF, SKM, CAP1
exist (from LS 2024).

## 4. Approach

- Registry: 4 `p4` elections (ids `a0300000-0000-4000-8000-00000000<year>`); 2019 with explicit file paths (the
  `xs()` helper cannot express the spaces); 2024 as HR 2024 (`xs(2024, 'xlsx', '-', '', 'Constituency-Data-Summery-Report')`).
- Parser, test-first, only where Sikkim differs: `(BL)` suffix handling and the fixed seat-type table; whatever the
  2009/2014 PDF layouts need beyond the 4A PDF parser.
- Checks: winners match ECI's party-wise totals (Highlights / Performance of Political Parties) per year; candidate
  counts per seat; seat types = the fixed table.
- Manifests: alliances where pre-poll (SKM–BJP in 2019 was post-poll; 2024 contested separately — sourced), majority
  17, history/compare_with within Sikkim.
- Districts/regions, person links (run-once v1), current track, About rows: as Phase 4A.
- Not in scope: seat analysis recompute (later, all elections); by-elections; other states.

## 5. Done when

The 4 elections load on a fresh and an upgraded (production copy) DB, setup twice changes nothing, winners match
ECI's party totals, seat types are 2 SC / 12 ST / 18 GEN, every seat has a district and region, the map colours 31
seats and Sangha shows in lists and its seat page, the Regions layer works, 2024 shows leaders, party profiles,
photos, affidavits and the Sikkim party units, About lists the 4 elections; then pushed to production (backup branch
first, Render deploy, prod checks).
