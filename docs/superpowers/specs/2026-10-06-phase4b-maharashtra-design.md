# Phase 4B-4: Maharashtra (2009-2024): design

Date: 2026-10-06. Status: agreed in discussion (user, 2026-10-06: "seems good go ahead").
Context: Phase 4B-1/2/3 specs (Sikkim, Arunachal, Andhra): same pipeline, depth and production steps.

## 1. Goal

Maharashtra's assemblies since the 2008 delimitation (2009, 2014, 2019, 2024; 288 seats): every candidate + NOTA with
real ECI votes, seat types, electors, turnout; manifests with alliances; districts and regions; person links; About.
2024 is the sitting assembly: current track (leaders, top-party profiles, party units, top-4 photos, affidavits).

## 2. Decisions (user, 2026-10-06)

- Years 2009, 2014, 2019, 2024; delimitation `'2008'`; majority 145. Earlier years results only.
- **Regions = the six used in election coverage:** Mumbai (Mumbai City + Mumbai Suburban), Konkan (incl. Thane,
  Palghar, Raigad, Ratnagiri, Sindhudurg), North Maharashtra (Nashik, Dhule, Nandurbar, Jalgaon, Ahmednagar), Western
  Maharashtra (Pune, Satara, Sangli, Kolhapur, Solapur), Marathwada (Chhatrapati Sambhajinagar, Jalna, Beed, Latur,
  Dharashiv, Nanded, Parbhani, Hingoli), Vidarbha (Nagpur and Amravati divisions). Districts = the current 36. Exact
  district → region list sourced (Ahmednagar is sometimes counted in Western Maharashtra: follow the source, note it).
- **Splits** (already in `lineage.json`): SHS 2022 (Shinde = name-holder, successor; SHSUBT faction), NCP 2023/24
  (Ajit Pawar = name-holder; NCPSP faction). **Added:** MNS ← SHS breakaway (2006, note only; sourced).
- **Alliances:** 2009 Democratic Front (INC + NCP) vs BJP + SHS; 2014 none (four-way); 2019 NDA (BJP + SHS) vs UPA
  (INC + NCP); 2024 Mahayuti (BJP, SHS, NCP) vs Maha Vikas Aghadi (INC, SHSUBT, NCPSP); smaller partners only if
  sourced.
- **Map:** `mh_ac_2008.geojson` is fine (288 numbered seats, 14 unnumbered slivers = 0.18% of the area); kept.
- **2024 current track:** CM Devendra Fadnavis, Deputy CMs Eknath Shinde and Ajit Pawar, cabinet, Speaker, no LoP (no
  opposition party reached 29 seats), party chiefs; profiles of top parties not yet profiled; party units
  (`units-8.json` → `seed_party_units_v5.sql`); top-4 photos; affidavits — lists user-approved before seeding.

## 3. Sources (verified 2026-10-06; statistical-reports listing)

| | Source | Counting |
|---|---|---|
| MH 2009 | old-site docid 3724 | 22 Oct 2009 |
| MH 2014 | docid 3726 | 19 Oct 2014 |
| MH 2019 | docid 11699 | 24 Oct 2019 |
| MH 2024 | new-site category 8 | 23 Nov 2024 |

Formats checked at fetch. Results site 2024 `ResultAcGenNov2024/` (ECI code S13, as Jharkhand's site); MyNeta slug
checked before running. State id 20. Reserved seats SC 29 / ST 25 (checked against the reports).

## 4. Approach

As Andhra minus `seatRange`: registry `p4` (ids `a0200000-0000-4000-8000-00000000<year>`); parse, test-first for any
layout deviation; winners vs ECI's party totals per year; lineage MNS; districts/regions, links (person names checked;
`looseNames` only if Marathi names reorder), current track, About, docs; final review; production.

## 5. Done when

The 4 elections load on a fresh and an upgraded (production copy) DB, setup twice changes nothing, winners match ECI,
splits show as splits (2019 SHS seat → 2024 SHSUBT), every seat has a district and region, 2024 shows leaders,
profiles, units, photos, affidavits, About lists the 4 elections; then on production (backup first).
