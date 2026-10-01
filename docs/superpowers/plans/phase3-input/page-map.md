# Phase 3 page map (Explore agent, 2026-10-01; read-only audit of current code after Phase 2)

Paths under admin/src unless noted. Backend under backend/src/modules.

## Cross-cutting
- Routes: `/` Dashboard (any authenticated role incl. VIEWER), `/feedback` (SUPER_ADMIN, EDITOR), `/users` `/logs` `/status` (SUPER_ADMIN), `/login` public outside Layout.
- main.tsx imports theme/tailwind.css then theme/legacy.css (= admin.css in layer legacy). Preflight is OFF; admin.css:115-125 holds the global `* {margin:0;padding:0;box-sizing:border-box}` and `body {font-family;background;color;line-height}` — deleting admin.css drops them (must move into tailwind.css base).
- `tw-ui` scoped reset must be on every new page root + Radix portal content. Layout itself has no tw-ui.
- tailwind.css @source must list every new page/dir (Dashboard, Login, Feedback, UserManager→Users, AuditLogs, SystemStatus, any new component dir).
- Layout BARE_PATHS: isBare = pathname===p || startsWith(p+'/'); `/` cannot be appended (matches everything) → Dashboard needs an exact-match case. Once every route is bare, drop `.admin-content`.
- useResourceList: localStorage `${key}_filters/_search` (keys feedback, users, audit_logs) restore silently; no debounce; loading true every reload.
- apiFetch: ApiError(status, code, fields); 401 (not /auth/login) → handleUnauthorized → clears token, location → /login. describeError builds messages (401 "Session expired…", network "Network error…").

## Dashboard (pages/Dashboard.tsx, hooks/useDashboardManager.ts)
- Today: getElections() (public GET /elections) + getUsers() (GET /admin/users, SUPER_ADMIN, .catch→[]). 4 stat cards (Total elections "N live, M upcoming"; Live now (names); Finalized; Admin users), Live control panel (live elections → buttons to /manifests, /overrides), Scheduled events (Upcoming + tentative date, View all → /elections). No polling; refresh stub. Error = bare text, no retry.
- Bugs: "Admin users" shows 0 for EDITOR/VIEWER (403 swallowed); buttons don't pass election; `--space-10` undefined; hook returns CSS var strings.
- Design target docs/design/admin/dashboard.png/.html + NOTES.md fixes: header "Dashboard — <election> · counting in progress"; KPI row (Seats declared N/M with progress; Leading "in N seats"; Pending "no votes yet"; Last update "N min ago · Round R"); Live console card (counting %, seats being edited now = GET /admin/live/locks SUPER_ADMIN/EDITOR, Open live console); Recent activity (GET /admin/audit-logs SUPER_ADMIN only; SEAT_LOCK_TAKEOVER events exist; no "verified" events; View audit log); System health (GET /admin/status SUPER_ADMIN or public /health/ready; badge "All OK"; Open system status); Feedback (GET /admin/feedback SUPER_ADMIN/EDITOR; "N new"; previews: kind badge bug rose / data_error amber / suggestion indigo / other slate, first line, page path monospace, relative time; no names). Cards top-aligned, View links pinned bottom. Remove "Real-time audit"/"Desk queries" labels. Role-gate each card (VIEWER sees only public data). Live counts: from admin live-results or public election /live endpoint.

## Login (pages/Login.tsx)
- useAuth().login(email,password) → POST /auth/login {email,password} → {access_token,user}; token in localStorage admin_token, user in admin_user; navigate('/').
- Backend: public, @AuthRateLimited (5/min/IP), LoginDto IsEmail + MinLength(8) password, InvalidCredentialsException.
- Form: email (required, autofocus), password (required); client guard "Email and password are required".
- Every error → "Invalid credentials. Please try again." (incl 429, 400, 5xx, network). Redesign: split on ApiError.status (401 → "Invalid email or password", 429 → "Too many attempts — wait a minute and try again", network → describeError). Banner only after a failed attempt.
- Gaps: no redirect if already signed in; no return-to path. Design docs/design/admin/login.png: centred 400px card on #f8fafc, /logo-mark.png, title "MatdaanPulse Admin", subtitle "Sign in to manage elections and live results", show/hide password, full-width indigo Sign in, footer "Admin access only · accounts are created by a super admin". Outside Layout → needs tw-ui + bg-page + @source.

## Feedback (pages/Feedback.tsx, services/feedback.service.ts)
- GET /admin/feedback?page&limit=50[&status] → PaginatedResponse; PATCH /admin/feedback/:id {status} (both SUPER_ADMIN, EDITOR).
- Columns: date (en-IN short), kind (bug/data_error/suggestion/other → labels), message (pre-wrap, wrap anywhere), email (mailto or -), page (PLAIN TEXT, never an href — user input), status, actions.
- Status chips All/New/Read/Resolved server-side (persisted feedback_filters). No search. Server paging 50. Actions per row: mark read/resolve/mark new (busyId per row), toast + refresh. Refresh button. Error banner, spinner, empty "No feedback found.".
- Pitfalls: row vanishes under filter after change (fine); page not clamped when last row leaves; long text wrapping; kind colours as dashboard.

## Users (pages/UserManager.tsx, hooks/useUserManager.ts)
- GET /admin/users (SUPER_ADMIN, take 200, created_at desc) plain array. Columns: name+email, role select, created date (en-IN medium), actions.
- Client search name/email (persisted users_search), no paging; 200 cap silent.
- Create: name (req), email (req), temporary password (req, min 8), role (default VIEWER; Viewer (Read only) / Editor (Can update results) / Super admin (Full access)) → POST /admin/users. Field errors via FieldError + toast (duplicate).
- Role change inline select → PATCH /admin/users/:id {role} immediately, no confirm; backend blocks demoting the last SUPER_ADMIN (403) → toast only; select doesn't show busy.
- Delete: hand-rolled dialog + a SECOND window.confirm (double confirm) → DELETE /admin/users/:id (204; last SUPER_ADMIN blocked 403). Self-delete not blocked client-side.
- Bugs: list error never rendered; no empty state; stale fieldErrors shared between create/role; role select unlabeled. Backend also supports editing name/email/password (UI doesn't).

## Audit logs (pages/AuditLogs.tsx, services/audit.service.ts)
- GET /admin/audit-logs?user_id&action&entity_type&from&to (SUPER_ADMIN, take 200 desc, include users{id,email,name,role}). No paging/total.
- Columns: timestamp, admin, action tag, entity type, entity id, PRE→POST delta (title tooltip JSON).
- Filters: action select, entity select, from/to dates, Clear all; persisted audit_logs_filters. Refresh; Download CSV (client-side from loaded rows, unescaped).
- BUGS: action options don't match backend — backend writes only RESULT_OVERRIDE (entity result), RESULT_BULK_OVERRIDE (entity election), SEAT_LOCK_TAKEOVER (entity constituency); options list fake actions and miss the real ones. Admin name never shows: page reads `log.user` but backend returns `users` (types/index.ts:84). `to` date exclusive (UTC midnight) — make `to` end-of-day; IST note. Error never rendered; table replaced by spinner on every reload; 200 cap silent; CSV unescaped.

## System status (pages/SystemStatus.tsx, hooks/useSystemStatus.ts, services/status.service.ts)
- GET /admin/status (SUPER_ADMIN, no-store) {generatedAt, process, http, cache, redis, live, db}. Cards: Uptime & version (formatUptime, version (gitSha), node, memory rss/heap); Traffic (total, last 5/60 min req/min + 5xx/min, 2xx/3xx, 4xx, 5xx red>0, 429, origin shield 403); Cache (hit rate pct or n/a, hits/misses, Redis fallbacks red>0); Redis (pub/sub ready/down red, publishes, publish errors red>0); Live (SSE connections, events published, overrides applied, overrides/min, last override or "none yet"); Database (SELECT 1 ms or failed red, pool limit or "default"); Slowest routes table (route, p95 ms, samples; empty "No traffic recorded yet."); footer "Since restart (<startedAt>). Auto-refreshes every 10 s while this tab is visible." en-IN numbers.
- Polling useSystemStatus(fetcher, 10_000): pause when hidden, refresh on visible; keeps last good status on error; loading true every poll (button flips to "REFRESHING").
- Tests pin pages/SystemStatus.test.tsx: export SystemStatusView {status,error,loading,onRefresh}; strings "2h 1m", "0.1.0 (abc123def456)", "75%", route, "842 ms", "down", "none yet", "4 ms", /Since restart/, "Origin shield 403", button "REFRESH" → onRefresh, role=alert error. Update tests if copy changes (sentence case: "Refresh").

## Shared legacy components
- AdminPageHeader: only the 4 legacy pages; replace with components/ui/PageHeader.
- FieldError (+test): only UserManager; replace with Field error prop; delete with test.
- Spinner: used by LiveConsole.tsx:10,65 and WatchlistEditor.tsx:88 (`spinner spinner-xs`) → rebuild with Tailwind (animate-spin) keeping props {size,label}.
- ErrorBoundary: App.tsx:40 (wraps router), ManifestPanel (9×), legacy pages; uses legacy vars → restyle with Tailwind, keep API, sentence case ("Something went wrong", "Reload").
- ToastContext: ToastProvider above Router (outside Layout/tw-ui); toast(msg,type), toastError(err,fallback); 4 s / 8 s with \n; no close, no aria-live; styled by admin.css .toast*. Keep API (15+ callers); re-render with Tailwind + tw-ui + role="status"/aria-live, manual close.

## admin.css survivors (must migrate before deleting admin.css)
- Global `*` reset + body rule; :root legacy variables still read by App.tsx:29 (--text-secondary), ErrorBoundary, Spinner, manifest editors (AllianceEditor, WatchlistEditor, MiscEditors use --border --space-* --bg-card --bg-secondary --bg-primary --radius-sm --text-muted --text-secondary --success --danger).
- .admin-content (Layout.tsx:21), .toast*, .spinner/@keyframes spin, .btn/.btn-sm/.btn-outline (AdminPageHeader only), .admin-table (WatchlistEditor.tsx:251), .form-input/.form-select and ~60 .mf-* selectors in components/manifest/{ManifestSection,SharedControls,AllianceEditor,TrackedEditor,WatchlistEditor,MiscEditors}.tsx.
- Dead (safe): card-elevated, admin-layout/sidebar/nav, admin-card, stat-*, badge*, page-header/title, filter-bar, dialog*, login-*, alert*, map-tab*, mf-summary*, mf-tab*, mf-json-*, lc-* (LiveConsole has none), etc. `fade-in`/`row-hover` undefined no-ops. `--font-mono` and `--space-10` undefined.
- Full admin.css removal therefore requires rebuilding the manifest editor internals (Phase 2 follow-up #2: legacy CSS + collapsible sections) with Tailwind.

## Open follow-ups (docs/design/admin/NOTES.md)
Phase 1: Save/Discard/Cancel dialog instead of window.confirm; Live pill offline state; "Last saved" from candidates' last_updated; Declare won confirm; Save seat disabled on clean seat; logout/HealthDot not guarded + logout leaves lock ≤120 s; lock clock-skew; extra acquire; small test gaps; backend Lua/forceSet/503 message; sidebar not responsive; bundle >500 kB.
Phase 2: Back button unguarded (needs data router); manifest editor legacy CSS + collapsibles; useResourceList no debounce; Candidates per-seat only; ⌘K 50-row cap.
