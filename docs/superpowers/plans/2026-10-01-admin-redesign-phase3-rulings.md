# Admin redesign Phase 3: rulings made during execution

Decisions taken while running `2026-10-01-admin-redesign-phase3.md` (subagent-driven). Each line says what was decided, why, and the cost if it turns out wrong.

- **Feedback bell:** added to the top bar in Task 7. The spec (§3) asks for it and the plan had left it out.
- **Feedback bell roles:** it only runs for SUPER_ADMIN and EDITOR and swallows API failures, so a VIEWER calls no admin endpoint.
- **Task 13 legacy-CSS removal:** the cleanup greps exclude test files and `legacy-free.test.ts` itself, and the guard's legacy class list was extended.
- **Dashboard (Task 6):** the IST clock uses h23. A failed refresh keeps the last good overview.
- **CSV export:** a cell starting with `-` also gets the formula-injection prefix, unless it is a plain number (`/^-?\d+(\.\d+)?$/`). This follows the OWASP guidance and keeps numbers intact.
- **Manifest SearchableSelect:** the list reopens on typing, click or ↓ after a pick, so repeated adds work. Party labels are per row.
- **Manifest search and live tabs:**
  - A failed search shows an inline "Search failed" note instead of failing silently.
  - Live tabs skip the write when nothing parses; an empty field clears.
- **Seat locks (hotfix 0fa6711):** `const_id` accepts real constituency ids (`[A-Za-z0-9_&-]`, max 100) instead of UUIDs. Seat locks never worked with real data before this. `&` is allowed because three real ids contain it, and it is inert in Redis keys and SCAN patterns. This also matters for production.
- **Final review:**
  - The fix wave covered: edits typed during a manifest save or publish are kept and stay dirty, a centred full-screen error, a delayed CSV blob revoke, a latest-request guard on system status, and seat-lock test cases.
  - Parked: a failed manifest load shows both a toast and the inline error; for a VIEWER, ⌘K triggers caught 403s (pre-existing).
