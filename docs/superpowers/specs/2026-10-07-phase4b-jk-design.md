# Phase 4B-5: Jammu & Kashmir (2008, 2014, 2024): design

Date: 2026-10-07. Status: agreed in discussion (user, 2026-10-07: "yes").
Context: Phase 4B-1…4 specs (Sikkim, Arunachal, Andhra, Maharashtra): same pipeline, depth and production steps.

## 1. Goal

Jammu & Kashmir's assemblies on the site: 2008 and 2014 (the state, 87 seats on the 1995 boundaries, Ladakh's 4 seats
included) and 2024 (the union territory, 90 seats on the 2022 boundaries): every candidate + NOTA with real ECI votes,
seat types, electors, turnout; manifests with alliances; districts and regions; person links; About. 2024 is the
sitting assembly: current track (leaders, top-party profiles, party units, top-4 photos, affidavits).

## 2. Decisions (user, 2026-10-07)

- **Years 2008, 2014, 2024** (no 2019 election). The 2008 delimitation never applied to J&K's assembly:
  - 2008 and 2014: delimitation `'1995'`, 87 seats, majority 44; compared with each other only.
  - 2024: delimitation `'2022'`, 90 seats, majority 46; its seats are `new` (no history), as Assam 2026.
  - The Lieutenant Governor's nominated members are not elected and are not modelled.
- **Ladakh's 4 seats (Nubra, Leh, Kargil, Zanskar) stay in the 2008 and 2014 J&K elections.** The Ladakh state row
  (id 17) is untouched.
- **Regions:** 2008/2014 = Jammu, Kashmir, Ladakh (the divisions); 2024 = Jammu, Kashmir. **Districts:** J&K's 20 plus
  Leh and Kargil (the 22 districts of 2008-2019). Seat → district sourced separately for each boundary set.
- **Maps:** 2024 → new `jk_ac_2022.geojson` from ECI's 2024 boundary file (Wayback copy of
  `results.eci.gov.in/AcResultGenOct2024/ac/U08.js`: 90 numbered seats + 4 unnumbered areas). 2008/2014 → the existing
  `jk_ac_2008.geojson` (it holds the 87 seats of the 1995 boundaries) is published under its true name
  `jk_ac_1995.geojson` (same content, seat numbers checked against the reports) and the old path redirects to it.
- **Alliances:** 2008 and 2014 none (the NC–INC and PDP–BJP governments formed after the results); 2024 NC + INC
  (INDIA), smaller partners only if sourced.
- **Lineage (note-only, sourced):** JKAP (Apni Party) ← JKPDP breakaway (2020); DPAP ← INC breakaway (2022). PDP's 1999
  origin in INC is before our data and is left out.
- **2024 current track:** CM Omar Abdullah, Deputy CM Surinder Kumar Choudhary, cabinet, Speaker Abdul Rahim Rather,
  LoP Sunil Sharma, party chiefs; profiles of top parties not yet profiled (JKNC, JKPDP as needed); party units
  (`units-9.json` → `seed_party_units_v6.sql`); top-4 photos; affidavits — curated lists user-approved before seeding.

## 3. Sources (verified 2026-10-07)

| | Source | Format | Counting |
|---|---|---|---|
| JK 2008 | old-site docid 3796 | one PDF, 145 pages, text layer | 28 Dec 2008 |
| JK 2014 | docid 3797 | one PDF, 138 pages, text layer | 23 Dec 2014 |
| JK 2024 | new-site category 7 | XLSX set | 8 Oct 2024 |

Results site 2024 `AcResultGenOct2024/` (ECI code U08; Wayback); MyNeta slug checked before running. State id 13.
Reserved seats read from the reports and checked (expected 2008/2014 SC 7, ST 0; 2024 SC 7, ST 9).

## 4. Approach

- **Registry:** `p4` gains per-election overrides for delimitation and reserved counts (today it fixes `'2008'` and the
  state's counts); J&K elections set `seats`, `delimitation` and `reserved` per year. Ids
  `a0130000-0000-4000-8000-00000000<year>`, prefix `JK_VS<yy>_`.
- **Regions:** `regions-cli` reads one districts file per boundary set (`districts-1995.json`, `districts-2022.json`)
  and scopes each to the elections of that delimitation; other states keep `districts.json` (2008).
- Parse, cross-check, winners vs ECI's party totals per year; person links (Kashmiri names checked; `looseNames` only if
  needed, with a test); current track; About; docs; final review; production.
- Not in scope: seat analysis recompute; by-elections (Budgam, Nagrota 2025); Ladakh as its own state.

## 5. Done when

The 3 elections load on a fresh and an upgraded (production copy) DB, setup twice changes nothing, winners match ECI,
2008 ↔ 2014 compare and 2024 shows no history, both maps colour every seat, every seat has a district and region,
2024 shows leaders, profiles, units, photos, affidavits, About lists the 3 elections with the boundary note; then on
production (backup first).
