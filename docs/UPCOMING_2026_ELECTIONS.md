# Upcoming 2026 State Assembly Elections — Preparation Tracker

> **Done (2026-10-04, Phase 2B).** All five 2026 elections are loaded; see `docs/FEATURES.md` and `docs/SEEDING_PLAYBOOK.md`.
> This tracker is historical and partly wrong: **Assam 2026 follows the 2023 delimitation** (126 seats, 9 SC, 19 ST), not 2008.

## Elections

| # | State | Seats | Delimitation | Comparable Elections | Expected Date |
|---|-------|-------|-------------|---------------------|---------------|
| 1 | **West Bengal** | 294 | 2008 | 2011, 2016, 2021, **2026** | April–May 2026 |
| 2 | **Kerala** | 140 | 2008 | 2011, 2016, 2021, **2026** | April 2026 |
| 3 | **Tamil Nadu** | 234 | 2008 | 2011, 2016, 2021, **2026** | Before May 10, 2026 |
| 4 | **Assam** | 126 | 2008 | 2011, 2016, 2021, **2026** | April–May 2026 |
| 5 | **Puducherry** | 30 | 2008 | 2011, 2016, 2021, **2026** | 2026 |

---

## Standard Playbook (repeat for each state)

All states had their last delimitation in 2008. Boundaries are frozen until after 2026. So for each state, elections from 2011 onwards share the same map and are fully comparable.

### Step 1 — GeoJSON
- [ ] Verify `{state_code}_ac.geojson` exists in `frontend/public/geo/`
- [ ] Check properties: `ac_name`, `ac_no`, `ac_category` (GEN/SC/ST), `st_name`
- [ ] Verify seat count matches expected
- [ ] Same GeoJSON used for all elections in the same delimitation era

### Step 2 — Historical Data (oldest first)
Seed each past election in chronological order. This powers swing, dominance, anti-incumbency, party switcher, and margin trend analysis.

**For each historical election (e.g. 2011 → 2016 → 2021):**

#### 2a. Research
- [ ] Find ECI results for that election (results.eci.gov.in or Wikipedia)
- [ ] Identify parties that contested + alliances at that time
- [ ] Note: alliances shift between elections — seed the parties, define alliances in manifest

#### 2b. Parties
- [ ] Ensure all parties exist in `parties` table (id, name, color, abbreviation)
- [ ] Add any new state-specific parties not already seeded

#### 2c. Election + Constituencies
- [ ] Generate UUID for the election
- [ ] INSERT election row (name, type=VS, state_id, year)
- [ ] INSERT constituencies (id pattern: `{ST}_VS{YY}_{no}_{NAME}`, election_id, name, const_no, type)
- [ ] Constituency names must match GeoJSON `ac_name` (uppercase, underscores for spaces)

#### 2d. Candidates + Results
- [ ] INSERT candidates (top 2-3 per seat minimum — winner + runner-up + notable 3rd)
- [ ] INSERT results (candidate_id, const_id, votes, margin, status=WON/LOST)
- [ ] For full candidate data (all contestants per seat): scrape from ECI if available

#### 2e. Write Seed File
- [ ] Save as `database/seed_{state}_{year}.sql` (e.g. `seed_wb_vs_2011.sql`)
- [ ] Wrap in BEGIN/COMMIT transaction

### Step 3 — Current Election (2026)
- [ ] Create election row + 294 constituencies (candidates added later when nominations finalize)
- [ ] Write `database/seed_{state}_vs_2026.sql`

### Step 4 — Manifest
- [ ] Define current alliances + colors
- [ ] Party-to-alliance mapping
- [ ] Leaders + VIP seats
- [ ] `geo.map_url` → `{state_code}_ac.geojson`
- [ ] `history` array — UUIDs of historical elections (oldest first)
- [ ] `history_years` — parallel array of year labels
- [ ] `compare_with` — most recent historical election UUID (for swing tab)
- [ ] `vote_splits` — spoiler party config if applicable

### Step 5 — Scraper (for live election day)
- [ ] Create/adapt ECI scraper for the state
- [ ] Test against historical ECI result pages
- [ ] Wire up for live result ingestion on election day

---

## West Bengal — Progress

### Step 1 — GeoJSON
- [x] `wb_ac_2008.geojson` exists — 294 features
- [x] Properties: `ac_name`, `ac_no`, `ac_category`, `st_name` ✓
- [x] Seat count: 294 ✓

### Step 2 — Historical Data
- [x] **WB VS 2011** — `database/data/wb_vs_2011.json` (294 results, winner+runner-up+votes+margin)
- [x] **WB VS 2016** — `database/data/wb_vs_2016.json` (294 results, winner+runner-up+votes+margin)
- [x] **WB VS 2021** — `database/data/wb_vs_2021.json` (294 results, margin only — no individual vote counts from source)
- [ ] GeoJSON name fixes needed: 13 spelling mismatches (BURDWAN→BARDHAMAN, SERAMPORE→SREERAMPUR, etc.)

### Step 3 — WB VS 2026
- [ ] Election row + 294 constituencies

### Step 4 — Manifest
- [ ] Alliances: TMC vs BJP+ vs Left-Congress
- [ ] History + compare_with config

### Step 5 — Scraper
- [ ] ECI adapter for WB

---

## Kerala — Progress

### Step 1 — GeoJSON
- [x] `kl_ac_2008.geojson` exists — 141 features (140 seats + 1 duplicate: ac_no 87 KOTHAMANGALAM appears twice)
- [x] Properties: `ac_name`, `ac_no`, `ac_category`, `st_name` ✓
- [ ] Fix duplicate ac_no 87 (remove one copy)
- [ ] Fix 3 broken GeoJSON names: #1 "MA NJESHWAR" (space), #18 "SULTHANBATHERY (S" (truncated), #134 "THIRUVANANTHAPURA" (truncated)
- [ ] 13 additional spelling mismatches with ECI names (same pattern as WB)

### Step 2 — Historical Data
- [x] **KL VS 2011** — `database/data/kl_vs_2011.json` (140 results, winner+runner-up+votes+margin)
- [x] **KL VS 2016** — `database/data/kl_vs_2016.json` (140 results, winner+runner-up+votes+margin)
- [x] **KL VS 2021** — `database/data/kl_vs_2021.json` (140 results, margin only — no individual vote counts from source)

### Step 3 — KL VS 2026
- [ ] Election row + 140 constituencies

### Step 4 — Manifest
- [ ] Alliances: LDF (CPM+CPI+...) vs UDF (INC+IUML+...) vs NDA (BJP+...)
- [ ] History + compare_with config

### Step 5 — Scraper
- [ ] ECI adapter for KL

---

## Tamil Nadu — Progress

### Step 1 — GeoJSON
- [x] `tn_ac_2008.geojson` exists — 235 features (234 seats + 1 duplicate: ac_no 169 NANNILAM appears twice)
- [x] Properties: `ac_name`, `ac_no`, `ac_category` (GEN/SC/ST), `st_name` ✓
- [ ] Fix duplicate ac_no 169 (remove one copy)
- [ ] Fix #69 & #70 both named VANDAVASI (#70 should be GINGEE)
- [ ] Fix #140 & #141 both named TIRUCHIRAPPALLI (should be WEST/EAST)
- [ ] Fix truncated: #11 DR.RADHAKRISHNAN NAGA, #19 CHEPAUK-THIRUVALLIKEN, #45 KILVAITHINANKUPPAM(SC
- [ ] 35 total spelling/formatting mismatches with ECI names

### Step 2 — Historical Data
- [x] **TN VS 2011** — `database/data/tn_vs_2011.json` (234 results, winner+runner-up+votes+margin)
- [x] **TN VS 2016** — `database/data/tn_vs_2016.json` (232 results — #134 Aravakurichi, #174 Thanjavur postponed)
- [x] **TN VS 2021** — `database/data/tn_vs_2021.json` (234 results, margin only)

### Step 3 — TN VS 2026
- [ ] Election row + 234 constituencies

### Step 4 — Manifest
- [ ] Alliances: DMK+ (DMK+INC+CPM+CPI+VCK) vs AIADMK+ (AIADMK+BJP+PMK) vs NTK
- [ ] History + compare_with config

### Step 5 — Scraper
- [ ] ECI adapter for TN

---

## Assam — Progress

### Step 1 — GeoJSON
- [x] `as_ac_2008.geojson` exists — 133 features (126 seats + 7 duplicates: ac_nos 8, 31, 33, 42, 63, 121)
- [x] Properties: `ac_name`, `ac_no`, `ac_category`, `st_name` ✓
- [ ] Fix 7 duplicate ac_nos (remove extra copies)
- [ ] Only GEN category shown — SC/ST data may be missing
- [ ] 1 spelling mismatch: #7 ECI "KATLICHERA" vs GeoJSON "KATLICHERRA"

### Step 2 — Historical Data
- [x] **AS VS 2011** — `database/data/as_vs_2011.json` (126 results, winner+runner-up+votes+margin)
  - Source had copy errors: #16 Haflong and #21 Mankachar — corrected from resultuniversity.com
  - INC 78, AIUDF 18, BOPF 12, AGP 10, BJP 5, IND 2, AITC 1
- [x] **AS VS 2016** — `database/data/as_vs_2016.json` (126 results, winner+runner-up+votes+margin)
  - 4 geo mismatches: KATLICHERA/KATLICHERRA, KATIGORAH/KATIGORA, BOKO SC/BOKO, RANGIA/RANGIYA
  - BJP 60, INC 26, AGP 14, AIUDF 13, BPF 12, IND 1
- [x] **AS VS 2021** — `database/data/as_vs_2021.json` (126 results, margin only)
  - BJP 60, INC 29, AIUDF 16, AGP 9, UPPL 6, BOPF 4, CPM 1, IND 1

### Step 3 — AS VS 2026
- [ ] Election row + 126 constituencies

### Step 4 — Manifest
- [ ] Alliances: NDA (BJP+AGP+UPPL+BPF) vs Congress+ (INC+AIUDF+...)
- [ ] History + compare_with config

### Step 5 — Scraper
- [ ] ECI adapter for AS

---

## Puducherry — Progress

### Step 1 — GeoJSON
- [x] `py_ac_2008.geojson` exists — 30 features, no duplicates
- [x] Properties: `ac_name`, `ac_no`, `ac_category` (GEN/SC), `st_name` ✓
- [x] Seat count: 30 ✓
- [ ] Fix #10: GeoJSON "KAMRAJ NAGAR" should be "KAMARAJ NAGAR" (missing A)
- [ ] Fix #28: GeoJSON "NERAVY- T.R. PATTIN" truncated (should be "NERAVY T.R. PATTINAM")

### Step 2 — Historical Data
- [x] **PY VS 2011** — `database/data/py_vs_2011.json` (30 results, winner+runner-up+votes+margin)
  - AINRC 15, INC 7, AIADMK 5, DMK 2, IND 1
  - N. Rangasamy won both #7 Kadirgamam and #8 Indira Nagar (vacated #8, by-election held)
- [x] **PY VS 2016** — `database/data/py_vs_2016.json` (30 results, winner+runner-up+votes+margin)
  - INC 15, AINRC 8, AIADMK 4, DMK 2, IND 1
  - Closest: #27 Karaikal South margin 20 votes
- [x] **PY VS 2021** — `database/data/py_vs_2021.json` (30 results, winner names + margin only)
  - AINRC 10, BJP 6, IND 6, DMK 6, INC 2

### Step 3 — PY VS 2026
- [ ] Election row + 30 constituencies

### Step 4 — Manifest
- [ ] Alliances: NDA (AINRC+BJP+AIADMK) vs DMK+ (DMK+INC+VCK+CPM)
- [ ] History + compare_with config

### Step 5 — Scraper
- [ ] ECI adapter for PY
