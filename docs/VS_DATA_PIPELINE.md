# Vidhan Sabha Data Pipeline

Step-by-step guide for adding historical VS election data for a new state. Follows the pattern established with Bihar and West Bengal.

## Prerequisites

- GeoJSON file for the state's assembly constituencies at `frontend/public/geo/{state}_ac.geojson`
  - Properties needed: `ac_no`, `ac_name`, `ac_category` (GEN/SC/ST), `st_name`
  - Polygon winding must be **clockwise** (D3 spherical geometry requirement). Check with:
    ```bash
    python3 -c "
    import json
    with open('frontend/public/geo/{state}_ac.geojson') as f:
        geo = json.load(f)
    from shapely.geometry import shape
    cw = sum(1 for f in geo['features'] if not shape(f['geometry']).exterior.is_ccw)
    ccw = sum(1 for f in geo['features'] if shape(f['geometry']).exterior.is_ccw)
    print(f'CW: {cw}, CCW: {ccw}')
    "
    ```
  - If CCW, reverse winding: reverse each ring's coordinate array

- JSON data files at `database/data/{state}_vs_{year}.json` with at minimum:
  ```json
  { "results": [{ "const_no": 1, "const_name": "...", "winner": { "name": "...", "party": "...", "votes": 12345 }, "runner_up": { "name": "...", "party": "...", "votes": 10000 }, "margin": 2345 }] }
  ```

## Step 1: Identify & Create New Parties

### 1a. Extract unique parties from all JSON files

```bash
python3 -c "
import json
for year in [YEAR1, YEAR2, YEAR3]:
    with open(f'database/data/{state}_vs_{year}.json') as f:
        data = json.load(f)
    parties = sorted(set(
        p for r in data['results']
        for p in [r['winner']['party'], r['runner_up']['party']]
    ))
    print(f'{year}: {parties}')
"
```

### 1b. Map each party abbreviation to existing DB IDs

Common mappings already in DB:
| JSON | DB ID | Party |
|------|-------|-------|
| AITC | TMC | Trinamool Congress |
| BJP | BJP | Bharatiya Janata Party |
| INC | INC | Indian National Congress |
| CPM / CPI(M) | CPIM | Communist Party of India (Marxist) |
| CPI | CPI | Communist Party of India |
| BSP | BSP | Bahujan Samaj Party |
| SP | SP | Samajwadi Party |
| JD(U) | JDU | Janata Dal (United) |
| RJD | RJD | Rashtriya Janata Dal |
| NCP | NCP | Nationalist Congress Party |
| IND | IND | Independent |

### 1c. Web search unknown parties

For each unknown abbreviation, search: `"{ABBR}" party India state election`

### 1d. Create party seed SQL

File: `database/seed_{state}_parties.sql`

```sql
INSERT INTO parties (id, name, color, symbol_url) VALUES ('ID', 'Full Name', '#COLOR', NULL) ON CONFLICT (id) DO NOTHING;
```

Load: `docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_{state}_parties.sql`

## Step 2: Get Full Candidate Data (for Spoiler Analysis)

The Insights/spoiler tab needs ALL candidates per constituency (not just winner + runner-up). Without 3rd+ place candidates, spoiler detection won't work.

### 2a. Find ECI detailed results PDF

Search: `"Election Commission of India" detailed results {state} {year} assembly election PDF`

Best sources:
- **ECI Statistical Reports**: `eci.gov.in/statistical-report/statistical-reports/`
- **State CEO website**: `ceo{state}.nic.in`
- **MyNeta**: `myneta.info/{state}{year}/` (candidate lists, sometimes no vote counts)
- **GitHub**: `site:github.com {state} assembly election results CSV`

### 2b. Parse PDF to JSON

Extract text with layout: `pdftotext -layout input.pdf output.txt`

Key patterns in ECI detailed results PDFs:
- Constituency header: `Constituency  N . Name  TOTAL ELECTORS  NNNN`
- Candidate vote line: ends with `GENERAL  POSTAL  TOTAL  PERCENT`
- Party appears inline between candidate name and vote columns
- Names may wrap across multiple lines
- `CPI(M)` needs special regex handling (parentheses break `\b` word boundaries)
- Use `(?<!\w)PARTY(?!\w)` instead of `\bPARTY\b` for party matching
- Sort parties longest-first in regex alternation so `CPI(M)` matches before `CPI`

Output format — add `all_candidates` array to existing JSON:
```json
{
  "const_no": 210,
  "const_name": "NANDIGRAM",
  "winner": { "name": "...", "party": "BJP", "votes": 110764 },
  "runner_up": { "name": "...", "party": "AITC", "votes": 108808 },
  "margin": 1956,
  "all_candidates": [
    { "name": "...", "party": "BJP", "votes": 110764 },
    { "name": "...", "party": "AITC", "votes": 108808 },
    { "name": "...", "party": "CPI(M)", "votes": 6267 },
    ...
  ]
}
```

### 2c. Validate parsed data

Check:
- All constituencies present (should match GeoJSON feature count)
- No missing votes
- No duplicate non-IND parties per constituency (indicates merged blocks)
- CPI(M) count > 0 if Left parties contested
- Winner/runner-up match existing JSON data

## Step 3: Research Election Alliances & Manifests

### 3a. Web search alliances per year

Search: `"{state} assembly election {year} alliances parties coalition"`

### 3b. Define manifest config per election

```typescript
{
  alliances: [
    { id: 'ALLIANCE_ID', name: 'Display Name', color: '#HEX', parties: ['PARTY1', 'PARTY2'] },
  ],
  leaders: [
    { name: 'Leader Name', party_id: 'PARTY', const_id: '{PREFIX}_{constNo}_{GEOJSON_NAME}' },
  ],
  tracked: ['ALLIANCE1', 'ALLIANCE2'],  // alliances shown by default
  milestones: [{ label: 'Majority', value: Math.ceil(totalSeats / 2) }],
  compare_with: ['prev_election_uuid'],  // for swing analysis
  history: ['oldest_uuid', ..., 'prev_uuid'],  // for history tab
  history_years: [2011, 2016],
  vote_splits: [  // for spoiler/insights tab
    { spoiler: 'PARTY_ID', hurts: 'ALLIANCE_ID', label: 'Display label' },
  ],
  geo: { map_url: '/geo/{state}_ac.geojson', center: [lng, lat], zoom: 7 },
  delimitation_era: '2008',
}
```

**Important**: Leader `const_id` must match actual constituency where the leader contested (not where they govern from). Verify against source data.

## Step 4: Create/Update Generator Script

### 4a. Generator pattern

See `scraper/src/generate-wb-vs-seeds.ts` as reference. Key features:
- Reads JSON data + GeoJSON for canonical names
- Maps JSON party abbreviations → DB party IDs via `PARTY_MAP`
- Uses `ac_no` from GeoJSON for constituency matching (handles name mismatches)
- Const ID pattern: `{STATE}_{VS}{YY}_{constNo}_{GEOJSON_NAME}` (e.g. `WB_VS21_210_NANDIGRAM`)
- Handles both `all_candidates` (full data) and legacy winner+runner-up modes
- For margin-only data (no votes): synthetic votes = runner-up gets 50000, winner gets 50000 + margin
- Results INSERT must include `election_id` column

### 4b. Election IDs

Use deterministic UUIDs for reproducibility, e.g.:
- `d4e5f6a7-b8c9-0123-def0-345678901011` (last digits = year)

### 4c. DB constraints to be aware of

- `uq_candidates_election_const_party`: unique (election_id, const_id, party_id) WHERE party_id != 'IND'
  - Multiple IND candidates per constituency are OK
  - Multiple candidates from same non-IND party = parsing error (constituency data merged)

## Step 5: Generate & Load SQL Seeds

```bash
# Generate
cd scraper && npx ts-node src/generate-{state}-vs-seeds.ts

# Load parties first
docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_{state}_parties.sql

# Load elections oldest first
docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_{state}_vs_{year1}.sql
docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_{state}_vs_{year2}.sql
docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_{state}_vs_{year3}.sql
```

### To reload (delete + re-insert):
```sql
DELETE FROM results WHERE election_id = '{uuid}';
DELETE FROM candidates WHERE election_id = '{uuid}';
DELETE FROM constituencies WHERE election_id = '{uuid}';
DELETE FROM elections WHERE id = '{uuid}';
```

## Step 6: District & Region Backfill

Assign each constituency to its district and region for geographic grouping and admin filtering.

### 6a. Research district-constituency mapping

Sources:
- **Delimitation Commission reports**: official AC-to-district mapping
- **State CEO website**: `ceo{state}.nic.in` — constituency list with district
- **Wikipedia**: `"{State} Legislative Assembly constituencies" district-wise`
- **GeoJSON cross-reference**: use `ac_no` ordering + district boundaries to verify ranges

Key gotchas:
- District carve-outs create **non-contiguous ranges** (e.g. WB: Jhargram carved from Paschim Medinipur in 2017 → ACs 220-222 + 237)
- Verify with GeoJSON: constituency names often hint at district (e.g. "KOLKATA_DAKSHIN" → Kolkata district)

### 6b. Define regions

Group districts into broader political/cultural regions (6-10 per state). Examples:
- Bihar (8): Champaran-Tirhut, Mithila, Saran, Kosi, Seemanchal, Ang, Patna-Bhojpur, Magadh
- WB (8): Hills, North Plains, Malda-Dinajpur, Murshidabad-Nadia, South Bengal, Kolkata-Howrah, Junglemahal, Rarh-Burdwan

### 6c. Create seed SQL

File: `database/seed_{state}_districts_regions.sql`

```sql
-- Districts
INSERT INTO districts (state_id, name, code)
VALUES ({state_id}, 'District Name', '{STATE}_DISTRICTNAME')
ON CONFLICT (code) DO NOTHING;

-- Regions (note: unique constraint is on state_id + code, NOT just code)
INSERT INTO regions (state_id, name, code)
VALUES ({state_id}, 'Region Name', '{STATE}_REGIONNAME')
ON CONFLICT (state_id, code) DO NOTHING;

-- Assign constituencies to districts (by const_no range)
UPDATE constituencies SET district_id = (SELECT id FROM districts WHERE code = '{STATE}_DISTRICTNAME')
WHERE election_id IN ('uuid1', 'uuid2', ...) AND const_no BETWEEN X AND Y;

-- Assign constituencies to regions
UPDATE constituencies SET region_id = (SELECT id FROM regions WHERE code = '{STATE}_REGIONNAME')
WHERE election_id IN ('uuid1', 'uuid2', ...) AND const_no BETWEEN X AND Y;
```

**Important**: Include ALL election IDs for the state in the WHERE clause (all years share the same const_no mapping).

For non-contiguous ranges, use `const_no IN (X, Y, Z)` instead of `BETWEEN`.

### 6d. Load into DB

```bash
docker exec -i election_tracker_db psql -U admin -d election_tracker < database/seed_{state}_districts_regions.sql
```

### 6e. Verify

```sql
-- Check all constituencies assigned
SELECT COUNT(*) FROM constituencies WHERE state_id = {state_id} AND district_id IS NULL;
-- Should be 0

-- Check per-district counts
SELECT d.name, COUNT(*) FROM constituencies c
JOIN districts d ON d.id = c.district_id
WHERE c.state_id = {state_id} AND c.election_id = '{latest_uuid}'
GROUP BY d.name ORDER BY d.name;
```

### Known constraints
- `districts.code` is `varchar(50)` — codes like `WB_PASCHIMBARDHAMAN` (19 chars) fit after migration 009
- State IDs: Bihar = 5, West Bengal = 36 (check `SELECT id, name FROM states`)

## Step 7: AI Enrichment (removed)

The built-in AI enrichment (admin **AI Enrich** button, `/admin/.../enrich` endpoints, `ai_*` columns) was removed on 2026-09-30. AI-assisted data is produced offline and loaded like scraped data (seed SQL or admin edits). Skip to Step 8.

## Step 8: Compute Constituency Analysis

Run the compute from the **Admin panel** (`localhost:3081`):

1. Go to **Elections** → select the election
2. Click **Compute Analysis**
3. This runs server-side analysis on all constituencies in one click, computing:
   - **Dominance**: stronghold / loyal / swing classification based on historical wins
   - **Swing**: flipped seats vs previous election
   - **Seat type**: two-way / three-way / multi-cornered based on vote shares
   - **Incumbency**: incumbent re-contesting, party switches, won/lost
   - **Seat history**: per-election winner timeline

Run compute for each election **oldest first** so history data builds up correctly.

The compute endpoint: `POST /api/v1/admin/constituency-analysis/compute/:electionId`
- Body: `{ "history_election_ids": ["oldest_uuid", ..., "prev_uuid"], "manifest": {...} }`
- The `history_election_ids` should match the manifest's `history` array

## Step 9: Verify

1. **Backend API**: `curl http://localhost:3082/api/elections` — new elections appear
2. **Frontend map**: Select state → election → map renders correctly
3. **Watchlist leaders**: Leader cards show correct candidate + WON/LOST status
4. **Insights tab**: Spoiler seats highlighted (needs `vote_splits` config + 3rd-place candidate data)
5. **Swing tab**: Shows flipped seats (needs `compare_with` pointing to previous election)
6. **History tab**: Shows dominance + anti-incumbency (needs `history` + `history_years` arrays)
7. **Admin constituencies**: District and Region columns populated, filter dropdown works

## Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Map shows green/colored rectangle | GeoJSON polygon winding is CCW | Reverse all outer ring coordinate arrays |
| State selector resets to another state | `setElection(null)` without navigation | Auto-select newest election + navigate on state change |
| Leader shows "No data" | Empty `const_id` in manifest | Set correct const_id matching DB constituency ID |
| Leader shows wrong WON/LOST | resultMap returns constituency winner, not leader's result | WatchlistPanel checks if leader's party matches winner's party |
| Insights tab empty | Only winner + runner-up in DB | Need full candidate data (all candidates with votes) |
| `null in column "election_id"` | Results INSERT missing election_id | Add `election_id` to INSERT column list |
| Duplicate key violation | Multiple same-party candidates (merged constituencies) | Fix parser to properly split constituency blocks |
| CPI(M) parsed as CPI | `\b` word boundary fails with parentheses | Use `(?<!\w)PARTY(?!\w)` instead |
| Region `ON CONFLICT` fails | Unique constraint is `(state_id, code)` not just `code` | Use `ON CONFLICT (state_id, code) DO NOTHING` |
| District code too long | `districts.code` was `varchar(10)` | Migration 009 widens to `varchar(50)` |
| District UPDATE returns 0 rows | Wrong `state_id` in seed SQL | Verify with `SELECT id, name FROM states WHERE name ILIKE '%{state}%'` |
| Backend changes not taking effect | Runs compiled JS from `dist/` | Run `npm run build` in `backend/` + restart process |

## State-Specific Notes

### West Bengal (WB)
- State ID: 36
- GeoJSON: `frontend/public/geo/wb_ac.geojson` (294 ACs)
- Elections: 2011, 2016, 2021
- 2021 has full candidate data from ECI PDF; 2011/2016 have winner+runner-up only
- Party quirks: GOJAM = GJM, NIC = INC (data error), DCP(PC) = DSP(P) = DSPP
- 17 name mismatches per year resolved via ac_no lookup
- Districts: 23 (`database/seed_wb_districts_regions.sql`)
- Regions: 8 (Hills, North Plains, Malda-Dinajpur, Murshidabad-Nadia, South Bengal, Kolkata-Howrah, Junglemahal, Rarh-Burdwan)
- Non-contiguous: Jhargram (220-222, 237), Paschim Medinipur (219, 223-236) — 2017 carve-out

### Bihar (BR)
- State ID: 5
- GeoJSON: `frontend/public/geo/bihar_ac.geojson` (243 ACs)
- Elections: 2010, 2015, 2020, 2025
- Party quirks: HAMS = Hindustani Awam Morcha, CPIML = CPI(ML)(L)
- Districts: 38 (`database/seed_bihar_districts_regions.sql`)
- Regions: 8 (Champaran-Tirhut, Mithila, Saran, Kosi, Seemanchal, Ang, Patna-Bhojpur, Magadh)
