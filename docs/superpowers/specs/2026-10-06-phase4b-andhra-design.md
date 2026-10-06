# Phase 4B-3: Andhra Pradesh (2009-2024): design

Date: 2026-10-06. Status: agreed in discussion (user, 2026-10-06: "seems good go ahead").
Context: Phase 4B-1 Sikkim and 4B-2 Arunachal specs (same pipeline, depth and production steps).

## 1. Goal

Andhra Pradesh's assemblies since the 2008 delimitation on the site (2009, 2014, 2019, 2024; 175 seats): every
candidate + NOTA with real ECI votes, seat types, electors, turnout; manifests with alliances; districts and regions;
person links; About. 2024 is the sitting assembly: current track (leaders, top-party profiles, party units, top-4
photos, affidavits).

## 2. Decisions (user, 2026-10-06)

- **2009 and 2014 come from undivided-state reports** (294 seats: 1-119 are now Telangana, 120-294 are today's Andhra
  seats 1-175 in the same order). Both are stored as Andhra elections with **only the 175 Andhra seats, renumbered
  (new = old − 119)**. 2014's 175 MLAs formed Andhra's first assembly (a normal Andhra election, majority 88). 2009
  is labelled as the Andhra seats of the undivided assembly: no majority line, an About note; the other 119 seats
  belong to Telangana's history later.
- Seat numbers and names follow the 2008 delimitation throughout (`'2008'`); the 2014 transfer of 7 Polavaram mandals
  from Telangana is not modelled (seat geometry from ECI's 2024 file).
- **Regions = 3:** Uttarandhra (old Srikakulam, Vizianagaram, Visakhapatnam districts), Coastal Andhra (old East and
  West Godavari, Krishna, Guntur, Prakasam, Nellore), Rayalaseema (old Kurnool, Anantapur, YSR Kadapa, Chittoor).
  **Districts = the 26 current ones** (since 2022), seat → district sourced.
- **Lineage:** Praja Rajyam Party → INC merger (2011; history carries forward); YSRCP ← INC breakaway (2011, note
  only). Dates and sources from research.
- **Map:** the current `ap_ac_2008.geojson` is mis-numbered (177 features, Ichchapuram = 3): rebuilt from ECI's 2024
  boundary file (`geo-cli.ts AP --year 2024 --write`), as Sikkim.
- **Alliances:** 2014 TDP + BJP (NDA); 2019 none; 2024 NDA = TDP + JSP + BJP (sourced).
- **2024 current track:** leaders (CM N. Chandrababu Naidu, Deputy CM Pawan Kalyan, cabinet, Speaker, LoP if any,
  party chiefs), profiles of top parties not yet profiled (TDP, YSRCP, JSP as needed), party units (`units-7.json` →
  `seed_party_units_v4.sql`), top-4 photos, affidavits — curated lists user-approved before seeding.

## 3. Sources (verified 2026-10-06)

| | Source | Format | Seats in report |
|---|---|---|---|
| AP 2009 | old-site docid 4054 | one PDF (448 pages) | 294 (undivided) → 175 kept |
| AP 2014 | docid 4055 | one PDF (492 pages) | 294 (undivided) → 175 kept |
| AP 2019 | docid 11673 | XLS set | 175 |
| AP 2024 | new-site category 2 | XLSX set | 175 |

Counting dates: 16 May 2009, 16 May 2014, 23 May 2019, 4 Jun 2024. Results site 2024: `AcResultGenJune2024/`, ECI
code S01; MyNeta slug checked before running. State id 2.

## 4. Approach

- Registry: `p4` elections, ids `a0020000-0000-4000-8000-00000000<year>`; 2009/2014 with
  `seatRange: { from: 120, to: 294, offset: 119 }` — the loader keeps those seats (detailed + summaries) and renumbers
  them; the party performance table covers all 294 seats, so its cross-check is skipped for a partial report (every
  seat-level check still runs) and the subset's tallies are checked against the seat winners instead.
- Seat types from the reports (SC/ST counts for the 175 checked against the 2019/2024 Highlights).
- Districts/regions, person links, current track, About (2009 note), docs: as Sikkim/Arunachal.
- Not in scope: seat analysis recompute; Telangana; by-elections.

## 5. Done when

The 4 elections load on a fresh and an upgraded (production copy) DB, setup twice changes nothing, 2014-2024 winners
match ECI's party totals (2009/2014 subsets match the per-seat winners), the map colours 175 seats from ECI's
geometry, every seat has a district and region, 2024 shows leaders, profiles, units, photos, affidavits, About lists
the 4 elections with the 2009 note; then on production (backup first).
