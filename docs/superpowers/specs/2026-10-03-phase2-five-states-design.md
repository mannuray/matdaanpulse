# Phase 2: Assam, West Bengal, Tamil Nadu, Kerala, Puducherry: design

Date: 2026-10-03. Status: agreed in discussion, pending spec review.
Context: `docs/SEEDING_PLAYBOOK.md` (how-to), Phase 1 (Bihar) specs and plans. Order set by the user: correct the
history first (back to 2011, the first elections under the 2008 delimitation), then add 2026.

## 1. Goal

1. **Historical track:** every election of the five states since 2011 has real ECI results for every candidate, so
   seat history, swing and analysis are right.
2. **Current track:** the five 2026 elections (counted May 2026) are live on the site at Bihar 2025's depth.

## 2. Where the data stands (local DB = production seeds, checked 2026-10-03)

| State | 2011 | 2016 | 2021 |
|---|---|---|---|
| West Bengal | real, 2 per seat | real, 2 per seat | real, all candidates (7.1 per seat) |
| Tamil Nadu | real, 2 per seat | real, 2 per seat (232 of 234 seats) | **synthetic** (every runner-up at 50,000) |
| Kerala | real, 2 per seat | real, 2 per seat | **synthetic** |
| Assam | real, 2 per seat, no SC/ST | real, 2 per seat, no SC/ST | **synthetic**, placeholder names |
| Puducherry | real, 2 per seat | real, 2 per seat | winners only |

2026: none of the five elections exist yet.

## 3. Sources (verified 2026-10-03)

- **History: ECI statistical reports**, all 15 present (`/api/old-site-statistical-report-data?docid=<id>`):

  | | 2011 | 2016 | 2021 |
  |---|---|---|---|
  | Assam | 4010 (PDF) | 4017 | 13620 (XLSX) |
  | Kerala | 3763 (PDF) | 3767 | 13827 (XLSX) |
  | Puducherry | 3438 (PDF) | 3474 | 13417 |
  | Tamil Nadu | 3340 (PDF) | 3473 | 13680 |
  | West Bengal | 3195 (PDF) | 3469 | 14106 (incl. AC 56 & 58) |

  2011 and 2016 are single full-report PDFs (Bihar 2010/2015 layout), 2021 is XLSX (Bihar 2020/2025 layout). The
  Phase 1 parsers and the ECI-internal cross-check apply; state-specific deviations are fixed test-first.
- **2026: ECI results site** (`results.eci.gov.in/ResultAcGenMay2026/`, still live; Wayback as fallback):
  candidate-wise pages (every candidate, votes, photo), party-wise pages, and the constituency **boundary GeoJSON**
  (`/ac/<STATE_CODE>.js`; Assam S03, Kerala S11, Tamil Nadu S22, West Bengal S25, Puducherry U07). ECI statistical
  reports for May 2026 are **not published yet**; electors, turnout and the internal cross-check for 2026 come from the
  statistical report when it appears (a later `_v2` correction), and until then from what the results site shows.
- **Affidavits:** MyNeta winners tables (slugs found per state during the build).
- **Leaders, party details, photos:** as in the playbook (Wikidata/Commons for leaders and party images; ECI results
  pages for candidate photos).

## 4. Historical track (15 elections; results only)

Per the playbook's historical track:
- Every candidate + NOTA, real votes, SC/ST, electors, turnout, phase; ECI-internal cross-check must pass.
- Existing rows corrected in place: keep old candidate/result ids for matched rows; one run-once corrections seed per
  state, run before the year seeds, with the pre-flight check, frozen once shipped. West Bengal 2021 is cross-checked
  and corrected only where it differs.
- Party mapping as in Phase 1; new small parties get bare grey records.
- Cross-election person linking (scripted, no research), the same rules as Bihar.
- **Not in this track:** photos, leaders, party profiles, affidavits, candidate details.
- About page (`about.ts`): each corrected year becomes "real" with the ECI statistical report as source.
- Tamil Nadu 2016's two postponed seats: loaded as ECI reports them (they were polled later); noted on About if absent.

## 5. Current track (5 elections of 2026)

- Election records: VS, 2026, Finalized, result date, delimitation `'2008'` (Assam `'2023'`), manifests (alliances,
  `compare_with` / `history` to the same-delimitation elections; none for Assam).
- Results from the results site: every candidate + NOTA, votes, status, margin; reservation from the seat name;
  electors/turnout when available.
- **Maps:** Assam needs `frontend/public/geo/as_ac_2023.geojson` from ECI's own 2026 boundary file (126 seats,
  numbered 1–126 under the 2023 delimitation), simplified to a few hundred KB. The other four keep their 2008 maps;
  ECI's 2026 files are used to check the seat numbering matches.
- Assam 2026: new constituencies (2023 numbering), districts and regions.
- Leaders (curated with sources, user-reviewed) with Blob photos and credits; leaders/cabinet watchlists by `person_id`.
- Top parties per state (won a seat, 1 %+ vote, alliance members), researched and reviewed, with images.
- Candidate photos: top 4 per seat from the results pages.
- Winners' affidavits from MyNeta.
- Seat analysis recomputed after loading (post-deploy step).

## 6. Assam after the 2023 redraw: how comparisons work

- **No seat-level history** for Assam 2026 (boundaries and numbers changed). The site already shows "Boundaries redrawn
  in 2023" and classifies the seats as new; this stays.
- **Statewide comparison** 2021 vs 2026 (seats and vote share by party and alliance) is valid and is shown.
- **Region-level comparison**: Assam's regions (e.g. Upper Assam, Lower Assam, North Bank, Barak Valley, Bodoland,
  Hills) are tagged on both the 2021 seats and the 2026 seats; vote share and swing are compared per region. This is
  approximate (a few seats straddle regions) and labelled as such.
- Notional 2021 results on the 2023 boundaries (Form 20 polling-station data) are out of scope.
- 2031 onwards compares with 2026 normally (same delimitation).

Whether the site already offers a region-level comparison view is checked during planning; if not, the plan adds the
smallest version (a region swing table on the election view) for elections whose delimitation changed.

## 7. Code changes needed

- Generalise `scraper/src/bihar/` to a state-aware pipeline (state code, election ids, const-id prefix, MyNeta slugs,
  report docids per state + year) without changing Bihar's output (Bihar's seeds must regenerate byte-identical).
- A results-site parser for 2026 (candidate-wise pages are already parsed by `eci-vs-adapter.ts`; party-wise pages too).
- Map simplification step (mapshaper or equivalent) for the Assam GeoJSON.
- Region comparison (only if missing; see §6).

## 8. Order and plans

1. **Plan A: historical track.** Generalise the pipeline; load and correct the 15 elections state by state; linking;
   About; checks.
2. **Plan B: current track.** 2026 elections, Assam map and regions, leaders, parties, photos, affidavits, region
   comparison; checks.
Each plan ends with the two-DB check, a fresh build run twice, and a whole-branch review before merge.

## 9. Done when

- All 15 historical elections show every candidate with real ECI votes and correct SC/ST; About lists them as real.
- The five 2026 elections are on the site with maps (Assam on its 2023 map), leaders, top parties, top-4 photos,
  affidavits, and seat analysis; Assam shows statewide and regional comparisons, not seat history.
- `docs/SEEDING_PLAYBOOK.md` has the historical track written out and any new traps.
