# Admin redesign: Stitch reference screens

Stitch project "MatdaanPulse Admin" (id `4127900359845496234`), design system `assets/9024806603811946485`.
Spec: `docs/superpowers/specs/2026-10-01-admin-redesign-design.md`.

Stitch `edit_screens` returns DOM operations but does not update its stored HTML. The `*.html` / `*.png`
files here are the Stitch output with those operations applied locally, so treat these files as the reference.

Every number shown in these screens is a placeholder. Real values come from the API.

## Record pages: Stitch items dropped (2026-10)

The party, person, candidate and constituency record screens (`*-record.*`) were built as `components/record/RecordPage`
pages, without these Stitch items (plan `docs/superpowers/plans/2026-10-02-admin-record-pages.md`, Decision 5):
- Settings, Documentation and "Cluster" in the sidebar.
- The "Chief Returning Officer" user label.
- ALL-CAPS group labels (sentence case instead).
- "Archive party".
- "Created by" as a separate field (replaced by "Last edited by", read from the audit log).
- ECI candidate serial, nomination date and a per-candidate "Certified" mark.
- "View full archive".
- "Voter elasticity" as a label (replaced by the line "Party changed K times in N elections").
- Party "ECI registration" became the ECI recognition field (National / State / Unrecognised).

## Fix in code (not in the Stitch screens)

### Live console (`live-console.*`)
- Filter chips wrap (`flex-wrap`) — done in Phase 1.

### Candidates (`candidates.*`)
- Built in Phase 2. The panel is 400px (decisions.md), not the spec's ~440px.
- The panel is a non-modal sheet in the page's flex row (as in the screen), not an overlay.
- "New candidate" exists (`/candidates/new`); it also creates a zero-vote results row so the candidate appears in the Live Console.

### Dashboard (`dashboard.*`)
- Row 3 cards: content starts at the top with tight row spacing (no stretched gaps). The "View…" links stay pinned at the bottom.
- KPI subtitles: Leading "in N seats", Pending "no votes yet", Last update "N min ago · Round R".
- System health badge: "All OK" (not "Nominal 99.98%").
- Remove the "Real-time audit" and "Desk queries" header labels.
- Activity feed: there are no "verified" events (that feature was dropped). Lock take-over events do exist ("Priya S took over 145 Bikram").
- Feedback card: there are no names or roles. Each preview shows a kind badge (`bug` rose, `data_error` amber, `suggestion` indigo,
  `other` slate), the first line of the message, the `page` path in monospace, and the relative time.
- Built in Phase 3. "Leading" shows the number of undeclared seats with a leader, with "<party> ahead in N seats" (the party leading the most of them). "Round R" is the highest current round of any seat. The header phase reads "counting in progress", "upcoming" or "final results". EDITOR has no Recent activity card (its API is SUPER_ADMIN-only); VIEWER sees an elections overview instead of the counting cards.

### Login (`login.*`)
- Use the real logo `/logo-mark.png` instead of the generic ballot icon.
- Show the error banner only after a failed sign-in.
- Built in Phase 3, with status-specific errors (401/400, 429, network) and a return to the requested page after sign-in.

## Closed in Phase 3
- Live pill "offline" state; Declare won confirmation; Save seat disabled on a clean seat; HealthDot and Log out use the unsaved guard.
- Manifest editor rebuilt in Tailwind with always-open sections; `useResourceList` search debounce (300 ms) and stale-response guard.
- `admin.css` deleted, Tailwind preflight on.
- Hotfix 0fa6711 (outside the plan): seat-lock `const_id` accepts real constituency ids (letters, digits, `_`, `&`, `-`, max 100); locks previously failed validation with real data.

## Open follow-ups (after Phase 3)
- Move-away prompt is discard-only (`window.confirm`); the spec's Save / Discard / Cancel dialog needs an async guard.
- The browser Back button does not ask about unsaved edits (BrowserRouter has no `useBlocker`); a data router would fix it.
- "Last saved" in the Live Console shows only this tab's saves (could use the candidates' `last_updated`).
- Seat locks: logout leaves the lock until its TTL (≤120 s); two tabs of one user share a lock; the seat list hides locks older than 120 s by the browser clock (skew); moving off a locked seat fires one extra acquire; Redis down while viewing a locked seat stays read-only until Take over.
- Candidates: per seat only; a cross-seat candidate table needs backend paging. ⌘K candidates are capped at 50 server-side.
- Top-bar feedback bell (spec §3) is not built; the Dashboard Feedback card shows the new count.
- A session that expires mid-page goes to /login without a return path (`handleUnauthorized` does a hard redirect); only `ProtectedRoute` redirects remember the page.
- Small test gaps: NOTA margin clamp, self-take-over audit, controller-level HTTP tests.
- Backend hardening: Lua `type(parsed)=='table'` guard; `forceSet` via `SET … GET`; 503 message rewritten by the filter (clients key on `RESULT_6003`).
- Sidebar not responsive (desktop-only by spec); admin bundle > 500 kB (chunk warning).

### Record pages open follow-ups (2026-10)
- `seed_party_recognition.sql` and `seed_election_result_dates.sql` fill only empty values but run on every `setup.sh`
  (each deploy), so a recognition or result date cleared in the admin comes back. Fix: run one-off data fills once,
  gated by a marker (for example a row in a small `seed_runs` table).
- Pre-existing: `seed_tn_districts_regions.sql` rewrites `district_id` on TN VS seats unconditionally, and its
  overlapping ranges (Vellore) can change a row and change it back in one run. So each deploy reverts admin district
  edits on those seats and moves their `updated_at` ("Last updated" on the record page). Fix: only fill NULLs, or the
  same run-once marker.

### Phase 3 open follow-ups
- The dashboard activity row "saved N results" lacks the seat name.
- The audit log loader fetches 200 rows with no paging.
- The legacy-free regex scan has gaps.

### Persons and candidates open follow-ups (2026-10)
- Scored duplicate matching and a review queue. Today "Possible duplicates" is a same-name suggestion list; a scored match
  (name, date of birth, state, party history) with a queue of pending reviews is agreed for later.
- `not_undoable_reason: 'keeper_missing'` is never produced by the person-detail history (the keeper is the page's own
  person); it exists for a future cross-person merge log.
