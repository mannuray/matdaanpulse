# Seeding playbook: adding an election's data

How to load one state election's data to the standard of Bihar 2010–2025 (Phase 1, done 2026-10-03). Follow it for
every new election (next: the 2026 elections of Assam, West Bengal, Tamil Nadu, Kerala and Puducherry). It records
what worked, the order, the checks, and the traps we hit.

Rules that bind every step are in `CLAUDE.md` (Database Setup) and the spec
`docs/superpowers/specs/2026-10-03-bihar-seeding-design.md`. Bihar's plans are worked examples:
`docs/superpowers/plans/2026-10-03-bihar-results-seeding.md` and `docs/superpowers/plans/2026-10-03-bihar-persons-leaders.md`.

> The pipeline code lives in `scraper/src/bihar/` and is Bihar-shaped (`years.ts`, election ids, file names). The first
> task of a new state's work is to generalise it (state + year config) rather than copy it.

## 0. Decide the scope with the user first

Agree these before any research or code (the user prefers discussing first, then acting):
- Which elections, and how deep: all candidates (results) is standard; photos for the **top 4 per seat**; party
  profiles for the **top parties only** (won a seat, 1 %+ of the vote, or alliance member); leaders: CM, deputy CMs,
  LoP, cabinet (who contested), with sources.
- Effort follows public profile: no per-candidate research or LLM reading. Bulk data comes from scripts; Claude curates
  only short lists (leaders, top parties), always with sources, always shown to the user before seeding.
- Check the state's **older** elections in our DB for the synthetic signature (every runner-up at exactly 50,000 votes,
  winners only, all seats GEN). As of 2026-10-03: TN, KL and AS 2021 are synthetic and PY 2021 is winners only. Seat
  history and swing compare with the previous election, so flag it.

## 1. Election record

- `elections` row: type VS, state, year, status, result date, **`delimitation`** ("2008"; Assam "2023" from 2026).
  Comparisons only run between elections of the same type, state and delimitation.
- A redraw (Assam 2023) needs a new map file `frontend/public/geo/<code>_ac_<era>.geojson` (never edit one in place),
  the manifest `geo.map_url`, and new districts/regions. Source the GeoJSON and record its licence.

## 2. Results (every candidate + NOTA)

**Sources, in order of preference**
1. **ECI statistical reports** (source of record): `https://www.eci.gov.in/eci-backend/public/api/election-result?category_id=<id>`
   (new site, XLSX) or `/api/old-site-statistical-report-data?docid=<id>` (older years; XLS/XLSX or one big PDF).
   Index: `/api/get-election-data?page_seo_name=statistical-reports`. Reports used: Detailed Results, Constituency Data
   Summary, List of Political Parties Participated, Performance of Political Parties. Statistical reports appear months
   after counting; check they exist before planning.
2. **ECI results site** (`results.eci.gov.in/ResultAcGen<Mon><Year>/`): taken down after a while; the **Wayback
   Machine** has the pages (CDX: `web.archive.org/cdx/search/cdx?url=…&matchType=prefix&filter=statuscode:200`).
3. Archived older results (`eciresults.nic.in`, Wayback) for gaps (Bihar 2015 seats 195/210/229 had blank vote columns
   in the ECI report): committed as `supplement.json`, cross-checked like any seat.
4. TCPD Lok Dhaba is unreachable (checked 2026-10-03); do not plan on it.

**Pipeline** (`scraper/src/bihar/`): fetch (cached under `scraper/data/raw/`, gitignored, browser UA, ~2 s between
requests) → parse (SheetJS for XLS/XLSX; `pdftotext -layout` for PDFs) → **ECI-internal cross-check** (Detailed Results
vs Constituency Data Summary per seat; vs Performance of Political Parties statewide) → committed JSON
(`scraper/data/<state>/vs-<year>.json`) → generated seeds. Unknown ECI table errors go in `crosscheck-exceptions.json`
with a reason; never add an exception for a parser bug.

**Conventions**: votes = ECI total (general + postal); status WON / LOST; margin = top − second (non-NOTA) on every
row; NOTA LOST; turnout = voters ÷ electors; phase = rank of the poll date; all-caps names → Title Case.

**Parties**: abbreviation → that year's full name → our id (`party-map.json`, space-insensitive key). Duplicate ids
already in the DB → the id with most candidates (`party-aliases.json`); id collisions with a different party → `_BR`
style suffix. New small parties get a bare grey record.

**Existing rows** (only when correcting an election already in the DB): keep old candidate/result ids for matched rows;
a run-once corrections seed runs **before** the year seeds, starts with a pre-flight that stops on production rows the
seeds don't know, and is **frozen** once shipped (a later fix is `_v2`). A brand-new election (2026) needs none of this.

## 3. Persons

- Cross-election linking (`links.ts`): same name (alias part dropped) in the same seat in 2+ years. A party switch or an
  IND member needs every declared age to fit the years (±2); single-word names, common names with differing parties and
  same-year duplicates go to review. Never move a candidate away from a curated person (more than one candidacy), a
  merge, an admin split (`CANDIDATE_SPLIT` audit row) or a person with an admin-entered profile.
- All person seeds are run-once and fill-only. Address persons through a candidate id (auto-created person ids differ
  per database); only seatless leaders get a fixed `stableUuid` id.

## 4. Leaders (curated)

- `leaders.json`: CM, deputy CMs, LoP, opposition CM face, cabinet ministers who contested (≤ 12), from the ministry
  articles, with `sources` per election. A research agent can do it; validate with `validateLeaders`.
  **Show the list to the user and wait for approval.**
- Profiles (`profiles-cli.ts`): Wikidata (photo P18, birth date at **day precision only**, sex, enwiki) → Commons
  licence → photo downloaded once → **our Vercel Blob store** (`persons/<QID>/photo.<ext>`, `BLOB_READ_WRITE_TOKEN` in
  `scraper/.env`) → `image_credits`. Never hotlink. Bios are generated from the curated roles.
- Leaders seed: anchor on each leader's best-linked person; leaders/cabinet watchlists (with `person_id`) written into
  the manifest only if it has no watchlist entries yet, and into an open draft the same way.
- Check with `leaders-check-cli.ts` (prints a query listing leaders split across persons; expect no rows).

## 5. Candidate photos (top 4 per seat)

- The ECI results site's candidate-wise pages carry each candidate's photo (`<figure><img src=…candprofile…>`); the
  photo files stay online after the pages are gone. Pages via Wayback; fall back to older snapshots when the newest is
  truncated.
- `photos-cli.ts`: match by exact votes + name check (else a close unique name), shrink to 240 px JPEG (~7 KB) with
  `sharp`, upload to Blob (`persons/eci<year>/<seat>-<serial>.jpg`), credit ECI ("no licence stated"), run-once
  fill-only seed after the leaders seed. Resumable; run long jobs detached (`nohup`), see §10.
- Results pages from before ~2025 have no photos.

## 6. Affidavits (winners)

- MyNeta (ADR) winners table: `https://myneta.info/<slug>/index.php?action=show_winners&sort=default` (Bihar slugs:
  `bih2010`, `bihar2015`, `bihar2020`, `Bihar2025`; find others by trying `<state><year>` / `<abbr><year>`).
  Criminal cases, assets, liabilities, education. Match by seat name (strip district tags, fuzzy ≥ 0.8, duplicate seat
  names resolved by winner name) + winner name; skip by-election rows; report the unmatched. Run-once, fill-only.
- ADR doesn't cover every winner (~85–90 %). Age and gender come from ECI for every candidate.

## 7. Parties (top only)

- Pick the top parties from the results (won a seat, 1 %+ vote, alliance members). A research agent fills
  `parties-<year>.json` with sources: abbreviation, ECI recognition as of that election, founding year, leader at that
  time, headquarters (registered address), website, Wikipedia, colour (Wikipedia party-colour template), our own
  description, ECI symbol name, and Commons images (free licences only; check each current file too).
- Build a temporary review page (contact sheet) on the dev server, **get the user's approval**, then
  `party-profiles-cli.ts`: a new image replaces a current one only when that one is wrong or missing; a wrong one with no
  replacement is removed once. Images live in `frontend/public/symbols/`, wired by `seed_party_symbols.sql` (runs every
  deploy), credited by the run-once fill-only profile seed. Colours change only where still a grey placeholder.

## 8. Wire, verify, document

- Add each seed to `database/setup.sh` in order (parties before results; person seeds after the person base seeds;
  photos after leaders; profiles after party symbols/recognition).
- Verify: `scraper/src/bihar/two-db-check.sh` (fresh build vs upgraded copy, `setup.sh` run twice), a fresh scratch DB
  with counts, the leaders check, all suites (backend DB specs with `--runInBand`), and a look in the browser (person page,
  seat page, dashboard leaders strip, About credits).
- Update `frontend/src/model/about/about.ts` (dataset quality), `docs/FEATURES.md`, `CLAUDE.md` (seed order),
  `docs/DEPLOYMENT.md` (post-deploy: recompute seat analysis; publish manifest drafts first).
- A whole-branch review by a fresh reviewer before merge has caught real bugs every time; keep it.

## 9. Traps we hit (and the fix)

| Trap | Fix |
|---|---|
| ECI serial numbers include NOTA's slot | NOTA serial = max candidate serial + 1 |
| "Father's Name :- …" appended to some ECI names | stripped in `displayName` |
| PDF columns wrap (party "CPI(ML)" + "(L)"; long abbreviation glued to symbol) | join by column position; split at the first space |
| PDF serials written "10 ." | regex allows a space before the dot |
| Performance table lists a party twice / NOTA row with "-" | sum per party; skip NOTA |
| `IND` vs "Independent" between tables | treated as the same party |
| Wayback replies mislabelled as gzip; truncated snapshots | retry without compression; try older snapshots |
| Wikidata year-only birth dates stored as `-01-01` | keep birth dates only at precision 11 |
| Two seats with the same name (Pipra, Kalyanpur) | resolve by the winner's name |
| Seeds re-run every deploy; manifests overwritten | run-once markers; write manifests only when empty |
| The local DB has sample/preview data | revert only fields the seeds don't own; take a backup first |
| Background tasks stop after 2 hours | run servers and long jobs detached with `nohup` |
| A check that can't fail (grouped by the field it tests) | verify a check by running it on data known to be wrong |

## 10. Running things

- Long scripts (photos, profiles) can exceed the 2-hour background limit: start them detached
  (`nohup npx ts-node src/bihar/<cli>.ts > log 2>&1 &`); they save progress and resume.
- Dev servers for the user: `nohup npm run start:dev` (backend), `nohup npm run dev` (frontend) so they outlive the session.
