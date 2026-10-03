# Bihar data seeding (Phase 1): design

Date: 2026-10-03. Status: approved in discussion, pending spec review.
Context: `docs/SEEDING_NEXT_PHASE.md`. Seeding runs in three phases set by the user:
**(1) correct and fill past elections, Bihar only** (this spec), (2) the 2026 results for AS/WB/TN/KL/PY,
(3) preparing the 27 Feb 2027 counting (Goa, Uttarakhand, Punjab, Manipur, Uttar Pradesh).

## 1. Goal and scope

Make Bihar Vidhan Sabha 2010, 2015, 2020 and 2025 complete, real and sourced. That means every candidate with real
votes, correct constituency facts, proper party records and symbols, and key leaders with photos linked by person id.

Today (local DB = production seeds):

| | 2010 | 2015 | 2020 | 2025 |
|---|---|---|---|---|
| Candidates per seat | 2 | 2 | 2 | top 5 + NOTA |
| Votes | synthetic | synthetic | synthetic | real |
| SC/ST | all GEN | all GEN | all GEN | 40 reserved |
| Turnout / electors | none | none | none | 2 of 243 seats |
| Affidavits | none | ~none | ~none | 9 candidates |

Persons: 2,340, of which 382 are linked across elections. Leaders: name only, no seat, no person link, empty cabinet. Photos: none.
Party images: 199 logos and 17 ECI symbols from an earlier scrape, many of them wrong.

Out of scope: other states' past elections, LS 2024, and profiles for non-notable candidates.

### Guiding rule: effort follows public profile

Only well-known leaders get a profile (photo, bio, Wikipedia). Most candidates are unknown or proxies: they get name,
party, votes and whatever the ECI report gives for free (age, sex). Bulk data comes from deterministic scripts; no LLM
reads a page per candidate. Claude's judgement is used once, to curate the leader list.

## 2. Pipeline

Every track has three steps:

```
fetch (cached raw files) → parse + validate (normalised JSON, committed) → generate SQL seed
```

- **Fetch** downloads each source once into `scraper/data/raw/bihar/…` (gitignored), with a browser User-Agent and
  ~2 s between requests. Re-runs read the cache and never re-hit the source.
- **Parse** writes `scraper/data/bihar/vs-<year>.json` (committed), so a bad parse is a reviewable diff. Validation and
  the ECI internal cross-check run here. Any failure exits non-zero and lists the seats concerned.
- **Generate** writes SQL from the committed JSON only.

### Sources

- **Source of record: ECI statistical reports**, from the ECI backend
  (`https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=16` for 2025;
  `/api/old-site-statistical-report-data?docid=<id>` for older years: 2020 = 12787, 2015 = 3904, 2010 = 3903).
  2025 and 2020 come as XLS/XLSX reports; 2010 and 2015 only as one full-report PDF each (text layer, read with
  `pdftotext -layout`). Used reports: Detailed Results (every candidate: sex, age, category, party, general/postal/total
  votes; electors; turnout), Constituency Data Summary (reservation, electors, voters, NOTA, winner, margin, poll date),
  List of Political Parties Participated, Performance of Political Parties. 2010 has no NOTA (introduced 2013).
- **Cross-check: ECI against itself.** TCPD Lok Dhaba was the planned cross-check but is unreachable (server refuses
  connections, no mirror found, checked 2026-10-03). Instead, the parse step compares independent tables of the same
  report: Detailed Results vs Constituency Data Summary per seat (electors, total voters, NOTA, winner, runner-up,
  margin, reservation), and Detailed Results vs Performance of Political Parties statewide (seats won and votes per
  party). A mismatch fails the parse. Known errors in ECI's own tables can be listed in a committed
  `scraper/data/bihar/crosscheck-exceptions.json` with a reason.
- **Party symbols:** ECI symbol notifications plus Wikimedia Commons (free licences only).
- **Leaders:** Wikidata / Wikipedia / Commons.
- **Affidavits:** MyNeta (ADR), via `scraper/src/adapters/myneta-adapter.ts`.

Each source gets verified (availability, format, terms) when its fetcher is built. A source that turns out unusable is
raised with the user before switching.

## 3. Correcting rows already in production

Seeds re-run on every deploy with `ON CONFLICT DO NOTHING`, so rewriting seed files alone changes nothing in an
existing DB.

1. **Rewrite `database/seed_bihar_vs_<year>.sql`** with the full real data (fresh DBs). Candidates that match an
   existing row by seat + party (+ name similarity for `IND` and for parties with two candidates in a seat) **keep
   their existing candidate and result UUIDs**. `seed_bihar_persons.sql` and other id-keyed seeds keep working.
2. **New run-once `database/seed_bihar_corrections_v1.sql`** (`seed_runs` marker via `scraper/src/seed-run-once.ts`),
   for existing DBs. It deletes the old rows decided as `delete`, updates votes/status/margin on matched results,
   name/party/age on matched candidates (ECI spelling), the names of auto-created single-candidacy persons that still
   carry the old name, and constituency `type`, `total_electors`, `voter_turnout`, `phase`. It inserts nothing: the year
   seeds insert the missing candidates afterwards. On a fresh DB (no Bihar rows yet) the body is skipped and only the
   marker is written. Once applied in production it is frozen; a later correction is a new `_v2` seed.
3. **Old rows that match nothing in ECI** are written to a review file (`scraper/data/bihar/review-<year>.json`) and the
   generator refuses to emit until each has a decision in `scraper/data/bihar/decisions.json` (`delete`, or `match` to a
   named ECI candidate). Nothing is deleted without that explicit decision, because deleting a candidate can delete its person
   (orphan trigger). The user reviews the delete and low-similarity lists.
4. `setup.sh` order: `seed_bihar_parties.sql` → `seed_bihar_corrections_v1.sql` → `seed_bihar_vs_<year>.sql`. The
   corrections must run first: otherwise the partial unique index `uq_candidates_election_const_party` would make a year
   seed skip a new candidate that shares seat + party with an old row, and its result row would then fail the FK.
5. Year seeds set the manifest only `WHERE manifest_url IS NULL` (the published manifest lives in `manifest_url`;
   the current seeds overwrite it on every deploy).
6. **Verification:** a fresh `setup.sh` DB and an upgraded copy of today's DB (with `setup.sh` run twice) must hold identical
   Bihar constituencies, candidates and results.

## 4. Results and constituencies

- **Results:** every candidate + NOTA, votes (postal included), status `WON`/`LOST`, margin on every row (as now).
  `round_no` 0.
- **Candidates:** `age` from the ECI report. **Persons:** `gender` from the ECI report, filled only where NULL.
- **Constituencies:** `type` (GEN/SC/ST) per year, `total_electors`, `voter_turnout`, `phase` (derived from the seat's poll date in the Constituency Data Summary). Verify only `district_id`, which is already set.
- **Party mapping:** ECI labels → party id through `scraper/src/live/adapters/eci-mapping.ts` (`mapParty`), extended
  as needed. An unknown label fails the parse with a list; each one is decided once (new party, or an alias of an
  existing one). Independents → `IND`.
- **Validation (fails the generator):** exactly one winner per seat; margin = winner − runner-up; vote shares sum to
  100 %; turnout within 0–100; 2010–2020 reserved seats = 38 SC + 2 ST (2008 delimitation); 243 seats per year.
- **After load:** recompute the seat analysis for all four elections
  (`POST /admin/constituencies/analysis/compute/:electionId`).
- **Docs:** `frontend/src/model/about/about.ts`: Bihar 2010–2025 become `real`, source "ECI statistical report"
  (2025: "ECI (results.eci.gov.in)"); remove `votes_from_margin`, `two_candidates`, `reserved_wrong`, `top5_nota`.
  `docs/FEATURES.md` describes the pipeline.

## 5. Parties and symbols

- **Party rows:** every party that contested Bihar 2010–2025, with full name, abbreviation, `eci_recognition` and colour.
  New small parties get the ECI name and abbreviation and a neutral grey; no research. They go into the parties seed
  for Bihar with `ON CONFLICT DO NOTHING` (fill-only for existing rows).
- **Alliances:** per election in the manifest (`alliances`), hand-checked.
- **Images.** `PartyMark` already falls back logo → ECI symbol → dot.
  - `eci_symbol_url`: the ballot symbol, from the ECI symbol notification PDF (`pdfimages`) or Commons' Indian
    election symbol SVGs where cleaner.
  - `symbol_url`: the party's own logo, from Wikimedia Commons, **free licences only**. Non-free logos are skipped and
    the party falls back to its ECI symbol.
- **Scope:** Bihar's parties plus every National/State-recognised party (shown on LS 2024). The existing 199 logos are
  re-checked; wrong ones are replaced or removed (set to NULL by a run-once seed when they are wrong).
- **Review gate:** the script writes a local contact sheet (HTML in the scratch output: party id, name, both images,
  source, licence). Only images the user approves are written into `database/seed_party_symbols.sql`.
- **Storage:** files stay in `frontend/public/symbols/{logos,eci}/` (static, CDN-served). Admins can still replace an
  image through the Blob upload.

## 6. Image credits

A new idempotent migration adds `image_credits`:

| column | type | note |
|---|---|---|
| `url` | text PK | the image URL as stored on the party/person |
| `source_url` | text | page the image came from |
| `author` | text | nullable |
| `licence` | text | e.g. `CC BY-SA 4.0`, `Public domain`, `GODL / ECI` |
| `created_at` | timestamptz | default now() |

- `backend/prisma/schema.prisma` is updated to match (checked with `prisma migrate diff`).
- A public read path for the About page (a credits list) plus a credit line on the person page when a photo has one.
- ECI symbols are credited "Election Commission of India".

## 7. Persons and leaders

### Cross-election linking (all tiers)

- Extend `scraper/src/seed-person-matches.ts` to the full candidate lists with the same signals: name similarity, party, seat/district,
  age progression between elections.
- High/medium-confidence links go into a new run-once `database/seed_bihar_person_links_v2.sql`. It only re-points
  candidates whose current person is an auto-created single-candidacy person, and skips any id in `person_merges`
  (`NOT_IN_MERGE_LOG`), so admin merges and splits are never undone. Low-confidence pairs go to a review file.

### Tier A: leaders (~30–50)

- Curated once into `scraper/data/bihar/leaders.json` (committed): CMs, deputy CMs, cabinet ministers, Leaders of the
  Opposition, party chiefs and a few star candidates for 2010–2025. Per entry: name, Wikidata id, the candidacies
  (year + `const_id`) that identify the person, and role per election (`leader`, `cabinet`, `watchlist`).
- A script reads Wikidata/Wikipedia: photo (Commons, free licence only), date of birth, gender, `wikipedia_url`.
- **Photos:** downloaded once and uploaded to **Vercel Blob** with `@vercel/blob` (`BLOB_READ_WRITE_TOKEN`, same store
  as `POST /admin/media`). Only our Blob URL is stored, plus an `image_credits` row. Never hotlinked.
- **Bio:** one or two factual lines written by us, plus the Wikipedia link. No copied Wikipedia text.
- Written by a run-once seed that fills only NULL person fields, so admin edits win.

### Tier B: winners (~970 across four elections)

- `myneta-adapter.ts` fetches affidavits (age, assets, liabilities, criminal cases), cached and rate-limited like ECI.
  Fill-only on `candidates`. About page credits "ADR / MyNeta".

### Tier C: everyone else

Name, party, votes, plus age/gender from ECI. Nothing more.

### Leaders by person id (code change)

- Manifest `leaders`, `cabinet` and `watchlists` entries gain an optional `person_id`.
- **Admin:** the manifest editor gets a person picker (search by name, shows party + latest seat) in place of free-text
  names; it stores `person_id` and keeps `name` for display.
- **Frontend:** `frontend/src/model/derive/leaders.ts` matches by `person_id` first, falling back to the current name
  match only for entries without one.
- **Bihar manifests:** real `leaders` and `cabinet` per election from `leaders.json`, with `const_id` set. Leaders who
  sat in the Legislative Council (e.g. Nitish Kumar) keep `const_id` empty and still link by `person_id`.
  Written by a run-once seed (admins edit manifests).

## 8. Build order

Each step ships on its own.

1. ECI fetch + parse + internal cross-check for **2020** end to end (proves the pipeline).
2. 2010, 2015, 2025; seed rewrite; corrections seed; constituency fields; About + FEATURES.
3. Party rows + symbols, with the user's contact-sheet review.
4. `image_credits` migration + Prisma sync + credits read path.
5. `person_id` in manifests (admin picker, frontend `leaders.ts`).
6. Person linking v2, then Tier A leaders (Blob photos), then Tier B affidavits.
7. Recompute seat analysis; two-DB check.

## 9. Testing

- **Parsers:** unit tests against small committed fixtures cut from real ECI files.
- **Generator:** UUID reuse for matched candidates; the corrections seed is a no-op on fresh data; run-once markers;
  the validation rules reject bad input.
- **Frontend:** `leaders.ts` tests for `person_id` match and name fallback.
- **Admin:** person picker test.
- **Two-DB check:** (a) a fresh DB from `database/setup.sh` and (b) a copy of today's DB upgraded by `setup.sh` must
  produce identical Bihar results, candidates and constituency facts (one SQL diff query, committed as a script).

## 10. Done when

- Bihar 2010–2025 has every candidate with real ECI votes, correct SC/ST, electors and turnout; the ECI internal cross-check
  passes; the About page lists all four as real.
- Reviewed party symbols are live, with credits.
- ~30–50 leaders have Blob-hosted, credited photos; Bihar manifests link leaders and cabinet by `person_id`.
- Winners have affidavit data.
- The fresh-DB and upgraded-DB paths match.
