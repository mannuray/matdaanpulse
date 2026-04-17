# Election Data Scraping Guide

How we scrape, generate, and load election data into the tracker.

---

## Directory Structure

```
scraper/
├── package.json              # cheerio, ioredis, pg, node-cron, ts-node
├── tsconfig.json
└── src/
    ├── index.ts              # Entry point (scheduler placeholder)
    ├── adapters/
    │   ├── eci-adapter.ts    # Lok Sabha adapter (stub)
    │   └── eci-vs-adapter.ts # Vidhan Sabha adapter (working)
    ├── generate-bihar-vs-seed.ts       # Bihar 2025 (live scrape from ECI)
    └── generate-bihar-vs-2020-seed.ts  # Bihar 2020 (hardcoded data)
```

---

## Two Approaches

### Approach 1: Live Scraping from ECI (current/recent elections)

Used for **Bihar VS 2025**. Scrapes directly from the Election Commission website while results are still hosted.

### Approach 2: Hardcoded Historical Data (past elections)

Used for **Bihar VS 2020**. Data collected manually from StatisticsTimes, Wikipedia, or MyNeta, then hardcoded into the generator script.

---

## Approach 1: Live ECI Scraping

### When to Use

- Election results are currently live on `results.eci.gov.in`
- You need full candidate-level data (top 5 + NOTA per constituency)
- ECI pages are still accessible (they take results down eventually)

### ECI URL Patterns

The ECI results site uses a predictable URL structure:

```
Base URL:  https://results.eci.gov.in/ResultAcGen{MONTH}{YEAR}

Examples:
  Bihar VS 2025:  https://results.eci.gov.in/ResultAcGenNov2025
  (Lok Sabha would be a different pattern — see eci-adapter.ts stub)
```

**Constituency list pages** (paginated, ~20 per page):
```
{BASE_URL}/statewiseS04{PAGE}.htm

PAGE = 1..13 for Bihar (243 constituencies ÷ ~20 per page)
S04 = Bihar state code on ECI site
```

**Candidate detail pages** (one per constituency):
```
{BASE_URL}/candidateswise-S04{CONST_NO}.htm

CONST_NO = 1..243
```

### HTML Selectors (Cheerio)

**Constituency list page:**
```
table.table-striped tbody tr     → each row = one constituency
  td[0]  → Constituency name
  td[1]  → Constituency number
  td[2]  → Winner name
  td[3]  → Winner party (nested table inside td)
  td[4]  → Runner-up name
  td[5]  → Runner-up party (nested table inside td)
  td[6]  → Margin (number)
  td[7]  → Rounds
  td[8]  → Status (e.g. "Result Declared")
```

**Candidate detail page:**
```
.cand-box                        → each box = one candidate
  .nme-prty h5                   → Candidate name
  .nme-prty h6                   → Party name (full)
  .status div:first              → Won/Lost status
  .status div:eq(1)              → Votes text: "106262 (+ 35175)"
                                   Parse with regex: /[\d,]+/g for votes
                                   and /[+-]\s*[\d,]+/ for margin
```

### Running the 2025 Generator

```bash
cd scraper
npx ts-node src/generate-bihar-vs-seed.ts
```

This will:
1. Fetch all 13 list pages (300ms delay between pages)
2. Fetch candidate details for all 243 constituencies (200ms delay each)
3. Map party names to our IDs (see party mapping section below)
4. Generate `database/seed_bihar_vs_2025.sql`

**Total time:** ~2–3 minutes (network dependent)

### Adapting for a New ECI Scrape

To scrape a different Vidhan Sabha election from ECI:

1. **Find the base URL** — visit `results.eci.gov.in` and note the URL pattern
2. **Find the state code** — e.g. `S04` = Bihar, look at the URL when clicking a state
3. **Update `eci-vs-adapter.ts`:**
   ```typescript
   const BASE_URL = 'https://results.eci.gov.in/ResultAcGen{MONTH}{YEAR}';
   // Update the state code in fetchConstituencyList() and fetchConstituencyDetail()
   // Currently hardcoded as S04 (Bihar)
   ```
4. **Create a new generator script** — copy `generate-bihar-vs-seed.ts` and update:
   - `ELECTION_ID` — new UUID
   - `STATE_ID` — from our `states` table
   - `PARTY_NAME_TO_ID` — add any new party name mappings
   - Alliance definitions in the manifest
   - `compare_with` if there's a previous election to compare against

---

## Approach 2: Hardcoded Historical Data

### When to Use

- ECI results page is no longer available
- You only need winner + runner-up (not full candidate lists)
- Data sourced from third-party sites

### Data Sources

| Source | URL | What you get |
|--------|-----|-------------|
| StatisticsTimes | `statisticstimes.com/politics/` | Winner, runner-up, party, margin per constituency |
| MyNeta | `myneta.info/{State}{Year}/` | Full candidate lists with criminal/financial data |
| Wikipedia | State election articles | Summary tables with winners |
| ECI Archives | `old.eci.gov.in` | Official PDFs (harder to parse) |

### Data Format

The generator expects an array of `RawRow` objects:

```typescript
interface RawRow {
  constNo: number;        // 1-243
  name: string;           // "Valmikinagar"
  winnerName: string;     // "Dhirendra Pratap Singh"
  winnerParty: string;    // "JD(U)" — use source's abbreviation
  runnerUpName: string;   // "Rajesh Singh"
  runnerUpParty: string;  // "INC"
  margin: number;         // 21585
}
```

### Creating a New Historical Seed

1. **Collect data** — scrape or copy from the source into the `RawRow` format
2. **Copy the template** — use `generate-bihar-vs-2020-seed.ts` as a starting point
3. **Update these values:**

```typescript
// Unique election ID (generate a new UUID-like string)
const ELECTION_ID = 'your-unique-election-id-here';

// State ID from our states table (Bihar=5, UP=30, etc.)
const STATE_ID = 5;

// Constituency ID prefix — must be unique across elections
// Pattern: {STATE}_{TYPE}{YEAR_SUFFIX}_{CONST_NO}_{NAME}
// Examples: BR_VS20_ (Bihar 2020), UP_VS22_ (UP 2022)
function makeConstId(name: string, constNo: number): string {
  return `BR_VS20_${constNo}_${clean}`;  // Change prefix!
}

// Party abbreviation mapping: source format → our DB IDs
const PARTY_MAP: Record<string, string> = {
  'BJP': 'BJP',
  'JD(U)': 'JDU',
  // Add all parties from your data source...
};

// Alliance definitions for the manifest
const manifest = {
  alliances: [
    { id: 'NDA', name: '...', color: '#FF6B00', parties: ['BJP', 'JDU', ...] },
    { id: 'MGB', name: '...', color: '#2E8B57', parties: ['RJD', 'INC', ...] },
  ],
  // ...
};

// Paste your data
const RAW_DATA: RawRow[] = [
  { constNo: 1, name: '...', ... },
  // ...all constituencies
];
```

4. **Run the generator:**
```bash
cd scraper
npx ts-node src/generate-{your-seed-name}.ts
```

### Synthetic Vote Counts

When you only have margin data (no actual vote counts), the generator creates synthetic votes:

```
runner-up votes = 50,000 (fixed baseline)
winner votes    = 50,000 + margin
```

This preserves correct margins and relative ordering. The absolute vote numbers won't be real, but alliance tallies and swing analysis work correctly.

---

## Party Mapping

Every data source uses different party abbreviations. You must map them to our database IDs.

### Common Mappings

| Source formats | Our DB ID | Full Name |
|---------------|-----------|-----------|
| BJP | `BJP` | Bharatiya Janata Party |
| INC, Cong | `INC` | Indian National Congress |
| JD(U), JDU | `JDU` | Janata Dal (United) |
| RJD | `RJD` | Rashtriya Janata Dal |
| CPI(ML)(L), CPI-ML-L | `CPIML` | CPI (Marxist-Leninist) (Liberation) |
| CPI(M), CPM | `CPIM` | Communist Party of India (Marxist) |
| CPI | `CPI` | Communist Party of India |
| BSP | `BSP` | Bahujan Samaj Party |
| AAP | `AAP` | Aam Aadmi Party |
| AIMIM | `AIMIM` | All India Majlis-E-Ittehadul Muslimeen |
| IND, Independent | `IND` | Independent |
| NOTA | `NOTA` | None of the Above |
| HAMS | `HAMS` | Hindustani Awam Morcha (Secular) |
| LJP | `LJP` | Lok Janshakti Party |
| LJP(RV), LJPRV | `LJPRV` | Lok Janshakti Party (Ram Vilas) |

### Adding New Parties

If a party doesn't exist in the DB:

1. Add it to the `PARTY_MAP` in your generator
2. Add it to `PARTY_COLORS` if you know a brand color (default: `#808080`)
3. The generator will emit `INSERT INTO parties ... ON CONFLICT DO NOTHING`
4. New parties appear automatically in the UI

---

## Loading Seeds into the Database

### Load a seed file:
```bash
docker exec -i election_tracker_db psql -U admin -d election_tracker \
  < database/seed_bihar_vs_2020.sql
```

### Verify it loaded:
```bash
docker exec -i election_tracker_db psql -U admin -d election_tracker \
  -c "SELECT id, name, year, type FROM elections ORDER BY year;"
```

### Delete and re-load (if you need to regenerate):
```bash
docker exec -i election_tracker_db psql -U admin -d election_tracker -c "
  DELETE FROM results WHERE const_id LIKE 'BR_VS20_%';
  DELETE FROM candidates WHERE election_id = 'b2c3d4e5-f6a7-8901-bcde-123456789020';
  DELETE FROM constituencies WHERE election_id = 'b2c3d4e5-f6a7-8901-bcde-123456789020';
  DELETE FROM elections WHERE id = 'b2c3d4e5-f6a7-8901-bcde-123456789020';
"
```

Then re-load the seed file.

---

## Manifest Configuration

The manifest JSON controls how the election appears in the UI. It's stored in `elections.manifest_url`.

```json
{
  "alliances": [
    {
      "id": "NDA",
      "name": "National Democratic Alliance",
      "color": "#FF6B00",
      "parties": ["BJP", "JDU", "LJPRV", "HAMS"]
    }
  ],
  "leaders": [
    { "name": "Nitish Kumar", "party_id": "JDU", "const_id": "" }
  ],
  "tracked": ["NDA", "MGB"],
  "milestones": [{ "label": "Majority", "value": 122 }],
  "compare_with": ["previous-election-id"],
  "geo": {
    "map_url": "/geo/bihar_ac.geojson",
    "center": [85.5, 25.6],
    "zoom": 8
  }
}
```

**Key fields:**
- `alliances` — defines alliance groupings for the UI (required for battle mode)
- `tracked` — alliance/party IDs shown by default in the sidebar
- `milestones` — majority mark line on the tally bar
- `compare_with` — array of election IDs for swing analysis (max 1 currently used)
- `geo.map_url` — path to GeoJSON file (must exist in `frontend/public/geo/`)

---

## GeoJSON Requirements

Each election needs a GeoJSON file with constituency boundaries.

**Location:** `frontend/public/geo/`

**Existing files:**
- `india_pc.geojson` — 543 Lok Sabha constituencies
- `india_states.geojson` — 36 state boundaries
- `bihar_ac.geojson` — 243 Bihar assembly constituencies

**Required properties per feature:**

For Vidhan Sabha:
```json
{
  "ac_name": "KALYANPUR",
  "ac_no": 131,
  "ac_category": "GEN",
  "st_name": "BIHAR"
}
```

For Lok Sabha:
```json
{
  "pc_name": "VARANASI",
  "pc_id": 1,
  "pc_category": "GEN",
  "st_name": "UTTAR PRADESH"
}
```

The map matches constituency IDs to GeoJSON features using `ac_no` + `ac_name` (VS) or `st_name` + `pc_name` (LS). Names are normalized (uppercase, non-alphanumeric stripped) for fuzzy matching.

---

## Constituency ID Format

IDs must be unique across all elections. The convention:

```
{STATE_CODE}_{TYPE}{YEAR_SUFFIX}_{CONST_NO}_{NAME}

Examples:
  BR_VS_131_KALYANPUR       — Bihar VS 2025 (no year suffix = latest)
  BR_VS20_131_KALYANPUR     — Bihar VS 2020
  UP_VS22_1_SAHARANPUR      — UP VS 2022 (hypothetical)
```

The map's `buildRegionLookup` strips the `VS\d*_` prefix to extract `{CONST_NO}_{NAME}` for GeoJSON matching. This means multiple elections from the same state can share one GeoJSON file.

---

## End-to-End Checklist for a New Election

1. **Get GeoJSON** — find or create assembly/parliamentary constituency boundaries
   - Place in `frontend/public/geo/{state}_ac.geojson`

2. **Scrape or collect data** — use ECI live scraper or hardcode from StatisticsTimes/Wikipedia

3. **Create generator script** — copy closest existing generator, update:
   - [ ] Election ID (unique)
   - [ ] State ID
   - [ ] Constituency ID prefix (unique per election)
   - [ ] Party mappings
   - [ ] Alliance definitions
   - [ ] `compare_with` (if previous election exists)
   - [ ] GeoJSON path in manifest `geo.map_url`

4. **Run generator** — `npx ts-node src/generate-{name}.ts`

5. **Load into DB** — `docker exec -i election_tracker_db psql ... < database/{seed}.sql`

6. **Verify in UI** — election should appear in the dropdown, map should render

7. **Update previous election** (optional) — if you want swing analysis on the newer election, update the newer election's `compare_with` in its seed SQL and re-load the manifest:
   ```sql
   UPDATE elections SET manifest_url = replace(manifest_url,
     '"compare_with":[]',
     '"compare_with":["previous-election-id"]')
   WHERE id = 'newer-election-id';
   ```

8. **Update docs** — add the new election to `docs/FEATURES.md`
