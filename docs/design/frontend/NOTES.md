# Frontend detail screens — design notes

Stitch project "Election Tracker Redesign" (7025431006647439600). `list_screens` omits screens; find new ones via `get_project` → `screenInstances`.

## Seat dialog — screen b4066349efd54fadb72793dc405960e0 (approved 2026-10-02)

Fix in code (not Stitch):
1. Drop the candidate subtitle ("BJP · Patliputra") — party already has its own column.
2. Party marks are placeholders: real `symbol_url`, else `eci_symbol_url`, else the colour dot.
3. Status pill only for LEADING / WON; no TRAILING on every other row.
4. 3-way / spoiler note only when the data says so; place it on its own row under past winners.
5. Mobile: same content as a bottom sheet, stat cells 2×2 (no separate Stitch screen).

## Party dialog — screen 34cdb100aeff4b69b152218e9b3309d4 (approved 2026-10-02)

Fix in code:
1. Drop invented copy: "ECI CONFIRMED FEED", footer "Showing real-time automated ECI data stream" (results are admin-entered, no ECI ingestion).
2. Drop "Full party tally & historic trends →" — party is a dialog, no party page.
3. Founded = year only (`founded_year`).
4. No "Head of Mahagathbandhan"; alliance comes from the election's alliance groups, shown only when the party has one.
5. Key candidate cards: no "Seat #N", seat name is enough. Hide profile fields with no data (no "—").

## Constituency page — desktop 7b431d3ece524247a657f0a1ae6a4dd4, mobile 319d6c5b27a243b8b2615f4bf80f1068 (2026-10-02)

Fix in code:
1. Drop invented copy: top-bar "ECI LIVE" chip, "Real-time counts synced with Election Commission of India official declaration", "Affidavit data verified via ADR & ECI Form 26 filing", "Studio Desk AI Analysis", "Confidence Score", "Next official round expected in 18m", "Sort: By Votes (Desc)", mobile footer "ECI live feeds…".
2. Insights only from data (3-way / spoiler from the analysis). No free-text narratives ("Vote-split dynamics … rural pockets"). Turnout swing only if the previous election's turnout for the seat is known.
3. Candidate subtitles: only an "Incumbent" tag (`is_incumbent`); no "Incumbent MP" / "Former Rajya Sabha MP".
4. Locator: drop "Adjacent seats" and "Patna Division" (no data). Counting progress bar uses `current_round / total_rounds`, hidden when unknown.
5. Seat history: DECIDED — extend `SeatHistoryStrategy` to also store runner-up (name, party) and winner vote share, so the design stays as drawn. Drop "Full historical breakdown →".
6. Status column: pill only for LEADING / WON (as the seat dialog). Criminal cases: amber chip only when > 0, plain "0" otherwise.
7. NOTA row: party column empty (not "Constitutional").

## Person page — desktop 47f4b8b1a4504b06bb4e5319ee0e7a35, mobile layout 80ed659484f04d1fb02c8342ac5190f4 (drawn at desktop width) (2026-10-02)

Fix in code:
1. Drop invented copy: "Election Intelligence Studio" tagline, top nav (Overview / Map / Candidates), "Candidate Dossier", "Last active session", "5 Recorded Cycles", "Institutional dues", stat subtitles ("Victories in general ballots", "Electoral conversion rate"), footer "updated real-time during ballot aggregation".
2. Drop the "Patliputra key info" tile (assembly segments — no data).
3. Party badge on the photo = current party (mobile shows a wrong "INC").
4. "Incumbent MP" → "Incumbent" only, and only when the latest candidacy has `is_incumbent`.
5. Mobile: `arrow_back` is an icon-font glitch — use our icon. Bio shown in full (no truncation / read-more).
6. Derived values are fine and computed from the contests: "RJD → BJP in 2014", "First contest under BJP", year range, asset growth %, per-year criminal cases.
7. Affidavit chart: assets + liabilities per contest (desktop shows assets only). Hide the tile when no contest has affidavit data.
