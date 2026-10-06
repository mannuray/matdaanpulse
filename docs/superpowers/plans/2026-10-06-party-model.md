# Party model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Party lineage (renames, mergers, splits) applied through one comparison rule in every cross-election comparison, and per-state party units with leaders, shown in the party dialog.

**Architecture:** Migration 023 adds `party_lineage`, `party_units`, `party_unit_roles`; read APIs expose them. One rule module per side (`backend/src/common/comparable-parties.ts`, `frontend/src/model/derive/comparableParties.ts`) with the same case table; the ~13 comparison points call it. Sourced seeds fill lineage and units. The party dialog gains a state-unit block and lineage note. Seat analysis is recomputed for all elections after deploy.

**Tech Stack:** PostgreSQL migration + Prisma; NestJS (jest); React MVVM (vitest); scraper ts-node generators for seeds.

**Spec:** `docs/superpowers/specs/2026-10-06-party-model-design.md`.

## Global Constraints

- Migration idempotent (`IF NOT EXISTS` / `DO` blocks), no seed data dependency; Prisma schema in sync (`prisma migrate diff`, expected drift only).
- Rule: rename/merger = same party; split → successor inherits, the other faction is new, old-party seats it holds are `split` (not flips); family view; events apply only between the two elections' dates and, when state-scoped, only in that state.
- Both rule implementations pass the same case table (kept as `docs/party-lineage-cases.md` + mirrored test data).
- Seeds: lineage idempotent (`ON CONFLICT DO NOTHING`); units run-once (`seed_runs`), with person links only to existing persons.
- Party dialog: state-unit block only in a state context; no change without one.
- MVVM lint, i18n parity (en/hi/ta/mr); docs: FEATURES, CLAUDE (migration 023, rule module), DEPLOYMENT (recompute step).

## Review Focus

1. **Event dates vs election dates**: an event dated between two elections applies; one after the later election does not (comparing 2014 with 2019 must ignore a 2022 split).
2. **State-scoped events** never leak into other states' comparisons (Kerala Congress faction vs a same-named party elsewhere).
3. **Chains**: rename then split (TRS → BRS, then a faction), merger of a party that itself split earlier; carry-forward must terminate (no cycles from bad data — detect and throw).
4. **A person who followed a split** (Shiv Sena 2019 → Shiv Sena (UBT) 2024) is not a "party switch"; one who joined an unrelated party is.
5. **Region and party-trend charts** after carry-forward: no double counting when two predecessors merge into one party.

---

### Task 1: Schema and read API

**Files:** Create `database/migrations/023_party_lineage_units.sql`; Modify `backend/prisma/schema.prisma`, `backend/src/modules/parties/{parties.controller,parties.service}.ts` (+ spec); frontend `model/types` (Party gains `units`, `lineage`), `model/api/geo.service.ts` (`getPartyLineage`).

**Interfaces — Produces:** `GET /parties/lineage` → `LineageEvent[] = { partyId, predecessorId, kind, effectiveDate, stateId|null, isSuccessor, note }`; `GET /parties/:id` → existing fields + `units: { stateId, stateName, eciRecognition, office, website, roles: { role, personId|null, personName, fromDate, toDate|null }[] }[]` + `lineage: LineageEvent[]` (events where the party is either side).

- [ ] **Step 1: Failing tests** (parties service spec): lineage list shape; `findOne` includes units with current roles first and lineage both directions.
- [ ] **Step 2: Run** `cd backend && npx jest src/modules/parties` — FAIL.
- [ ] **Step 3: Implement** migration (tables, FKs, CHECKs on kind/role/recognition, unique indexes), Prisma models, service/controller (lineage CDN-cached like other public reads).
- [ ] **Step 4: Run** — PASS; `database/setup.sh` twice; `prisma migrate diff` shows only expected drift.
- [ ] **Step 5: Commit** `feat: party lineage and state units — schema and read API (migration 023)`.

---

### Task 2: The comparison rule (both sides, same cases)

**Files:** Create `docs/party-lineage-cases.md`, `backend/src/common/comparable-parties.ts` (+ spec), `frontend/src/model/derive/comparableParties.ts` (+ test).

**Interfaces — Produces:** `carryForward(events, partyId, fromDate, toDate, stateId): string`; `relation(events, prevPartyId, curPartyId, ctx: { fromDate, toDate, stateId }): 'same'|'split'|'different'`; `familyOf(events, partyId, date, stateId): { root: string; members: string[] }`.

- [ ] **Step 1: Failing tests** — the case table, identical on both sides:
  - TRS 2018 → BRS 2023: `same`; JVM 2014 seat → BJP 2019: `same` (merger dated 2020 is NOT between 2014 and 2019 → `different`; between 2019 and 2024 → `same`).
  - Shiv Sena 2019 → SHS 2024 `same`; SHS 2019 → SS(UBT) 2024 `split`; INC 2019 → SS(UBT) 2024 `different`.
  - LJP 2020 → LJP(RV) 2025 `same` (successor in practice, flagged); LJP 2020 → RLJP `split`.
  - A 2014 → 2019 comparison ignores the 2022 Shiv Sena split.
  - A Kerala-only split does not affect the same parties in Tamil Nadu.
  - A lineage cycle throws `lineage cycle at <id>`.
  - `familyOf('SSUBT', 2024)` = `{ root: 'SHS', members: ['SHS','SSUBT'] }`.
- [ ] **Step 2: Run** both — FAIL. **Step 3: Implement** (pure, no I/O). **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** `feat: one party comparison rule (rename/merger/split) with a shared case table`.

---

### Task 3: Apply the rule in the backend analysis

**Files:** Modify `backend/src/modules/constituencies/strategies/{swing,incumbency,dominance}.strategy.ts` (+ specs), `analysis-strategy.interface.ts` (context gains `lineage` and election dates), `constituencies.service.ts` (loads lineage once per compute).

- [ ] **Step 1: Failing tests**: swing marks `flipped: false, split: true` for a split seat and `flipped: false` for a rename; incumbency does not report a switch for a person who followed the split; dominance counts a renamed party's wins together.
- [ ] **Steps 2–4**: implement, run (`npm run test:unit`), PASS.
- [ ] **Step 5: Commit** `feat(backend): seat analysis follows party lineage (no flips for renames, split seats labelled)`.

---

### Task 4: Apply the rule in the frontend

**Files:** Modify `viewmodels/data/useHistoryAnalysis.ts`, `useAnalysis.ts` (pass `split`), a lineage data hook `viewmodels/data/useLineage.ts` (fetched once, cached), `model/derive/{intelligence,seatInsights,personPage,regionComparison,layerInsights,stats}.ts`, `model/derive/summary/swing.ts` (+ their tests).

- [ ] **Step 1: Failing tests** per function: seatInsights flip/streak treat a renamed party as the same; personPage does not list "followed the split" as a switch; regionComparison carries previous ids forward before grouping and does not double count a merger (Review Focus 5); layerInsights/summary swing put split seats in their own bucket; stats `flipped` excludes split.
- [ ] **Steps 2–4**: implement, run `npx vitest run` + lint, PASS.
- [ ] **Step 5: Commit** `feat(frontend): every cross-election comparison follows party lineage`.

---

### Task 5: Lineage and state-unit data

**Files:** Create `scraper/data/parties/lineage.json`, `scraper/data/parties/units.json`, `scraper/src/party-model-cli.ts` (generator + tests), `database/seed_party_lineage.sql`, `database/seed_party_units_v1.sql`; Modify `database/setup.sh`.

- [ ] **Step 1: Generator test-first**: lineage rows emit `ON CONFLICT DO NOTHING`; unknown party ids refuse; units emit a run-once seed whose roles link `person_id` only when the person exists (by curated person key / candidate id), else `person_name` only.
- [ ] **Step 2: Research** (agents, sourced): lineage events touching our 15 states since 2008 (at least the spec's list + Kerala Congress factions, AIADMK/AMMK, Apna Dal (S)/(K), INLD→JJP, HJC(BL)→INC, RLSP→JD(U), LJP split, NCP split, Shiv Sena split, JVM→BJP, TRS→BRS); units for every party that won a seat or is an alliance member in each state's latest election: recognition there, office, current state president + legislature leader, and those at the latest election.
- [ ] **Step 3: Show the lineage list and the unit list to the user for approval** (like leaders). No seeding before.
- [ ] **Step 4**: generate seeds; wire after the party seeds (lineage) and after leaders (units); setup twice.
- [ ] **Step 5: Commit** `feat(seed): party lineage and state units (sourced, user-approved)`.

---

### Task 6: Party dialog — state unit block and lineage note

**Files:** Modify `viewmodels/tiles/usePartyDialogVM.ts` (+ test), `views/party/PartyDialog.tsx` (+ test), i18n ×4.

- [ ] **Step 1: Failing tests**: in a Bihar context the dialog shows "BJP Bihar · recognised as National party · state president <link> · legislature leader <link>"; outside a state context no unit block; a split faction shows "Faction of Shiv Sena since 2022 …" and this election's family total; a renamed party shows "Formerly TRS".
- [ ] **Steps 2–4**: implement, PASS, lint.
- [ ] **Step 5: Commit** `feat(frontend): party dialog shows the state unit and the party's lineage`.

---

### Task 7: Recompute, verify, document, ship

- [ ] **Step 1**: `scraper/src/recompute-analysis-cli.ts` calls `POST /admin/constituencies/analysis/compute/:id` for every election (admin token from env), with progress; run locally; spot-check: no flips for TRS→BRS-style renames; Jharkhand 2024 seats of former JVM MLAs compared correctly.
- [ ] **Step 2: Browser**: party dialog in Bihar, Jharkhand, UP, Haryana; a seat page and the Swing layer in a state with a lineage event.
- [ ] **Step 3: Docs**: FEATURES, CLAUDE (migration 023, rule module path, seeds), DEPLOYMENT (run the recompute after deploy), playbook (add lineage when seeding a state).
- [ ] **Step 4: All suites**; final review (fresh reviewer); merge; push (Vercel + Render auto-deploy); prod: backup branch, setup, recompute, checks.
