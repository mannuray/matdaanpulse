# Phase 4A: Delhi, Haryana, Jharkhand, Odisha (2008/2009-2025): design

Date: 2026-10-05. Status: agreed in discussion (scope, years, depth, order); regions proposed here for review.
Context: `docs/SEEDING_PLAYBOOK.md`, Phase 2 spec (current track, §5) and Phase 3A spec (new-election history path).

## 1. Goal

The 2024/25 states, for completeness, starting with the four easiest. Every assembly election of Delhi, Haryana,
Jharkhand and Odisha since the 2008 delimitation is on the site (17 elections): every candidate + NOTA with real ECI
votes, SC/ST, electors, turnout, phases; manifests with alliances; districts and regions; person links; About. Each
state's **latest election is its sitting assembly**, so it gets the current-track depth of Bihar 2025 and the 2026
states. Push to production after all four (then Sikkim, Arunachal, Andhra, Maharashtra, J&K one by one).

## 2. Decisions (user, 2026-10-05)

- Years: every election since the 2008 delimitation (Delhi 2008, 2013, 2015, 2020, 2025; Haryana, Jharkhand, Odisha
  2009, 2014, 2019, 2024). Delimitation `'2008'` for all.
- Earlier years: results only (historical track).
- Latest year (DL 2025, HR 2024, JH 2024, OD 2024): current track — leaders (CM, Leader of Opposition, cabinet, party
  chiefs; curated with sources, user-approved) with credited photos; profiles of the top parties (won a seat, 1 %+ of
  the vote, or alliance member; researched, user-reviewed); **top-4 candidate photos per seat**; winners' affidavits
  from MyNeta.
- Order: Delhi → Haryana → Jharkhand → Odisha (easy first). Other states with assemblies are filled only as their own
  election approaches.
- Regions (district-based unless stated, sourced) — **proposed, for review**:
  - Delhi: its 7 Lok Sabha seats (each assembly seat lies in one; districts cut across seats). "Districts" = the 11
    revenue districts for the district field.
  - Haryana: its 6 administrative divisions (Ambala, Faridabad, Gurugram, Hisar, Karnal, Rohtak). The political belts
    (GT Road, Deswali, Ahirwal, Bagar) are the alternative; they are less well defined.
  - Jharkhand: its 5 divisions (Santhal Pargana, North Chotanagpur, South Chotanagpur, Kolhan, Palamu).
  - Odisha: its 3 revenue divisions (Northern, Central, Southern).

## 3. Sources (verified 2026-10-05)

ECI statistical reports: old site `old-site-statistical-report-data?docid=`, new site `election-result?category_id=`.

| | Source | Files | Seats (SC/ST) | Phases | Counting |
|---|---|---|---|---|---|
| DL 2008 | docid 3876 | one PDF | 70 (12/0) | 2 (29 Nov; AC 39 adjourned to 13 Dec) | 8 Dec 2008 |
| DL 2013 | 3877 | one PDF | 70 (12/0) | 1 | 8 Dec 2013 |
| DL 2015 | 3878 | one PDF | 70 (12/0) | 1 | 10 Feb 2015 |
| DL 2020 | 12027 | XLS set | 70 (12/0) | 1 | 11 Feb 2020 |
| DL 2025 | category 10 | XLSX set | 70 (12/0) | 1 | 8 Feb 2025 |
| HR 2009 | 3826 | one PDF | 90 (17/0) | 1 | 22 Oct 2009 |
| HR 2014 | 3827 | one PDF | 90 (17/0) | 1 | 19 Oct 2014 |
| HR 2019 | 11697 | XLS set | 90 (17/0) | 1 | 24 Oct 2019 |
| HR 2024 | category 6 | XLSX set | 90 (17/0) | 1 | 8 Oct 2024 |
| JH 2009 | 3786 | one PDF | 81 (9/28) | 5 | 23 Dec 2009 |
| JH 2014 | 3787 | one PDF | 81 (9/28) | 5 | 23 Dec 2014 |
| JH 2019 | 11813 | XLS set | 81 (9/28) | 5 | 23 Dec 2019 |
| JH 2024 | category 9 | XLSX set | 81 (9/28) | 2 | 23 Nov 2024 |
| OD 2009 | 3630 | one PDF | 147 (24/33) | 2 | 16 May 2009 |
| OD 2014 | 3631 | one PDF | 147 (24/33) | 2 | 16 May 2014 |
| OD 2019 | 11679 | XLS set | 146 + Patkura (24/33) | 4 | 23 May 2019 |
| OD 2024 | category 4 | XLSX set | 147 (24/33) | 4 | 4 Jun 2024 |

Latest elections: results sites are gone live but archived (Wayback) with every seat page; photo JPEGs still served
live (`results.eci.gov.in/uploads1/candprofile/…`). Bases / ECI codes: DL `ResultAcGenFeb2025/` U05, HR
`AcResultGenOct2024/` S07, JH `ResultAcGenNov2024/` S27, OD `AcResultGenJune2024/` S18. MyNeta: `delhi2025`,
`haryana2024`, `jharkhand2024`, `odisha2024` (winner pages look incomplete: check coverage).

Maps: the existing 2008 files; numbering complete and matching (dl 70, hr 90, od 147; jh 81 seats in 95 features).
State ids: DL 24, HR 11, JH 14, OD 26.

## 4. Approach

- Registry: 17 new elections (Phase 3A path: `newElection`, no old seeds, no corrections seed), each with its own
  counting date (the year-keyed `COUNTING` map does not fit), reserved counts, file names as ECI serves them (HR/OD
  2024 hyphenated; 2019 `.xls`); election ids `a0<state id>0000-0000-4000-8000-00000000<year>`.
- Parser, test-first:
  - pre-NOTA 2008/2009 PDFs (separate TOTAL and "Turn Out" lines, a different summary layout);
  - JH 2014's malformed PDF (a duplicated block of ~58 detailed seats; summary missing 7 seats → `missing-summaries.json`);
  - `.xls` (2019) through the same SheetJS path as `.xlsx`.
- Sourced fixes: OD 2014 highlights say GEN 88/SC 25/ST 34, the seats give 24/33 (use the seats); OD 2019 Patkura
  (AC 96, countermanded, polled later in 2019): included from an ECI source if one is found, else `excludeSeats: [96]`
  as TN 2016 (and the About note says so). Polling-station re-polls do not add phases.
- Manifests: pre-poll alliances with sources (Jharkhand: INDIA/UPA vs NDA; Haryana, Delhi, Odisha mostly parties
  alone), majority mark, history/compare_with within the state.
- Districts/regions: `scraper/data/<slug>/districts.json` (sourced) → `seed_<slug>_districts_regions.sql`, scoped to
  the state's 2008-delimitation VS elections. Delhi's region = Lok Sabha seat (sourced AC → PC list).
- Person links (run-once v1 across all years of the state).
- Current track for the latest year, as Bihar 2025 / 2026: leaders seed, party profiles seed, candidate photos (top 4,
  from the archived results pages, S3 + `image_credits`), winners' affidavits (MyNeta).
- About: 17 rows "real" (notes where a seat is missing).
- Not in scope: seat analysis recompute (later, all elections); other states.

## 5. Done when

All 17 elections load on a fresh and an upgraded (production copy) DB, setup twice changes nothing, winners match ECI's
party totals, every seat has a district and region, the maps colour every seat, the Regions layer works, the latest
elections show leaders, party profiles, photos and affidavits, About lists them; then pushed to production (backup
branch first, Render deploy, prod checks).
