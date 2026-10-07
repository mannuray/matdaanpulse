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

## Two tracks

- **Historical track** (older elections, for analysis only): every candidate + NOTA with real ECI votes, SC/ST,
  electors, turnout, phase (§2), corrections of existing rows (§2 "Existing rows"), party mapping, cross-election
  linking (§3), About page. **No** photos, leaders, party profiles, affidavits or candidate details. Go back only to
  the first election under the current delimitation (2008 delimitation: Bihar 2010, other states 2011).
- **Current track** (the latest election of a state, and live elections): everything in §1–§8.

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
  licence → photo downloaded once → **our S3 bucket** (`src/media-store.ts`; `persons/<QID>/photo.<ext>`, `S3_*` + AWS keys in
  `scraper/.env`) → `image_credits`. Never hotlink. Bios are generated from the curated roles.
- Leaders seed: anchor on each leader's best-linked person; leaders/cabinet watchlists (with `person_id`) written into
  the manifest only if it has no watchlist entries yet, and into an open draft the same way.
- Check with `leaders-check-cli.ts` (prints a query listing leaders split across persons; expect no rows).

## 5. Candidate photos (top 4 per seat)

- The ECI results site's candidate-wise pages carry each candidate's photo (`<figure><img src=…candprofile…>`); the
  photo files stay online after the pages are gone. Pages via Wayback; fall back to older snapshots when the newest is
  truncated.
- `photos-cli.ts`: match by exact votes + name check (else a close unique name), shrink to 240 px JPEG (~7 KB) with
  `sharp`, upload to S3 (`persons/eci<year>/<slug>-<seat>-<serial>.jpg`; a local copy is kept in `scraper/data/media/`), credit ECI ("no licence stated"), run-once
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
| Vercel Blob's free plan suspended the store mid-run (all images 403, production too) | images on S3 (no operation limits); every upload keeps a local copy; check a host's limits before a bulk job |
| ECI download links failing (HTTP 500) for one report | the user downloads the four XLSX files by hand; register them |
| Report layouts differ by year/state (flat sheet without TURNOUT rows, letter-typed party tables, "CONSTITUENCY :- N - Name") | parser aliases and layout detection, each with a fixture test |
| A summary whose valid total includes NOTA (no NOTA line) | cross-check accepts candidates + NOTA there |
| Seats a report leaves out (TN 2016 postponed polls) | registry `excludeSeats` + `seats` |
| Stable ids colliding across states (same year/seat/serial) | namespace ids by state slug |
| One ECI name meaning another party in a state | per-state `party-overrides.json` |
| Old seeds with duplicate/garbled rows | decisions: delete the garbled twin, match the clean row |
| The suggester suffixing (`KECJ_KL`) a party the DB already has under its old id, so manifest alliances lose its seats | `generate-cli` refuses while an alliance party has no candidate; point the ECI name at the old id (shared map or `party-overrides.json`, which also takes a full entry), or, for a real duplicate (`MUL`/`IUML`), `manifest-party-fixes.json` → run-once `seed_<st>_manifest_fixes_v1.sql` |
| Regenerating a corrections seed after the year seeds were already regenerated | restore the old year seeds first (`git show <pre-branch commit>:database/…`); corrections are a diff against the old rows |
| Flat 2016 sheets: summing the parsed rows as the seat total makes the turnout check compare a number with itself | read the sheet's own "Total Votes" column |

| A party renamed, merged, split or broke away between two elections (flips and swing look wrong) | add a sourced row to `scraper/data/parties/lineage.json` (split = ECI faction dispute; breakaway = leaders left), regenerate `seed_party_lineage.sql`, recompute the analysis |
| Pre-NOTA PDFs (2008/2009): rows "serial rank NAME", "TOTAL:" then a bare "Turn Out" line, indented WINNER/MARGIN, "RUNER-UP" | parser variants, each with a fixture test |
| A table headed "DETAILED RESULTS" that is not (JH 2014 Women Candidates: no SEX column) | skip blocks whose header lacks SEX; a seat appearing twice throws |
| 2019/2020 summary sheets: label "NARELA-GEN", the seat number only in the sheet name ("U05-1"), plain headings, dd/mm/yyyy | `parseSummaryRows(rows, sheetName)` |
| A candidate's party wraps under a wrapped symbol ("CPI(ML) Auto-" / "(L)  Rickshaw") | a continuation joins the party only left of the symbol column |
| Results sites of 2024/25 offline | photos-cli falls back to Wayback snapshots (CDX); photo JPEGs still served live |
| A leader's ballot name differs (Parvesh Verma = "Parvesh Sahib Singh") | `ballot_name` on that candidacy in leaders.json |
| Current-track CLIs reaching for old MyNeta pages of an all-new state | `trackOf` = elections with a results site / MyNeta (the latest assembly) |
| Counting dates differ per state and year | each registry entry carries its own `resultDate` |
| A summary page broken or a seat's type wrong in ECI's summary (Manipur 2017 Sagolband; 9 UP 2017 seats) | `summary-fixes.json` per year (`voters`, `totalValid`, `type`), each with its source |
| Seats missing from ECI's summary (UP 2017: 11) | `missing-summaries.json`: name, type, electors, poll date; totals from the detailed sheet (candidates only, NOTA separate) |
| Two candidates of one party in a seat (UP 2012 seat 72); the DB keeps one per party per seat | `candidate-fixes.json` (the other as IND); parse/generate refuse such seats without a decision |
| Letter-spaced abbreviations in the 2012 PDFs ("Aa S P") split into party + symbol | keep spaced runs of 1-2 letters together (detailed and party-list parsers) |
| Dotted reservation suffixes ("S.C.", "S.T.") | `splitAcName` accepts them |
| Old map files wound the planar way (2008 GA/MN/PB/UK/UP: d3 draws each seat as the globe) | the loader rewinds (`fixWinding`); a new map still gets `rewindForD3` |
| Map seat names differ from ECI's (truncated "(SC", transliterations) | VS maps match by seat number as a fallback; check numbering once per map |
| An all-new state's person links: v1 filtered out new elections | v1 = old-seed elections plus new ones up to 2022 |
| A brand-new election has no old seed to take names/ids from | registry `newElection` → `new-election.ts` (elections row, constituency ids `<ST>_VS<yy>_<no>_<NAME>`, curated `manifest-<year>.json`) |
| ECI boundary files: seat names carry "(SC)"/"(ST)" and other spellings; mapshaper writes counter-clockwise rings (d3 draws a square) | map features take our seat names; `rewindForD3` after mapshaper |
| A redraw (Assam 2023): seat-number seeds (districts/regions, person links) would join unrelated seats | scope old seeds to the old delimitation; tag new seats one by one; link only within one delimitation |
| Regenerating a state rewrites the old years' review files against already-new seeds | restore them (`git checkout -- scraper/data/*/review-20{11,16,21}.json`) |
| party-profiles CLI is not re-runnable and can delete an image another party still uses | run once from a clean tree; never let two ids share a symbol file |
| MyNeta hides ~11 % of 2026 winners in packed scripts (assets as images) | decode the "hunter" packer arithmetically; never execute the page's JavaScript |
| MyNeta seat spellings (Labhpur/Labpur) and nicknames in names | variant fallback: close seat + same winner name, unique only |
| Two candidates with the leader's exact name in one seat | `pickCandidacy` prefers the winner |
| ECI's party list and summaries spell a party differently ("Thackrey"/"Thackeray") | `<slug>/party-name-aliases.json` (year → summary name → abbreviation) for the cross-check |
| A unit leader never contested, and a relative's ballot holds the same words (Raj / Amit Raj Thackeray) | `no_candidacy: true` on the role |
| A state's elections span a redraw (J&K: 1995 boundaries in 2008/2014, 2022 in 2024) | per-election `seats` / `delimitation` / reserved in the registry; `districts-<era>.json` per boundary set; links only within an era; leaders attach candidacies across the redraw by name |
| ECI's boundary file has areas with no seat (`AC_NO` 0, "NA") | kept as unnamed `ac_no` 0 shapes |
| ECI names one party differently in one year (Hakeem Yaseen's PDF(S) in 2008) | `<slug>/party-overrides.json` maps that year's full name to the party's id for this state only |
| A report covers a larger, older state (Andhra 2009/2014: undivided, 294 seats) | registry `seatRange { from, to, offset }` keeps and renumbers today's seats; the party table is skipped (`partial`); manifest `no_majority` when the assembly itself was larger. `summary-fixes.json` / `ocr-fixes.json` use the report's old numbers; `missing-summaries`, `supplement`, `candidate-fixes`, `excludeSeats` and cross-check keys use the new ones |
| Names change word order and initials between years (Telugu: "Nara Chandrababu Naidu" / "Chandrababu Naidu Nara") | per-state `looseNames` link keys; unit roles and leaders may name the exact `ballot_name` |
| Seats won unopposed: "Uncontested" (2009 PDF), all-zero sheets with no electors/winner (2019 XLS), or absent from Detailed Results and the party table (2024) | `completeUncontested` builds/fills them; one WON candidate with 0 votes, no NOTA, turnout NULL |
| A scanned report with no text layer (Arunachal 2014) | `ocr-cli.ts` (macOS Vision, two passes) + `ocrNormalise`; hand fixes in `<slug>/ocr-fixes.json`, each checked against the page image |
| Honorifics on some names only ("Shri X" in one year, "X" in another) | per-state `stripHonorifics` (never on shipped states: their data must stay byte-identical) |
| MyNeta slugs are not the state code (`arunachalpradesh2024`) | check the winners page has links before running affidavits |
| Old-site docids are not ordered by state or year | the statistical-reports listing (`get-election-data?page_seo_name=statistical-reports`) links `old.eci.gov.in/files/file/<docid>-…` for every state and year |
| A state's files label reserved seats differently every year (Sikkim: BL / ST / none) | a fixed per-state `seatTypes` table; a contradicting label is a parse error |
| A seat with no territory (Sikkim's Sangha) | GEN seat without a map feature: lists, tallies and its page work; About notes it |
| A 2008 map file with big unnumbered blocks (Sikkim: 73% of the state) | rebuild it from ECI's results-site boundary file (`geo-cli.ts <ST> --year <y> --write`, Wayback for old sites) |
| A leader contests two seats in one election (Chamling, Golay) | the name+seat linker splits them; attach every candidacy in `leaders.json` (with `ballot_name` where it differs) |
| The results site of an early count has its own base (Sikkim `AcResultGen2ndJune2024`, not `…June2024`) | find it in the Wayback CDX index before running photos |
| CLIs that upload to S3 do not read `scraper/.env` | `set -a; . ./.env; set +a` plus `S3_BUCKET`/`S3_REGION`/`S3_PUBLIC_BASE_URL` (values in `.env.example`) |

## 10. Running things

- Long scripts (photos, profiles) can exceed the 2-hour background limit: start them detached
  (`nohup npx ts-node src/bihar/<cli>.ts > log 2>&1 &`); they save progress and resume.
- Dev servers for the user: `nohup npm run start:dev` (backend), `nohup npm run dev` (frontend) so they outlive the session.
