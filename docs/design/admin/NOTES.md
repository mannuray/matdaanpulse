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
