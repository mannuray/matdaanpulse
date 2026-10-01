# Admin Panel Redesign — Design Spec

Date: 2026-10-01 · Branch: `feat/admin-redesign` · Status: draft for review

## Goal

Make the MatdaanPulse admin panel easier to use, especially on counting day, while keeping
the current colour palette. Problems to fix (from the user):

1. Pages are cluttered and dense.
2. The Live Console is clumsy under counting-day pressure.
3. The visuals feel unfinished and inconsistent.

Success: an editor can find a seat and enter its full result in one view without expanding
rows. Every page uses the same shell, table, panel and form styles, and no page asks the
editor to pick the election again.

## Decisions

| Topic | Decision |
|---|---|
| Scope | Desktop only. Design the core set in Stitch (shell, Login, Dashboard, Live Console, one entity list + panel). The other pages reuse those patterns. |
| Colours | Keep the current tokens exactly (see Visual rules). |
| Build | Rebuild the view layer with **Tailwind v4 + Radix primitives**, the same stack as `frontend/`. Keep `services/`, `context/` and the logic in `hooks/`. |
| Live Console | Split view: seat list on the left, the selected seat's editor on the right. |
| Entity pages | Table + right-hand side panel. Detail and edit are merged into one panel. |
| Election | One global picker in the top bar, remembered across pages (URL + localStorage). |

## 1. Shell (all pages)

- **Top bar:** logo + "MatdaanPulse Admin", the global **election picker**, ⌘K search (jump to a
  seat, candidate, party or person in the selected election), and the user menu (name, role badge, logout).
- **Sidebar:** dark slate (`#1e293b`) with grouped sections and line icons (`lucide-react`):
  - **Counting:** Dashboard, Live Console
  - **Data:** Elections, Manifests, Parties, Candidates, Persons, Constituencies
  - **Admin:** Feedback, Users, Audit Logs, System status (role-gated as today via `NAV_SCHEMA`)
- The `AdminLandingCard` "select an election" pages are removed. Pages that need an election
  read it from the global picker. When no election exists yet, a page shows one empty state
  that links to Elections.

## 2. Dashboard

- A row of 4 KPI tiles for the selected election: seats declared, leading, pending, last update time.
- A primary "Open Live Console" call-to-action.
- Three cards: recent audit activity (last 10), system health (DB / Redis / SSE, from
  `status.service`), new feedback count with a link.
- Nothing is collapsible. Recent activity and System health are SUPER_ADMIN-only (their APIs are
  `@Roles('SUPER_ADMIN')`), so they are hidden for EDITOR.

## 3. Live Console (split view)

- **Left column (~320px):** a search box and status filter chips with counts (All / Pending /
  Leading / Won). Below that, a scrollable seat list: number, name, leader party colour bar,
  status. It replaces the number-range tabs (`live_tabs`).
- **Right panel:** header with seat name, number, type, status and a "last saved hh:mm:ss" stamp.
  The table below lists every candidate with party, editable **votes** and an editable **status**
  select. The margin is **calculated automatically** from votes (leader − runner-up) and
  shown read-only. Margin follows the simulation's convention (`scraper/src/simulation`): the leader's
  margin = leader votes − runner-up votes; every other candidate's margin = leader votes − their votes
  (always ≥ 0, which the bulk endpoint requires). NOTA (`party_id = 'NOTA'`) is never the leader. Its
  status is always TRAILING (LOST once the seat is declared).
- **Statuses follow the votes:** while a seat isn't declared, editing votes recalculates statuses
  (leader LEADING, others TRAILING). The status select stays editable for manual corrections. With a
  tie at the top, nobody is marked leader and "Declare won" is disabled.
- **Actions:**
  - **Save seat** sends all changed candidates in one call to `POST /admin/results/override-bulk`.
  - **Declare won** sets the leader to WON and the others to LOST, then saves.
  - Validation errors show inline next to the field.
- **Keyboard:** ↑/↓ moves between seats (the list scrolls along), Enter saves, Esc discards edits.
  If you move to another seat with unsaved edits, a prompt asks whether to save or discard.
- **Live updates:** when an SSE update arrives for a seat, its list row flashes. If that seat is
  open with unsaved edits, a banner says it changed elsewhere, with a "Reload" option.
- **Round progress:** the seat header shows editable "Round [4] of [24]" with a small bar, saved via
  the bulk endpoint's `rounds` map. Needs one backend change: `getLiveResults` must also return the
  constituency's `current_round` / `total_rounds`. The page header shows overall counting progress
  (% of seats with any votes).
- **Seat lock (new feature, needs backend):** opening a seat for editing takes a soft lock
  (Redis key `lock:seat:{election}:{const_id}` with a 2-minute TTL, refreshed while the editor is
  open, released on save, discard or leaving). Other editors see a "Locked by X" banner, the inputs
  are read-only, and there is a **Take over** button that logs to audit. Lock changes go out over
  the existing SSE channel, and the seat list shows a lock icon. Endpoints:
  `POST/DELETE /admin/live/locks/:constId` and `GET /admin/live/locks?election_id=`. If Redis is
  down, locking is disabled and a warning shows. Saving does not require a lock.

### Top bar extras

- **Live-updates pill:** SSE connected (green) / reconnecting (amber) / offline (rose).
- **Health dot:** a summary from `/health/ready` (DB + Redis) that links to System status.
- **"?" button:** opens a keyboard-shortcuts sheet.
- **Bell:** count of new feedback, linking to Feedback.
- No Settings / Documentation items.

## 4. Entity pages (one pattern, used 6×)

Applies to Elections, Parties, Candidates, Persons, Constituencies, Manifests.

- A page header with the title and record count, plus a primary "New …" button.
- A toolbar with a search box and filter chips/selects (e.g. Candidates: State, Seat, Linked/Unlinked).
- A clean table: sticky header, zebra-free rows, hover highlight, sentence-case headers, a
  clear empty state.
- **Clicking a row** opens a right-hand side panel (Radix Dialog as a sheet, ~440px). The record
  is shown as an editable form with Save / Cancel. Unsaved-change guard applies. The URL
  becomes `/candidates/:id`, so links and the back button keep working (replaces the old
  `/:id` and `/:id/edit` pages).
- The Manifest editor and other large forms open the panel full-width.
- Candidate ↔ person linking suggestions show inside the panel, not inline in the table.

## 5. Visual rules

Same palette as `admin/src/theme/admin.css`, moved into Tailwind `@theme` tokens:

| Token | Value |
|---|---|
| sidebar | `#1e293b` |
| page bg / secondary bg / card | `#f8fafc` / `#f1f5f9` / `#ffffff` |
| text primary / secondary / muted | `#0f172a` / `#475569` / `#94a3b8` |
| accent / hover / soft | `#4f46e5` / `#4338ca` / `#eef2ff` |
| border / strong | `#e2e8f0` / `#cbd5e1` |
| success / warning / danger | `#10b981` / `#f59e0b` / `#f43f5e` (with existing soft/text variants) |

- Font: Inter. Radius 6/10/16px. Light shadows only.
- Sentence-case labels and buttons (no ALL-CAPS). One button style set: primary, outline, ghost, danger.
- More whitespace: 24px page padding, 16px card padding. One card style and one table style.
- Status colours are always used the same way: Won = success, Leading = accent, Pending = muted,
  Trailing/Lost = secondary text.

## 6. Architecture

- Add `tailwindcss`, `@tailwindcss/vite`, `@radix-ui/react-{dialog,select,dropdown-menu,toggle-group}`,
  `clsx`, `tailwind-merge`, `lucide-react` to `admin/`.
- `admin/src/ui/`: shared primitives (Button, Input, Select, Table, Sheet, Badge, Card, EmptyState, Kbd).
- `admin/src/components/shell/`: TopBar, Sidebar, ElectionPicker (global), CommandSearch.
- `ElectionContext` holds the selected election (synced to `?election=` and localStorage). Existing
  hooks read it instead of keeping their own `selectedElection` state.
- Pages are rebuilt one at a time. `admin.css` stays loaded in a lower cascade layer until the last
  page is migrated, then it is deleted together with the inline `style={{}}` objects.
- Logic changes are limited to: auto-margin and the bulk save in `useLiveConsole`, the global election
  context, and merging the detail/edit routes.

## 7. Testing

- Vitest + Testing Library for: auto-margin calculation, Declare-won logic, the bulk-save payload,
  the unsaved-changes guard, and election context persistence.
- Keep the existing `SystemStatus.test.tsx` and `api-client.test.ts` passing.
- Manual check of each rebuilt page against its Stitch screen.

## 8. Stitch plan

New Stitch project **"MatdaanPulse Admin"**, with a design system created from the tokens in §5
(light mode, Inter, indigo accent, slate sidebar). Desktop (1440px) screens, generated one at a time,
each reviewed with the user before any edit:

1. **Live Console** — prompt: *"Admin console for entering live election results. Light theme, dark
   slate (#1e293b) left sidebar grouped Counting/Data/Admin with line icons; top bar with logo
   'MatdaanPulse Admin', election dropdown 'Bihar Vidhan Sabha 2025', search field (⌘K), user avatar.
   Main area split: left column 320px with search, filter chips with counts (All 243 · Pending 120 ·
   Leading 80 · Won 43) and a scrollable list of constituencies (number, name, party colour bar,
   status pill). Right panel: selected seat '#142 Patna Sahib · Leading', last saved time, table of
   candidates with party colour dot, editable votes input, status select, read-only auto-calculated
   margin row, buttons 'Save seat' (indigo #4f46e5) and 'Declare won' (emerald #10b981). Clean,
   spacious, sentence case, keyboard hints (↑↓ to move, Enter to save)."*
2. **Candidates list + side panel** — the same shell, page header "Candidates · 1,204", toolbar
   (search, State, Seat, Linked/Unlinked chips), table (name, party, seat, person-link status), and
   a right sheet open on one candidate with an editable form, person-link suggestions, Save/Cancel.
3. **Dashboard** — the same shell, 4 KPI tiles, an "Open Live Console" CTA card, recent activity,
   system health, new feedback.
4. **Login** — centred card on `#f8fafc`, logo, email/password, indigo button.

Stitch numbers are placeholders. Real data comes from the API.

## Out of scope

Mobile layouts, dark mode, changes to the public frontend. Backend work: seat locks plus returning rounds in live results (§3). No Prisma/SQL change.

## Delivery phases

1. **Phase 1:** Tailwind/Radix setup, the new shell + ElectionContext, and the Live Console with
   rounds and seat lock. Old pages keep working inside the new shell.
2. **Phase 2:** the table + side-panel pattern for Candidates, Parties, Persons, Constituencies,
   Elections, Manifests, plus ⌘K search (using the existing `/search` endpoints).
3. **Phase 3:** Dashboard, Login, the other admin pages, then removing `admin.css` and the inline styles.
