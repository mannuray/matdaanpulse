# Admin redesign: Stitch reference screens

Stitch project "MatdaanPulse Admin" (id `4127900359845496234`), design system `assets/9024806603811946485`.
Spec: `docs/superpowers/specs/2026-10-01-admin-redesign-design.md`.

Stitch `edit_screens` returns DOM operations but does not update its stored HTML. The `*.html` / `*.png`
files here are the Stitch output with those operations applied locally, so treat these files as the reference.

Every number shown in these screens is a placeholder. Real values come from the API.

## Fix in code (not in the Stitch screens)

### Live console (`live-console.*`)
- Filter chips wrap (`flex-wrap`) — done in Phase 1.

### Candidates (`candidates.*`)
- None outstanding.

### Dashboard (`dashboard.*`)
- Row 3 cards: content starts at the top with tight row spacing (no stretched gaps). The "View…" links stay pinned at the bottom.
- KPI subtitles: Leading "in N seats", Pending "no votes yet", Last update "N min ago · Round R".
- System health badge: "All OK" (not "Nominal 99.98%").
- Remove the "Real-time audit" and "Desk queries" header labels.
- Activity feed: there are no "verified" events (that feature was dropped). Lock take-over events do exist ("Priya S took over 145 Bikram").
- Feedback card: there are no names or roles. Each preview shows a kind badge (`bug` rose, `data_error` amber, `suggestion` indigo,
  `other` slate), the first line of the message, the `page` path in monospace, and the relative time.

### Login (`login.*`)
- Use the real logo `/logo-mark.png` instead of the generic ballot icon.
- Show the error banner only after a failed sign-in.

## Phase 1 follow-ups (carry into Phase 2)
- Move-away prompt is discard-only (`window.confirm`); spec wants Save / Discard / Cancel dialog.
- Live pill has no "offline" state after repeated failures; "Last saved" shows only this tab's saves (use candidates' `last_updated`).
- "Declare won" has no confirmation / undo; "Save seat" stays enabled on a clean seat (does nothing).
- Unsaved-edit guard not on the HealthDot link or Log out; logout leaves the seat lock until TTL (≤120 s); two tabs of one user share a lock.
- Seat list hides locks older than 120 s using the browser clock (skew > ~75 s could hide live locks).
- Moving off a locked seat fires one extra lock acquire; Redis down while viewing a locked seat stays read-only until Take over.
- Small test gaps: NOTA margin clamp, SSE seat-lock/status handlers, self-take-over audit, controller-level HTTP tests.
- Backend hardening: Lua `type(parsed)=='table'` guard; `forceSet` via `SET … GET`; 503 message rewritten to "Internal server error" by the filter (clients key on `RESULT_6003`).
- Sidebar not responsive (desktop-only by spec); admin bundle > 500 kB (chunk warning).
