# Phase 4B-4: Maharashtra Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Maharashtra's four assemblies (2009-2024, 288 seats) on the site with real ECI results, regions and person links; 2024 at current-track depth; then on production.

**Architecture:** The Andhra pipeline without `seatRange`; party splits already modelled in lineage.

**Spec:** `docs/superpowers/specs/2026-10-06-phase4b-maharashtra-design.md`. Template: `docs/superpowers/plans/2026-10-06-phase4b-andhra.md`.

## Global Constraints

- Seeds fill-only / run-once; shipped seeds unchanged (except `seed_party_symbols.sql`, `setup.sh`, `seed_party_lineage.sql` gaining MNS); units v1-v4 frozen, Maharashtra units → `units-8.json` → v5.
- Ids `a0200000-0000-4000-8000-00000000<year>`; prefix `MH_VS<yy>_`; state id 20; 288 seats; reserved SC 29 / ST 25; majority 145.
- Leaders, parties and units lists user-approved before seeding.
- Production: Neon backup first; setup twice via the direct host (retry on a network drop); Render only if backend files change.

## Review Focus

1. **Splits in comparisons.** Expected: 2019 SHS seat won by SHSUBT in 2024 = split (not a flip); won by SHS (Shinde) = held; NCP likewise.
2. **Party ids.** Expected: "Shiv Sena (Uddhav Balasaheb Thackrey)" → SHSUBT, "Nationalist Congress Party – Sharadchandra Pawar" → NCPSP, MNS existing id; no duplicates.
3. **Big report.** Expected: 288 seats per year, candidate counts match ECI's highlights.
4. **Regions.** Expected: six regions, every seat tagged; Mumbai 36 seats.
5. **Leaders.** Expected: Fadnavis, Shinde, Ajit Pawar linked across 2009-2024 (Ajit Pawar's NCP before and after the split).

---

### Task 1: Registry, fetch — failing registry test (docids 3724/3726/11699, category 8, dates, ids); implement; fetch; commit.
### Task 2: Parse, parties, manifests, lineage (MNS), generate, winners vs ECI, wire, setup twice; commit.
### Task 3: Districts and regions (agent; sourced); wire; 0 untagged; commit.
### Task 4: Person links (check Marathi name forms; `looseNames` only if needed, with a test); wire; commit.
### Task 5: Leaders (agent) → **approval** → seed; commit.
### Task 6: Parties + units v5 (failing test `units-8.json` → v5; agent research) → **approval** → seeds; commit.
### Task 7: Photos (`ResultAcGenNov2024` S13) and affidavits (slug checked); wire; commit.
### Task 8: About (test RED→GREEN), snapshot state id 20, two-DB check from a fresh prod copy, browser (2024 dashboard, a split seat's page, Regions), docs, all suites; commit.
### Task 9: Final review (fresh reviewer), fix pass, merge, push, Neon backup, setup twice on prod, checks.
