# Admin record pages: rulings made during execution

These are the decisions taken while running `2026-10-02-admin-record-pages.md`. Each one gives what was decided, why, and what it costs if it turns out to be wrong.

- **Party ECI recognition filter:** it is on the public `GET /parties?eci_recognition=…|none`, not a new admin route. The data is already public, and this avoids a duplicate list route. The cost is that anonymous users see a change only once the public CDN cache refreshes.
- **Live contest status:** shown in sentence case ("Leading"), not raw ("LEADING"), per the copy rule. Changing it is one line.
- **Phase limits:** `phase` is 1–20 in both the DTO and the migration copy. The server ignores `metadata.phase` in patches.
- **Migration 017:**
  - It strips `metadata.phase` only where the value was copied into the column.
  - Unparseable legacy values are kept, so no production data is lost.
  - A phase cleared in the admin stays cleared across deploys.
- **"Last edited by":** it counts only the nine record-edit actions, not seat-lock take-overs.
- **Seeds re-filling cleared values:** `seed_party_recognition.sql` and `seed_election_result_dates.sql` fill only empty values. A value deliberately cleared in the admin is filled again by the next `setup.sh`. A run-once seed mechanism is a follow-up in `docs/design/admin/NOTES.md`, together with the pre-existing TN district seed churn.
- **Timestamps:** `audit_logs.timestamp` and `constituency_analysis.updated_at` have no time zone and are read as UTC. The database session must stay UTC (`docs/DEPLOYMENT.md`).
- **Backend fixes found while building, all of which matter for production:**
  - A Prisma Decimal 500 on the public `/constituencies` and the admin candidate detail.
  - The admin person endpoint was dropping election-history fields.
  - The candidate list was missing `person_id`, so the Linked tab was always empty.
  - Public `/candidates` now exposes `person_id`; it was already public via `/candidates/persons/:id`. Metadata stays admin-only.
- **Dropped from the Stitch screens:**
  - Archive party, Created by.
  - ECI serial, nomination date, per-candidate Certified.
  - Voter elasticity, "View full archive".
  - The extra sidebar items.
