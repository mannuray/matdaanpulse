# Next phase: data seeding — handoff

Written 2026-10-03, after the live ingest work was merged and deployed (`main` @ 8de8fc4). Start here in a fresh session.
Roadmap (agreed 2026-09-30): fix code → deploy → **data** → live. Next live counting day: **27 Feb 2027**.

## 1. Goal

Real, complete, sourced data for every election the site shows, plus the 2026 elections that are missing, so the site
is credible before 27 Feb 2027, with everything ready for that counting day (records, candidates, maps, keys, shards).

## 2. Where the data stands today (local DB = production seeds)

| Election | Seats | Candidates | Quality today (see `frontend/src/model/about/about.ts`) |
|---|---|---|---|
| LS 2024 | 543 | 3239 | Partly incomplete: top-5 + NOTA only; turnout/electors implausible (e.g. Lakshadweep 1,474,599) |
| BR VS 2025 | 243 | 1458 | Real (top-5 + NOTA) |
| BR VS 2010 / 2015 / 2020 | 243 | 486 each | **Estimated**: winner + runner-up only, votes synthetic (runner-up 50,000, winner 50,000 + margin), SC/ST all GEN |
| WB VS 2011 / 2016 / 2021 | 294 | 588 / 588 / 1902 | Real; 2011/2016 two candidates per seat |
| TN VS 2011 / 2016 / 2021 | 234 (2016: 232) | 468 each | 2011/2016 real (2 per seat); **2021 estimated** |
| KL VS 2011 / 2016 / 2021 | 140 | 280 each | 2011/2016 real (2 per seat), no source recorded; **2021 estimated** |
| AS VS 2011 / 2016 / 2021 | 126 | 252 each | 2011/2016 partly incomplete, SC/ST all GEN; **2021 estimated, placeholder names** |
| PY VS 2011 / 2016 / 2021 | 30 | 60 / 60 / 30 | 2011/2016 real (2 per seat); **2021 winners only, estimated** |
| LS 2029 | 0 | 0 | Upcoming placeholder, delimitation unset on purpose |
| **AS, KL, TN, WB, PY VS 2026** | — | — | **Missing entirely** (counted May 2026; ECI archive `results.eci.gov.in/ResultAcGenMay2026`) |

Persons: only Bihar has a person layer (`seed_bihar_persons.sql`); photos: essentially none (one sample).
Key leaders: stored in `elections.manifest_draft` JSON as name + `const_id` (no person id) — Bihar's have empty `const_id`.
Known data bug: Assam 2021 manifest leader `AS_VS21_40_JALUKBARI` points at seat #40, which is Sorbhog in the data.

## 3. Workstreams (suggested order)

### A. 2026 elections (highest value)
- Create the five elections (VS, year 2026, Finalized, result date, `delimitation`): WB/KL/TN/PY `'2008'`, **Assam `'2023'`**.
- Scrape full results from the ECI archive (all candidates + NOTA, votes, rounds, status) with the existing parsers
  (`scraper/src/adapters/eci-vs-adapter.ts`; real-page fixtures in `scraper/src/live/__tests__/fixtures/`; page
  structure and request budget in `docs/reviews/2026-09-30-election-day-pipeline-review.md` §4; browser User-Agent,
  ~2 s between requests). Map ECI party labels with `scraper/src/live/adapters/eci-mapping.ts` (`mapParty`), extend
  the parties seeds for new parties.
- Assam 2026 uses the **2023 delimitation**: new boundaries, renumbered seats. Needs `frontend/public/geo/as_ac_2023.geojson`
  (source it; check licence), its manifest `geo.map_url`, and new districts/regions. Its seats have no comparable
  history (the site already shows "Boundaries redrawn in 2023" and classifies them `new`).
- Manifests: alliances, key leaders (see D), `compare_with`/`history` → previous same-delimitation election.
- Run the seat analysis for each (admin `POST /admin/constituencies/analysis/compute/:electionId`).
- Update `docs/UPCOMING_2026_ELECTIONS.md` (stale: it says Assam is 2008) or retire it.

### B. Replace estimated data with real data
- BR 2010/2015/2020, TN/KL/AS/PY 2021: real votes for **all candidates** from ECI statistical reports
  (Form 20 / constituency-wise detailed results PDFs or archived result pages), correct SC/ST reservation, record the source.
- LS 2024: all candidates (not just top 5) + correct turnout/electors.
- Every corrected dataset: update `frontend/src/model/about/about.ts` in the same change (the About page lists quality).

### C. People and photos
- Person layer for all states (not just Bihar): link the same politician across elections (the Bihar approach:
  `scraper/src/seed-person-matches.ts`, run-once seeds).
- Photos: **our own storage** (Vercel Blob via the admin media path), never hotlinked. Download once, upload, store our
  URL; record source + licence per photo (Wikimedia is mostly CC BY-SA → show a credit on the person page or About).
- Affidavits (age, assets, liabilities, criminal cases): `scraper/src/adapters/myneta-adapter.ts`,
  `scraper/src/generate-affidavit-seed.ts` exist (Bihar).

### D. Key leaders by person id
- Add `person_id` to manifest `leaders` / `cabinet` / `watchlists` entries so the frontend stops name-matching
  ("Tejashwi Yadav" vs "TEJASHWI PRASAD YADAV"). Touches the manifest editor (admin) and `frontend/src/model/derive/leaders.ts`.
- Fix the Assam 2021 Jalukbari/Sorbhog leader seat.

### E. Prepare 27 Feb 2027
- **Confirm which elections count that day** (not recorded anywhere yet — ask the user).
- For each: election record (Upcoming, result date, delimitation, map), constituencies, **candidates from ECI's own
  lists** (ECI candidate pages list every contestant with 0 votes before counting — use them so names match exactly),
  parties, manifest. Then follow `docs/LIVE_RUNBOOK.md` T−7 (keys, shards, `npm run live:check` until READY).

## 4. Rules that bind every seed (CLAUDE.md)
- Only `database/setup.sh` builds a DB; seeds re-run on **every deploy**: `ON CONFLICT DO NOTHING`, never `TRUNCATE`,
  set `results.election_id`, scope constituency UPDATEs by election (LS/VS numbers overlap).
- Rows admins edit later → **run-once** seed with a `seed_runs` marker (`scraper/src/seed-run-once.ts`).
- Add each new seed to `setup.sh` in the right order (parties before results; supporting seeds after).
- Every candidate needs a person (trigger auto-creates one); `results` row per candidate (ingest relies on it —
  `live:check` reports `missing_result_rows`).
- New migrations idempotent; keep `backend/prisma/schema.prisma` in sync; never `prisma db push`.
- Map files are per delimitation (`<code>_ac_<era>.geojson`); never edit one in place.
- Update `docs/FEATURES.md` and `about.ts` with each dataset.

## 5. Open questions to settle at the start
1. Which elections are counted on 27 Feb 2027?
2. Priority between A (2026 backfill) and B (fixing estimated history) if time is short.
3. Source for the Assam 2023 constituency boundaries (GeoJSON) and its licence.
4. Depth for history: all candidates for every past election, or top-N + NOTA?
5. Photo sources beyond Wikimedia (ECI candidate photos are on the result pages: licence/permission?).

## 6. Done when
- The five 2026 elections are live with full, sourced results, maps, manifests and analysis.
- No dataset on the About page is "Votes estimated" (or each remaining one has a dated plan).
- Persons + photos (own storage, credited) for the states shown; leaders linked by person id.
- The 27 Feb 2027 elections are created with ECI candidate lists and `live:check` prints READY.
