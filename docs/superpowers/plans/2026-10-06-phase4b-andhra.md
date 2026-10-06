# Phase 4B-3: Andhra Pradesh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Andhra's four assemblies (2009-2024, 175 seats; 2009/2014 cut from the undivided-state reports) on the site with real ECI results, regions and person links; 2024 at current-track depth; then on production.

**Architecture:** The Sikkim/Arunachal pipeline plus one registry hook, `seatRange` (keep a slice of a report's seats and renumber them), and a rebuilt map from ECI's 2024 boundary file.

**Tech Stack:** TypeScript scraper (vitest), PostgreSQL seeds, S3 media, React frontend.

**Spec:** `docs/superpowers/specs/2026-10-06-phase4b-andhra-design.md`. Template: `docs/superpowers/plans/2026-10-06-phase4b-arunachal.md`.

## Global Constraints

- Seeds fill-only / run-once as before; shipped seeds unchanged (except `seed_party_symbols.sql`, `setup.sh`); units v1-v3 frozen, Andhra units → `units-7.json` → v4.
- Election ids `a0020000-0000-4000-8000-00000000<year>`; prefix `AP_VS<yy>_`; state id 2; delimitation `'2008'`; 175 seats; majority 88 (none shown for 2009).
- 2009/2014: seats 120-294 of the report, renumbered −119; party-performance cross-check skipped for these partial reports; every seat-level check runs.
- Leaders, parties and units lists user-approved before seeding.
- Production: Neon backup first; setup twice via the direct host; Render only if backend files change.

## Review Focus

1. **Renumbering.** Expected: 2009/2014 seat 1 = Ichchapuram, 175 = Kuppam, names equal to 2019/2024's (bar spelling); person links and seat history join on the new numbers.
2. **Telangana leakage.** Expected: no 2009/2014 candidate from seats 1-119 in any Andhra seed.
3. **2009 framing.** Expected: no majority line for 2009; About says it is the Andhra part of the undivided assembly.
4. **Praja Rajyam merger.** Expected: a 2009 PRP seat won by INC in 2014 is not a flip; YSRCP is a breakaway (flip).
5. **Map.** Expected: 175 numbered features from ECI, every seat coloured.

---

### Task 1: Registry, seatRange, fetch
- [ ] Failing tests: registry (`electionsOf('AP')` docids 4054/4055/11673 + category 2, dates, ids, `seatRange` on 2009/2014); loader/normalize: a report with seats 119-121 and `seatRange {from:120,to:294,offset:119}` keeps 120-121 as 1-2 (detailed and summaries) and the cross-check skips the party table for it.
- [ ] Implement (`ElectionConfig.seatRange`; applied in `loadRaw` after `loadReport`; `crossCheck` gets a `partial` flag); fetch `fetch-cli.ts AP`; tests + `npm test`; commit.

### Task 2: Parse, results, lineage, map
- [ ] Parse 4 years (0 problems; fixture tests for any layout deviation); re-parse every other state (no change); parties (`suggest-parties-cli`), manifests (alliances 2014 TDP+BJP, 2024 TDP+JSP+BJP, sourced; majority 88 except 2009; geo); generate; winners vs ECI (2019 YSRCP 151 TDP 23 JSP 1; 2024 TDP 135 JSP 21 YSRCP 11 BJP 8; 2014 subset TDP 102 YSRCP 67 BJP 4 IND 2 …; 2009 subset vs seat winners).
- [ ] Lineage: PRP → INC merger, YSRCP ← INC breakaway (researched dates/sources) in `lineage.json`.
- [ ] Map: `fetch ac/S01.js` (results site or Wayback) → `geo-cli.ts AP --year 2024 --write`; check 175 features.
- [ ] Wire setup; setup twice; commit.

### Task 3: Districts and regions
- [ ] Research (agent): 26 current districts, seat → district; regions by old district (Uttarandhra / Coastal Andhra / Rayalaseema); `regions-cli.ts AP`; wire; 0 untagged; commit.

### Task 4: Person links
- [ ] v1 + v2; check key leaders (Naidu Kuppam 2009-2024, Jagan Pulivendla 2014-2024, Pawan Kalyan 2019 two seats / 2024 Pithapuram); wire; commit.

### Task 5: Leaders (user-approved)
- [ ] Research (agent) → `leaders.json`; `--add-history`; hand-add multi-seat candidacies; `--check`. **Approval.** Profiles, seed, wire; commit.

### Task 6: Parties and units v4 (user-approved)
- [ ] Failing test `unitsSeedOf('units-7.json') === 'seed_party_units_v4'`; implement. Research profiles (TDP, YSRCP, JSP if not profiled) and units (TDP, YSRCP, JSP, BJP, INC). **Approval.** Seeds, wire; commit.

### Task 7: Photos and affidavits
- [ ] `photos-cli.ts AP` (detached, S3 env), `affidavits-cli.ts AP` (slug checked); wire; commit.

### Task 8: Verify, document
- [ ] About rows (+ `undivided_2009` note, 4 languages; test RED→GREEN); snapshot state id 2; two-DB check from a fresh prod copy; browser (2024 dashboard, 2009 dashboard without a majority line, a seat page with history 2009-2024, Regions); docs (FEATURES, CLAUDE, DEPLOYMENT, playbook: `seatRange`); all suites; commit.

### Task 9: Final review, merge, production
- [ ] Fresh reviewer; one fix pass; merge; push; Neon backup; setup twice on prod; Render only if backend changed; prod checks.
