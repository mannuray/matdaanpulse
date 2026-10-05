# Phase 3A: Goa, Manipur, Punjab, Uttarakhand, Uttar Pradesh 2012-2022 (history): design

Date: 2026-10-05. Status: agreed in discussion (scope, depth, regions, order).
Context: `docs/SEEDING_PLAYBOOK.md` (historical track), Phase 2A/2B specs and plans. Counting day for these states'
next elections: 27 Feb 2027 (Phase 3B prepares that).

## 1. Goal

All 15 assembly elections of Goa, Manipur, Punjab, Uttarakhand and Uttar Pradesh in 2012, 2017 and 2022 are on the
site, results only (historical track): every candidate + NOTA with real ECI votes, SC/ST, electors, turnout, phase;
manifests with alliances; districts and regions (so the Regions map layer works); person links; About page. Seat
history, swing and regions then work on counting day 2027.

## 2. Decisions (user, 2026-10-05)

- Results only for all three years, **including 2022**. Leaders, photos, party profiles and affidavits come with the
  2027 elections (Phase 3B), for **every** candidate as nominations come in (not top 4).
- Regions (district-based, sourced):
  - Goa: North Goa / South Goa, **by seat number** (AC 1-20 / 21-40; Ponda taluka's seats are South Goa in election
    terms although the taluka is in North Goa district; Kushavati district, split from South Goa in Dec 2025, is South Goa).
  - Uttarakhand: Garhwal (Uttarkashi, Chamoli, Rudraprayag, Tehri Garhwal, Dehradun, Pauri Garhwal, Haridwar; 41 seats) /
    Kumaon (Almora, Bageshwar, Champawat, Nainital, Pithoragarh, Udham Singh Nagar; 29).
  - Punjab: Majha (Amritsar, Tarn Taran, Gurdaspur, Pathankot; 25) / Doaba (Jalandhar, Kapurthala, Hoshiarpur, SBS
    Nagar; 23) / Malwa (the other 15 districts; 69).
  - Manipur: Valley (Imphal East, Imphal West, Thoubal, Bishnupur, Kakching, Jiribam; 40) / Hills (the other 10; 20).
  - Uttar Pradesh: the seven Lokniti-CSDS regions (option A): Paschim 44, Rohilkhand 52, Doab 73, Awadh 73,
    Bundelkhand 19, Purvanchal (East) 81, North-East 61 (district lists in the research notes of the plan; totals 403).
- Order: Goa → Manipur → Uttarakhand → Punjab → Uttar Pradesh (small first, to catch report quirks cheaply).

## 3. Sources (verified 2026-10-05)

ECI old-site statistical reports (`/api/old-site-statistical-report-data?docid=`):

| | 2012 | 2017 | 2022 |
|---|---|---|---|
| Goa | 3856 (one PDF) | 3862 | 14168 |
| Manipur | 3712 (one PDF) | 3713 | 14166 |
| Punjab | 3455 (one PDF) | 3614 | 14165 |
| Uttarakhand | 3231 (one PDF) | 3470 | 14169 |
| Uttar Pradesh | 3262 (one PDF, 663 pp) | 3471 | 14185 |

2012 = one text PDF per state (2011 layout, `pdftotext -layout`); 2017 = XLSX/PDF set (2016 naming: "Summry",
"Poltical"); 2022 = numbered XLSX set (names vary by state; match on keywords).

Reserved seats per ECI: Goa SC 1 / ST 0 (all years); Manipur SC 1 / ST 19; Punjab SC 34; Uttarakhand SC 13 / ST 2;
**Uttar Pradesh 2012 SC 85 / ST 0, 2017 and 2022 SC 84 / ST 2** (reservation changed within the 2008 delimitation;
seat history follows the seat number, the type is per election). Poll dates as ECI reports them (re-polls and adjourned
polls count as their own dates); counting days 6 Mar 2012, 11 Mar 2017, 10 Mar 2022.

Maps: the existing 2008 files (`ga/mn/pb/uk/up_ac_2008.geojson`). ECI's 2022 results site has no boundary files.

## 4. Approach

- Registry entries for 15 **new** elections (no old seeds; Phase 2B's new-election path), each with its own reserved
  counts, delimitation `'2008'`, counting date; five new state configs (slugs ga, mn, pb, uk, up).
- Parse → ECI-internal cross-check → `scraper/data/<slug>/vs-<year>.json` → generated seeds, as before; parser fixes
  test-first; documented ECI table slips as exceptions.
- Parties: existing ids reused (no `_XX` forks; the alliance-gap check stays on); new small parties get bare records.
- Manifests per election: pre-poll alliances with sources, majority mark, history/compare_with (2017 → 2012, 2022 →
  2017 + 2012).
- Districts/regions: a sourced seat → district file per state (Goa: by seat number) and the region grouping above; a
  generated districts/regions seed per state, scoped to the state's VS elections of the 2008 delimitation.
- Maps: a numbering check of each map against the report's seat names; the frontend matches a Vidhan Sabha map feature
  to its seat by seat number when the names differ (a VS map covers one state, so the number is unique).
- Person links per state (same rules), run-once.
- About: 15 rows "real".
- Not in scope: leaders, photos, party profiles, affidavits (Phase 3B); seat analysis recompute (later, all elections).

## 5. Done when

All 15 elections load on a fresh and an upgraded DB (setup twice, no change), winners match ECI's party totals, every
seat has a district and region, the maps colour every seat, the Regions layer works for each state, and About lists them.
