# Vidhan Sabha Data Pipeline (retired)

The original per-state pipeline (`database/data/{state}_vs_{year}.json` → `scraper/src/generate-{state}-vs-seeds.ts`)
was retired on 2026-10-08 and its scripts and JSON deleted: they wrote the same `database/seed_<st>_vs_<year>.sql`
files the current pipeline owns, from stale data, and skipped its corrections safeguard.

To seed or correct an election, follow **`docs/SEEDING_PLAYBOOK.md`**: the registry pipeline in `scraper/src/bihar/`
(`elections.ts` + `generate-cli.ts`, data in `scraper/data/<state>/`). The old files are in git history before
commit "chore(scraper): retire the legacy per-state seed generators".
