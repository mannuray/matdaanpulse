# Admin Redesign Phase 3 — Dashboard, Login, Admin pages, Legacy CSS removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Dashboard, Login, Feedback, Users, Audit logs, System status and the manifest editor internals with Tailwind + Radix, close the cheap Phase 1/2 follow-ups, then delete `admin.css` and turn Tailwind preflight on.

**Architecture:**
- The shared legacy primitives (Toast, Spinner, ErrorBoundary) are re-rendered with Tailwind first. Their APIs stay the same, so their 15+ callers don't change.
- Pure helpers go in `admin/src/utils/`:
  - time and IST formatting
  - audit-action wording
  - feedback kind metadata
  - dashboard summaries
  - CSV
- Pages and hooks consume those helpers. Dashboard, Feedback, Users and Audit logs then share one vocabulary, and each helper has its own unit test.
- Feedback, Users and Audit logs use the Phase 2 entity pattern: `EntityPage` + `DataTable` + a right-hand `Sheet` at `/x/:id` via `useEntityRoute`.
  - None of these APIs has a GET-by-id endpoint, so a panel resolves its record from the loaded list.
  - "List failed" and "id not in the list" are two different states.
- Dashboard is a set of independent cards. Each card has its own loader, gated by role, with its own loading, error and empty state. They refresh every 30 s while the tab is visible.
- The last code task deletes `admin.css` and `legacy.css`, moves the two global rules into `tailwind.css`, imports Tailwind preflight, strips `tw-ui`, and verifies the result by grep, a source-scan test and a browser pass.

**Tech Stack:** React 18, React Router 6 (`BrowserRouter`), Vite 5, Tailwind CSS v4 (utilities, preflight on from Task 13), Radix (`dialog`, `dropdown-menu`, `select`), `lucide-react`, `clsx` + `tailwind-merge`, Vitest + Testing Library (`fireEvent`, no user-event). No new npm dependencies. No backend change.

**Spec:** `docs/superpowers/specs/2026-10-01-admin-redesign-design.md` (§2 Dashboard, §5 Visual rules, §6 Architecture, Delivery phases → Phase 3).
- Binding controller decisions: `docs/superpowers/plans/phase3-input/decisions.md`.
- Behaviour inventory that must not be lost: `docs/superpowers/plans/phase3-input/page-map.md`.
- Phase 2 rulings applied up front: `docs/superpowers/plans/2026-10-01-admin-redesign-phase2-rulings.md`.
- Reference screens: `docs/design/admin/dashboard.png` + `.html`, `docs/design/admin/login.png` + `.html`, and the fix lists in `docs/design/admin/NOTES.md`.

## Global Constraints

**Copied from Phase 2, unchanged** (Phase 3 overrides follow; where a line below is overridden, the override names the task in which it flips):

**Copied from Phase 1, unchanged:**
- Colours exactly: sidebar `#1e293b`, page `#f8fafc`, subtle `#f1f5f9`, card `#ffffff`, ink `#0f172a` / `#475569` / `#94a3b8`, accent `#4f46e5` / hover `#4338ca` / soft `#eef2ff`, border `#e2e8f0` / strong `#cbd5e1`, success `#10b981` (soft `#ecfdf5`, text `#065f46`), warning `#f59e0b` (soft `#fffbeb`, text `#92400e`), danger `#f43f5e` (soft `#fff1f2`, text `#9f1239`).
- Font Inter. Radius 6px for controls, 10px for cards, 16px for panels. Light shadows only.
- Sentence case for every label, heading and button. No ALL CAPS, no `uppercase` class.
- No accordions or click-to-expand for core info.
- Tailwind preflight stays **off** (legacy pages depend on browser defaults + `admin.css`).
- Status colours: Won = success, Leading = accent, Pending = muted, Trailing/Lost = secondary text.
- No Prisma schema or SQL migration change in this phase.

**New in Phase 2:**
- **Side panel:**
  - Radix Dialog with `modal={false}`, rendered in place (no portal) as the right column of the page body.
  - Width **400px** (`w-[400px]`). decisions.md overrides the spec's "~440px".
  - Manifests use the full-width variant (`width="full"`, which covers the page body).
  - No overlay. The table stays visible and scrollable.
  - An outside click never closes the panel. Esc and the close button close it through the unsaved guard.
- **URLs:**
  - list `/x`, record `/x/:id`, create `/x/new`
  - `/x/:id/edit` redirects to `/x/:id`
  - opening and closing a record keep the current query string (`?election=` and so on)
  - routes are mounted as `x/*` so the page stays mounted while records change
- **Unsaved guard:**
  - Every panel calls `useUnsavedGuard(dirty)`.
  - The prompt is exactly `Discard unsaved changes?`. It applies to row switch, close, Esc, sidebar (including the current section's own link), election picker, ⌘K, and tab close (`beforeunload`).
  - The browser Back button is not guarded, because `BrowserRouter` has no `useBlocker`. This is an accepted, documented gap.
  - Every panel is keyed by record id (`<XPanel key={id} …/>`), so a late response for an earlier row can never fill a newer row.
- **`tw-ui`:**
  - The scoped control reset goes on the entity page's header and list column (via `EntityPage`), on every `Sheet` (unless `legacyBody`), and on every Radix portal content.
  - It must never wrap legacy `.btn` / `.form-input` markup (the manifest editor body): `.tw-ui button` sits in `@layer base`, above `legacy`, and would strip legacy button styling.
- **`@source`:** add a line to `admin/src/theme/tailwind.css` for every new directory or file outside an already-listed path that uses Tailwind classes.
- **Roles:**
  - Every entity route stays `SUPER_ADMIN`, `EDITOR`.
  - Finalize (Elections), Merge duplicates (Persons) and Publish (Manifests) are `SUPER_ADMIN` only and are not rendered for `EDITOR`.
- **Election:**
  - Candidates and Constituencies read the global election from `useElection()`. No per-page election picker, no `AdminLandingCard`, no `admin_cand_election` / `admin_cand_const` / `admin_const_election` keys.
  - With no election, the page shows one empty state linking to `/elections/new`.
  - A record from another election shows a "Switch election" notice.
- **Manifest editor internals:** `admin/src/components/manifest/*` keep their legacy CSS and their collapsible `ManifestSection`, a minimal restyle per decisions.md (a full rebuild is Phase 3). The panel's default **Summary** tab is the uncollapsed overview.
- **Legacy CSS:** `admin.css` is not edited in this phase. Removing unused rules is deferred to Phase 3, where the whole file goes.
- **Copy:**
  - Panel buttons: "Save changes", "Cancel", "Close panel" (aria-label).
  - Create buttons: "New party", "New election".
  - Empty states use plain sentences.
  - Counts use `toLocaleString('en-IN')`.
- **Verification commands:**
  - admin: `cd admin && npm test && npm run build`. The build runs `tsc` over `src/**` including tests, with `noUnusedLocals`.
  - The backend is not touched.

**Phase 3 overrides and additions** (these win over the copied lines above):
- **Preflight:** stays off in Tasks 1–12. **Task 13 turns it on.** It imports `tailwindcss/preflight.css` into the `base` layer, deletes `admin.css` and `legacy.css`, and deletes the `tw-ui` reset. No other task touches `main.tsx`, `legacy.css` or the `@layer` order.
- **`tw-ui` until Task 13:** add `tw-ui` to every new page root, every new Sheet (all of them, since `Sheet` adds it itself) and every new portal content (Toast container). After Task 12 nothing legacy is left inside a `tw-ui` tree. Task 13 removes every `tw-ui` token.
- **Manifest editor internals:** Tasks 11–12 rebuild `components/manifest/*` with Tailwind + `components/ui` primitives. This overrides "keep their legacy CSS and their collapsible `ManifestSection`".
  - `ManifestSection` becomes a plain, always-open `<section>`. There is no toggle, `aria-expanded` or `defaultOpen` behaviour (decisions §8, "user dislikes click-to-expand").
  - `Sheet` loses `legacyBody` in Task 12.
- **Legacy CSS:** Task 13 deletes `admin.css` (overrides "`admin.css` is not edited").
  - Before Task 13 no task edits `admin.css`.
  - New code never uses a legacy class (`btn*`, `form-*`, `spinner*`, `admin-*`, `mf-*`, `card-*`, `stat-*`, `badge*`, `alert*`, `dialog*`, `login-*`, `toast*`, `page-header`, `page-title`, `fade-in`, `row-hover`, `striped`) or a legacy variable (`var(--…)` other than `var(--color-*)`).
- **Pages rebuilt in this phase:** Dashboard, Login, Feedback, Users, Audit logs, System status. Each page task appends its path to `BARE_PATHS` until Task 13 deletes `BARE_PATHS` and `.admin-content`.
  - Every page root that scrolls carries `h-full overflow-y-auto`, because `<main>` is `overflow-hidden` once bare.
  - Dashboard is `/`. With `isBare`'s `pathname === p || pathname.startsWith(p + '/')`, appending `'/'` matches only the bare path, since `'/' + '/'` is `'//'`. Task 6 pins this with a test.
- **Routes:** `feedback/*`, `users/*` and `logs/*` replace the bare `feedback`, `users` and `logs` routes (records at `/x/:id`). `status` stays a plain route.
- **Roles (enforced as today):**
  - `/feedback` is `SUPER_ADMIN`, `EDITOR`. `/users`, `/logs` and `/status` are `SUPER_ADMIN`.
  - Dashboard is any signed-in role, with the cards gated as follows:
    - **`SUPER_ADMIN`:** all cards (KPIs, Live console, Recent activity, System health from `/admin/status`, Feedback).
    - **`EDITOR`:** KPIs, Live console, System health (public `/health/ready`) and Feedback. No Recent activity.
    - **`VIEWER`:** the elections overview only. It never calls an admin endpoint.
  - A card the role cannot see is not rendered and its endpoint is never called. A 403 never becomes a number.
- **Panels (Phase 2 rulings applied up front):**
  - Every panel is keyed by record id and calls `useUnsavedGuard(dirty)` when it has a form.
  - The saved snapshot is the **submitted** form (`setSaved(submitted)`), so edits typed while a save is in flight stay dirty.
  - Load failures:
    - A list load failure shows "Could not load …" with a **Try again** button.
    - An id missing from a loaded list shows "… not found".
  - Numbers and emails are validated client-side before any request.
  - Emptied optional fields are sent as `null`. The exception is the user password: an empty "Set new password" is **omitted**, never `null`.
  - Dirty state goes through `useUnsavedGuard` → `ShellStatusContext.markDirty`, never a shared boolean.
  - Edits to shared files are additive: new optional props, no renamed exports.
- **Field errors vs toasts:**
  - When a save fails with field errors (400 `fields`, or 409 mapped to a field), the errors show under the fields and **no toast** is raised.
  - Any other failure raises one `toastError`.
- **Time:**
  - Audit timestamps and the audit date filters are **IST** (`Asia/Kolkata`) and labelled "(IST)".
  - `from` is sent as `YYYY-MM-DDT00:00:00.000+05:30` and `to` as `YYYY-MM-DDT23:59:59.999+05:30` (inclusive).
  - Other dates use `toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', … })` so tests are stable on a UTC CI machine.
- **Copy (Phase 3):**
  - Buttons: "Sign in", "Refresh", "Refreshing…", "Mark read", "Resolve", "Mark new", "New user", "Create user", "Delete user", "Download CSV", "Clear filters", "Try again", "Reload", "Open live console", "View audit log", "Open system status", "View all feedback".
  - Login errors, exactly:
    - "Invalid email or password"
    - "Too many attempts — wait a minute and try again"
  - ErrorBoundary: "Something went wrong" / "Reload".
- **Verification commands:** admin `cd admin && npm test && npm run build` in every task. The backend is not touched.

## Review Focus

1. **Role-gated Dashboard cards for EDITOR and VIEWER.**
   - An EDITOR's Dashboard must never request `/admin/audit-logs` or `/admin/status`, and must not render Recent activity.
   - A VIEWER's Dashboard must request no admin endpoint at all (no live-results, locks, feedback, users) and shows the elections overview with correct Live / Upcoming / Finalized counts.
   - No card ever shows `0` because a 403 was swallowed.
   - Pinned in **Task 6** with a role-matrix test that asserts which service functions were called for each role.
2. **Deleting or demoting yourself, and the last super admin.**
   - On your own row, Delete and the role field are disabled, each with a hint.
   - Deleting asks exactly once, with a ConfirmDialog; `window.confirm` is never called.
   - The backend's 403 for the last SUPER_ADMIN shows inline in the panel, the user stays in the list, and no success toast appears.
   - An empty "Set new password" is not sent.
   - Pinned in **Task 8**.
3. **Audit date range inclusivity and IST.**
   - Picking From = To = 2026-10-01 must return entries from 00:00 to 23:59:59.999 IST on that day, not UTC midnight to UTC midnight.
   - From after To shows a message and sends no request.
   - A stale persisted action filter (`MANIFEST_PUBLISH` from the old page) is reset to "Any" instead of silently returning nothing.
   - Pinned in **Task 5** (`istDayStart` / `istDayEnd`) and **Task 9** (service query and page).
4. **Login error cases.**
   - 401 and 400 (the backend's `MinLength(8)` on a short password) both show "Invalid email or password".
   - 429 shows "Too many attempts — wait a minute and try again".
   - A network failure shows "Network error — check your connection".
   - No banner shows before the first attempt.
   - An already signed-in user visiting `/login` is redirected.
   - After sign-in the user returns to the page they asked for, but never to `/login` or a protocol-relative `//host` path.
   - Pinned in **Task 4**.
5. **Preflight regressions on existing pages.**
   - After Task 13, no file may still use a legacy class or a legacy `var(--…)`, and every file with `className` must sit under an `@source` path (otherwise its classes silently vanish).
   - Phase 1/2 pages must look unchanged at 1440×900.
   - Pinned in **Task 13** by a source-scan test (`src/theme/legacy-free.test.ts`) plus the grep step and the per-route browser check.

## File map

**Shared primitives and helpers (Tasks 1–5)**
- Modify:
  - `admin/src/context/ToastContext.tsx` (Tailwind portal, roles, close button)
  - `admin/src/components/atoms/Spinner.tsx`
  - `admin/src/components/atoms/ErrorBoundary.tsx`
- Create: `admin/src/context/ToastContext.test.tsx`, `admin/src/components/atoms/atoms.test.tsx`
- Create `admin/src/hooks/useDebouncedValue.ts` (+ `.test.ts`). Modify `admin/src/hooks/useResourceList.ts` (debounce, stale guard, page clamp, `sanitizeFilters`) and `useResourceList.test.ts`.
- Modify:
  - `admin/src/services/election.service.ts` (`offline` status)
  - `admin/src/context/ShellStatusContext.tsx` (`LiveStreamState` gains `'offline'`)
  - `admin/src/components/shell/{TopBar,HealthDot}.tsx` (offline pill, guarded logout and health link)
  - `admin/src/components/live/SeatEditor.tsx` (Declare won confirm, Save seat disabled when clean)
  - tests `services/live-sse.test.ts`, `components/shell/shell.test.tsx`, `pages/LiveConsole.test.tsx`
- Create:
  - `admin/src/components/routing/ProtectedRoute.tsx` (+ `routing.test.tsx`)
  - `admin/src/components/ui/PasswordInput.tsx`
  - `admin/src/pages/Login.test.tsx`
- Rewrite `admin/src/pages/Login.tsx` and `admin/src/App.tsx`.
- Create:
  - `admin/src/utils/time.ts` (+ `.test.ts`)
  - `admin/src/utils/audit.ts` (+ `.test.ts`)
  - `admin/src/utils/feedback.ts` (+ `.test.ts`)
  - `admin/src/utils/dashboard.ts` (+ `.test.ts`)
  - `admin/src/services/health.service.ts` (+ `.test.ts`)
  - `admin/src/components/feedback/FeedbackKindBadge.tsx`
- Modify:
  - `admin/src/types/index.ts` (`AuditLog.users`, `user_id: string | null`)
  - `admin/src/utils/seat-math.ts` (`countSeats`, `reportingPercent`, `isLockLapsed`, `SEAT_LOCK_TTL_MS`)
  - `admin/src/hooks/useLiveConsole.ts` (uses it)
  - `admin/src/pages/AuditLogs.tsx` (compile fix only)

**Pages (Tasks 6–10)**, each one adding its route to `admin/src/App.tsx`, its path to `BARE_PATHS` and its `@source` line:
- **Dashboard:**
  - create `hooks/useVisiblePoll.ts` (+ test), `hooks/useDashboard.ts`, `pages/Dashboard.test.tsx` and `components/Layout.test.tsx`
  - rewrite `pages/Dashboard.tsx`
  - export `isBare` from `components/Layout.tsx`
  - delete `hooks/useDashboardManager.ts`
- **Feedback:**
  - create `components/entity/feedback/FeedbackPanel.tsx` and `pages/Feedback.test.tsx`
  - rewrite `pages/Feedback.tsx`
- **Users:**
  - create `pages/Users.tsx` (+ test), `components/entity/users/{UserPanel,UserCreatePanel}.tsx`
  - rewrite `hooks/useUserManager.ts` (+ test)
  - modify `services/user.service.ts` (`UpdateUserData`)
  - delete `pages/UserManager.tsx`
- **Audit logs:**
  - create `components/entity/audit/AuditPanel.tsx`, `utils/csv.ts` (+ test), `pages/AuditLogs.test.tsx` and `services/audit.service.test.ts`
  - rewrite `pages/AuditLogs.tsx`
  - modify `services/audit.service.ts`
- **System status:** rewrite `pages/SystemStatus.tsx`; modify `pages/SystemStatus.test.tsx`.

**Manifest editor (Tasks 11–12):**
- Rewrite `admin/src/components/manifest/{ManifestSection,SharedControls,AllianceEditor,TrackedEditor,WatchlistEditor,MiscEditors}.tsx`.
- Create `admin/src/components/manifest/manifest.test.tsx`.
- Modify:
  - `admin/src/components/entity/manifests/ManifestPanel.tsx`
  - `admin/src/components/ui/Sheet.tsx` (drop `legacyBody`)
  - `admin/src/theme/tailwind.css` (`@source "../components/manifest"`)
  - tests `components/ui/Sheet.test.tsx`, `pages/Manifests.test.tsx`

**Removal (Task 13):**
- Delete:
  - `admin/src/theme/admin.css`, `admin/src/theme/legacy.css`
  - `admin/src/components/common/AdminPageHeader.tsx`
  - `admin/src/components/common/FieldError.tsx` (+ `.test.tsx`)
  - `admin/src/components/Layout.test.tsx`
- Modify:
  - `admin/src/main.tsx`, `admin/src/theme/tailwind.css`, `admin/src/components/Layout.tsx`
  - `admin/src/components/entity/EntityPage.tsx` (+ `entity.test.tsx`)
  - every file carrying `tw-ui`
- Create `admin/src/theme/legacy-free.test.ts`.

**Docs (Task 14):** `docs/FEATURES.md`, `CLAUDE.md`, `docs/design/admin/NOTES.md`.

---
### Task 1: Shared primitives — Toast, Spinner, ErrorBoundary in Tailwind

decisions §1. The APIs are unchanged:
- `useToast().toast(message, type?)` and `toastError(err, fallback)`, with the same 4 s / 8 s timing (8 s when the message has a `\n`)
- `<Spinner size? label? />`
- `<ErrorBoundary>`

The toasts render in a portal on `document.body`. Success and info toasts use `role="status"` with `aria-live="polite"`; errors use `role="alert"`. Each toast has a manual close button. `ErrorBoundary` gains one optional prop, `onReload` (a test seam). jsdom cannot spy on `location.reload`.

**Files:**
- Modify: `admin/src/context/ToastContext.tsx`, `admin/src/components/atoms/Spinner.tsx`, `admin/src/components/atoms/ErrorBoundary.tsx`, `admin/src/theme/tailwind.css` (two `@source` lines)
- Test: `admin/src/context/ToastContext.test.tsx`, `admin/src/components/atoms/atoms.test.tsx`

**Interfaces:**
- Consumes: `Button` (`components/ui/Button`), `cn` (`components/ui/cn`), `describeError` (`utils/api-error`).
- Produces:
  - `ToastProvider` and `useToast()`, unchanged: `{ toast(message: string, type?: 'success' | 'error' | 'info'): void; toastError(err: unknown, fallback: string): void }`.
  - New export `toastDuration(message: string): number`, which returns 4000, or 8000 when the message contains `\n`.
  - Spinner: `export default function Spinner({ size = 32, label }: { size?: number; label?: string })`. It renders `role="status"`, named by `label`, or "Loading" when there is no label.
  - ErrorBoundary: `export default class ErrorBoundary` with props `{ children: ReactNode; onReload?: () => void }`.

- [ ] **Step 1: Write the failing toast test** `admin/src/context/ToastContext.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ToastProvider, toastDuration, useToast } from './ToastContext';
import { ApiError } from '../services/api-client';

function Probe() {
  const { toast, toastError } = useToast();
  return (
    <>
      <button type="button" onClick={() => toast('Seat saved')}>ok</button>
      <button type="button" onClick={() => toast('Heads up', 'info')}>info</button>
      <button type="button" onClick={() => toastError(new ApiError('Name is taken', 409), 'Update failed')}>err</button>
      <button type="button" onClick={() => toast('Line one\nLine two', 'error')}>multi</button>
    </>
  );
}

const renderProbe = () => render(<ToastProvider><Probe /></ToastProvider>);

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('ToastProvider', () => {
  it('a success toast is a polite status message that leaves after 4 s', () => {
    renderProbe();
    fireEvent.click(screen.getByText('ok'));
    const status = screen.getByRole('status');
    expect(status.textContent).toContain('Seat saved');
    expect(status.getAttribute('aria-live')).toBe('polite');
    act(() => { vi.advanceTimersByTime(3999); });
    expect(screen.queryByText('Seat saved')).not.toBeNull();
    act(() => { vi.advanceTimersByTime(1); });
    expect(screen.queryByText('Seat saved')).toBeNull();
  });

  it('info is a status too', () => {
    renderProbe();
    fireEvent.click(screen.getByText('info'));
    expect(screen.getByRole('status').textContent).toContain('Heads up');
  });

  it('toastError is an alert built by describeError; multi-line messages stay 8 s', () => {
    renderProbe();
    fireEvent.click(screen.getByText('err'));
    expect(screen.getByRole('alert').textContent).toContain('Update failed: Name is taken');
    fireEvent.click(screen.getByText('multi'));
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByText(/Update failed/)).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Line one');
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('the close button dismisses a toast at once', () => {
    renderProbe();
    fireEvent.click(screen.getByText('ok'));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Seat saved')).toBeNull();
  });

  it('renders in a portal on document.body, outside the app tree', () => {
    const { container } = renderProbe();
    fireEvent.click(screen.getByText('ok'));
    expect(container.contains(screen.getByRole('status'))).toBe(false);
    expect(document.body.contains(screen.getByRole('status'))).toBe(true);
  });

  it('toastDuration: 4 s, or 8 s for a multi-line message', () => {
    expect(toastDuration('Saved')).toBe(4000);
    expect(toastDuration('Failed\n• name: required')).toBe(8000);
  });
});
```

- [ ] **Step 2: Write the failing atoms test** `admin/src/components/atoms/atoms.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Spinner from './Spinner';
import ErrorBoundary from './ErrorBoundary';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Boom(): never {
  throw new Error('Seat data mismatch');
}

describe('Spinner', () => {
  it('spins with Tailwind and is announced by its label', () => {
    render(<Spinner label="Loading seats…" />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Loading seats…');
    expect(status.querySelector('.animate-spin')).not.toBeNull();
    expect(status.querySelector('.spinner')).toBeNull();
  });

  it('without a label it is named "Loading" and sized by `size`', () => {
    render(<Spinner size={12} />);
    const ring = screen.getByRole('status', { name: 'Loading' }).querySelector('.animate-spin') as HTMLElement;
    expect(ring.style.width).toBe('12px');
    expect(ring.style.height).toBe('12px');
  });
});

describe('ErrorBoundary', () => {
  it('renders its children when nothing throws', () => {
    render(<ErrorBoundary><p>Fine</p></ErrorBoundary>);
    expect(screen.getByText('Fine')).toBeTruthy();
  });

  it('shows a sentence-case card with the error message and a Reload button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onReload = vi.fn();
    render(<ErrorBoundary onReload={onReload}><Boom /></ErrorBoundary>);
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeTruthy();
    expect(screen.getByText('Seat data mismatch')).toBeTruthy();
    expect(screen.queryByText(/Interface Error|RELOAD INTERFACE/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Run both to confirm they fail**

Run: `cd admin && npx vitest run src/context/ToastContext.test.tsx src/components/atoms/atoms.test.tsx`
Expected: FAIL:
- ToastContext: "toastDuration is not a function". The role queries also fail, because the legacy markup has no `role="status"`.
- atoms: "Unable to find role="status"" for Spinner, and "Unable to find role="heading"" for ErrorBoundary (the legacy card says "Interface Error").

- [ ] **Step 4: Rewrite `admin/src/context/ToastContext.tsx`**

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import { describeError } from '../utils/api-error';
import { cn } from '../components/ui/cn';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
  /** Error toast built from a caught error; lists backend field errors. */
  toastError: (err: unknown, fallback: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/** How long a toast stays: multi-line messages (field-error lists) get longer to be read. */
export const toastDuration = (message: string) => (message.includes('\n') ? 8000 : 4000);

const LOOK: Record<ToastType, { box: string; Icon: LucideIcon }> = {
  success: { box: 'border-ok/30 bg-ok-soft text-ok-text', Icon: CheckCircle2 },
  error: { box: 'border-bad/30 bg-bad-soft text-bad-text', Icon: XCircle },
  info: { box: 'border-accent/30 bg-accent-soft text-accent', Icon: Info },
};

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++nextId;
    setToasts((prev) => [...prev, { id, message, type }]);
    timers.current.set(id, setTimeout(() => dismiss(id), toastDuration(message)));
  }, [dismiss]);

  const toastError = useCallback((err: unknown, fallback: string) => toast(describeError(err, fallback), 'error'), [toast]);

  useEffect(() => {
    const pending = timers.current;
    return () => { pending.forEach(clearTimeout); pending.clear(); };
  }, []);

  const value = useMemo(() => ({ toast, toastError }), [toast, toastError]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="tw-ui pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2 font-sans">
          {toasts.map((t) => {
            const { box, Icon } = LOOK[t.type];
            const isError = t.type === 'error';
            return (
              <div
                key={t.id}
                role={isError ? 'alert' : 'status'}
                aria-live={isError ? 'assertive' : 'polite'}
                className={cn('pointer-events-auto flex items-start gap-2.5 rounded-card border px-3.5 py-3 text-sm shadow-md', box)}
              >
                <Icon size={16} aria-hidden className="mt-0.5 shrink-0" />
                <p className="min-w-0 flex-1 whitespace-pre-line break-words">{t.message}</p>
                <button
                  type="button"
                  aria-label="Dismiss notification"
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 rounded-control p-0.5 opacity-70 hover:opacity-100"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}
```

- [ ] **Step 5: Rewrite `admin/src/components/atoms/Spinner.tsx`**

```tsx
/** Loading indicator: a spinning ring, with `label` underneath (also its accessible name; "Loading" without one). */
export default function Spinner({ size = 32, label }: { size?: number; label?: string }) {
  const ring = Math.max(2, Math.round(size / 10));
  return (
    <div role="status" aria-label={label ? undefined : 'Loading'} className="flex flex-col items-center justify-center gap-3">
      <span
        aria-hidden
        className="animate-spin rounded-full border-solid border-line-strong border-t-accent"
        style={{ width: size, height: size, borderWidth: ring }}
      />
      {label && <span className="text-sm font-medium text-ink-2">{label}</span>}
    </div>
  );
}
```

- [ ] **Step 6: Rewrite `admin/src/components/atoms/ErrorBoundary.tsx`**

```tsx
import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/Button';

interface Props {
  children: ReactNode;
  /** What Reload does; defaults to reloading the page (a seam for tests — jsdom cannot reload). */
  onReload?: () => void;
}
interface State { hasError: boolean; error: Error | null }

/** Isolates a UI failure to the subtree it wraps, with a Reload button. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  private reload = () => {
    if (this.props.onReload) this.props.onReload();
    else window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="tw-ui flex h-full items-center justify-center bg-page p-10 font-sans">
        <div role="alert" className="max-w-sm rounded-panel border border-line bg-card p-8 text-center shadow-sm">
          <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-bad-soft text-bad-text">
            <AlertTriangle size={18} aria-hidden />
          </span>
          <h2 className="text-base font-semibold text-ink">Something went wrong</h2>
          <p className="mt-2 text-sm text-ink-2">{this.state.error?.message || 'This part of the page stopped working.'}</p>
          <Button variant="primary" className="mt-6" onClick={this.reload}>Reload</Button>
        </div>
      </div>
    );
  }
}
```

- [ ] **Step 7: Let Tailwind scan the two locations.** In `admin/src/theme/tailwind.css`, add these lines directly after `@source "../components/entity";`:

```css
@source "../components/atoms";
@source "../context/ToastContext.tsx";
```

- [ ] **Step 8: Run the new tests**

Run: `cd admin && npx vitest run src/context/ToastContext.test.tsx src/components/atoms/atoms.test.tsx`
Expected: PASS (10 tests: 6 toast, 4 atoms).

- [ ] **Step 9: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all test files pass, about 285 tests (the 275 before plus these 10). `tsc` and `vite build` finish without errors. The existing toast-text assertions in Phase 2 page tests, such as `findByText('Party profile updated')`, still find the text, because the portal renders into `document.body`.

- [ ] **Step 10: Commit**

```bash
git add admin/src/context/ToastContext.tsx admin/src/context/ToastContext.test.tsx admin/src/components/atoms admin/src/theme/tailwind.css
git commit -m "admin: Tailwind toasts (portal, live roles, close), spinner and error boundary

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `useResourceList` — debounced search, stale-response guard, page clamp, filter sanitising

This task covers decisions §9 (debounce of 300 ms plus a stale-response guard) and the Feedback page's need to clamp the page (§4). It also repairs filters restored from localStorage: the old Audit page stored fake action names. The Feedback, Users and Audit tasks depend on this final behaviour.

Rules:
- `search`, the input value, updates at once, and so does the reset to page 1.
- Only the request waits for the search to settle: it uses the debounced value.
- The first load is not delayed, and `loading` starts `true`. A panel deep-linked to a record says "Loading…" until the list arrives, instead of flashing "not found".
- A response that is no longer the latest request is dropped.
- When a page comes back empty and it is not page 1, the hook moves to the new last page.

**Files:**
- Create: `admin/src/hooks/useDebouncedValue.ts`
- Modify: `admin/src/hooks/useResourceList.ts`
- Test: `admin/src/hooks/useDebouncedValue.test.ts`, `admin/src/hooks/useResourceList.test.ts` (append)

**Interfaces:**
- Produces:
  - `useDebouncedValue<T>(value: T, ms?: number): T` (default 300 ms). The first value is returned at once.
  - `SEARCH_DEBOUNCE_MS = 300`, exported from `useResourceList.ts`.
  - `useResourceList<F>({ key, pageSize?, initialFilters, initialSearch?, sanitizeFilters?, onLoad })`.
    - New optional option: `sanitizeFilters?: (restored: F) => F`, run once on the filters restored from `${key}_filters`. Restored filters are merged over `initialFilters`.
    - Return value unchanged: `{ items, total, page, setPage, error, totalPages, loading, search, filters, handleSearch, updateFilters, loadPage, navigateWithScroll, refresh }`. `search` is the immediate input value. `refresh()` reloads with the debounced search.

- [ ] **Step 1: Write the failing debounce test** `admin/src/hooks/useDebouncedValue.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  it('returns the first value at once and later values after they settle', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
    expect(result.current).toBe('a');
    rerender({ v: 'ab' });
    act(() => { vi.advanceTimersByTime(200); });
    rerender({ v: 'abc' });
    act(() => { vi.advanceTimersByTime(299); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe('abc');
  });

  it('going back to the current value cancels the pending change', () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), { initialProps: { v: 'a' } });
    rerender({ v: 'b' });
    rerender({ v: 'a' });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current).toBe('a');
  });
});
```

- [ ] **Step 2: Append the failing list tests** to `admin/src/hooks/useResourceList.test.ts`. Inside the existing `describe('useResourceList', …)` block, after the last `it(…)`, add:

```ts
  it('debounces the search request; the input value and page reset are immediate', async () => {
    vi.useFakeTimers();
    try {
      const onLoad = vi.fn(async (_p: number, _s: string, _f: object) => ({ data: [] as unknown[], total: 0 }));
      const { result } = renderHook(() => useResourceList({ key: 'd1', initialFilters: {}, onLoad }));
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(onLoad).toHaveBeenCalledTimes(1);
      expect(onLoad).toHaveBeenLastCalledWith(1, '', {});
      act(() => result.current.handleSearch('p'));
      act(() => result.current.handleSearch('pa'));
      act(() => result.current.handleSearch('pat'));
      expect(result.current.search).toBe('pat');
      await act(async () => { await vi.advanceTimersByTimeAsync(299); });
      expect(onLoad).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(onLoad).toHaveBeenCalledTimes(2);
      expect(onLoad).toHaveBeenLastCalledWith(1, 'pat', {});
      expect(onLoad.mock.calls.some(([, s]) => s === 'p' || s === 'pa')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a slower response from an older request', async () => {
    let releaseFirst!: (v: { data: unknown[]; total: number }) => void;
    const onLoad = vi.fn((_p: number, s: string, _f: object) => (s === ''
      ? new Promise<{ data: unknown[]; total: number }>((r) => { releaseFirst = r; })
      : Promise.resolve({ data: [{ id: 'new' }] as unknown[], total: 1 })));
    const { result } = renderHook(() => useResourceList({ key: 's1', initialFilters: {}, onLoad }));
    act(() => result.current.handleSearch('x'));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'new' }]));
    await act(async () => { releaseFirst({ data: [{ id: 'old' }], total: 1 }); });
    expect(result.current.items).toEqual([{ id: 'new' }]);
    expect(result.current.loading).toBe(false);
  });

  it('steps back to the last page when the current page comes back empty', async () => {
    const onLoad = vi.fn(async (p: number) => (p === 1 ? { data: [{ id: 'a' }] as unknown[], total: 1 } : { data: [] as unknown[], total: 1 }));
    const { result } = renderHook(() => useResourceList({ key: 'c1', pageSize: 50, initialFilters: {}, onLoad }));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'a' }]));
    act(() => result.current.loadPage(2));
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(2, '', {}));
    await waitFor(() => expect(result.current.page).toBe(1));
    expect(result.current.items).toEqual([{ id: 'a' }]);
  });

  it('sanitizeFilters repairs filters restored from storage (merged over the defaults)', async () => {
    localStorage.setItem('f1_filters', JSON.stringify({ action: 'MANIFEST_PUBLISH' }));
    const onLoad = vi.fn(async (_p: number, _s: string, _f: { action: string; to: string }) => ({ data: [] as unknown[], total: 0 }));
    const { result } = renderHook(() => useResourceList({
      key: 'f1',
      initialFilters: { action: '', to: '' },
      sanitizeFilters: (f) => ({ ...f, action: f.action === 'RESULT_OVERRIDE' ? f.action : '' }),
      onLoad,
    }));
    expect(result.current.filters).toEqual({ action: '', to: '' });
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(1, '', { action: '', to: '' }));
  });

  it('starts in the loading state (the first request is already on its way)', () => {
    const onLoad = vi.fn(() => new Promise<{ data: unknown[]; total: number }>(() => {}));
    const { result } = renderHook(() => useResourceList({ key: 'l1', initialFilters: {}, onLoad }));
    expect(result.current.loading).toBe(true);
  });

  it('a corrupt stored filter falls back to the defaults', () => {
    localStorage.setItem('f2_filters', '{not json');
    const onLoad = vi.fn(async () => ({ data: [] as unknown[], total: 0 }));
    const { result } = renderHook(() => useResourceList({ key: 'f2', initialFilters: { status: '' }, onLoad }));
    expect(result.current.filters).toEqual({ status: '' });
  });
```

- [ ] **Step 3: Run them to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/useDebouncedValue.test.ts src/hooks/useResourceList.test.ts`
Expected: FAIL:
- `useDebouncedValue.test.ts`: "Failed to resolve import './useDebouncedValue'".
- In `useResourceList.test.ts`:
  - the debounce test fails with `expected "spy" to be called 1 times, but got 2 times`;
  - the stale test fails with `[{ id: 'old' }]`;
  - the clamp test never sees page 1 again;
  - the sanitize test sees `action: 'MANIFEST_PUBLISH'`;
  - the loading test sees `false`;
  - the corrupt-storage test throws `SyntaxError`.

- [ ] **Step 4: Create `admin/src/hooks/useDebouncedValue.ts`**

```ts
import { useEffect, useState } from 'react';

/** `value`, once it has stopped changing for `ms`. The first value is returned at once. */
export function useDebouncedValue<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (Object.is(value, debounced)) return undefined;
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
    // `debounced` is read only to skip a no-op timer; re-running on it would restart the wait.
  }, [value, ms]); // eslint-disable-line react-hooks/exhaustive-deps
  return debounced;
}
```

- [ ] **Step 5: Rewrite `admin/src/hooks/useResourceList.ts`**

```ts
import { describeError } from '../utils/api-error';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useDebouncedValue } from './useDebouncedValue';

/** Typing pauses this long before a list search is sent. */
export const SEARCH_DEBOUNCE_MS = 300;

interface ListOptions<F> {
  key: string;
  pageSize?: number;
  initialFilters: F;
  /** Search to start with (e.g. from `?q=`); wins over the remembered search when non-empty. */
  initialSearch?: string | null;
  /** Repair filters restored from localStorage (e.g. drop options that no longer exist). */
  sanitizeFilters?: (restored: F) => F;
  onLoad: (page: number, search: string, filters: F) => Promise<{ data: any[], total: number }>;
}

function readFilters<F>(storageKey: string, initial: F): F {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return initial;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...initial, ...(parsed as Partial<F>) } : initial;
  } catch {
    return initial;
  }
}

/**
 * HOOK: useResourceList (SOLID: SRP/OCP)
 * Standardizes paging, searching, and filter persistence for Admin lists.
 * The search box value (`search`) is immediate; the request uses it once typing pauses (SEARCH_DEBOUNCE_MS).
 * Only the latest request's response is applied.
 */
export function useResourceList<F>({ key, pageSize = 25, initialFilters, initialSearch, sanitizeFilters, onLoad }: ListOptions<F>) {
  const filterKey = `${key}_filters`;
  const searchKey = `${key}_search`;

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(() => initialSearch || localStorage.getItem(searchKey) || '');
  const [filters, setFilters] = useState<F>(() => {
    const restored = readFilters(filterKey, initialFilters);
    return sanitizeFilters ? sanitizeFilters(restored) : restored;
  });
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  // The first load starts on mount, so a deep-linked panel says "Loading…" (not "not found") until it lands.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use a ref for onLoad to prevent infinite loops when inline functions are passed
  const onLoadRef = useRef(onLoad);
  useEffect(() => {
    onLoadRef.current = onLoad;
  }, [onLoad]);
  const latestRequest = useRef(0);

  const load = useCallback(async (p: number, s: string, f: F) => {
    const request = ++latestRequest.current;
    const isLatest = () => request === latestRequest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await onLoadRef.current(p, s, f);
      if (!isLatest()) return;
      setItems(result.data);
      setTotal(result.total);
      // The page emptied (e.g. its last row left a status filter): step back to the new last page.
      if (result.data.length === 0 && p > 1) setPage(Math.max(1, Math.ceil(result.total / pageSize)));
    } catch (err) {
      if (!isLatest()) return;
      setError(describeError(err, `Failed to load ${key}`));
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [key, pageSize]);

  useEffect(() => {
    void load(page, query, filters);
  }, [page, query, filters, load]);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
    localStorage.setItem(searchKey, val);
  };

  const updateFilters = (newFilters: Partial<F>) => {
    setFilters(prev => {
      const next = { ...prev, ...newFilters };
      localStorage.setItem(filterKey, JSON.stringify(next));
      return next;
    });
    setPage(1);
  };

  const navigateWithScroll = (cb: () => void) => {
    sessionStorage.setItem(`${key}_scroll`, window.scrollY.toString());
    cb();
  };

  return {
    items, total, page, setPage, error,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    loading, search, filters,
    handleSearch, updateFilters,
    /** Go to page `p`; the effect above loads it (calling load directly left `page` behind). */
    loadPage: (p: number) => setPage(Math.max(1, p)),
    navigateWithScroll,
    refresh: () => load(page, query, filters)
  };
}
```

- [ ] **Step 6: Run the hook tests**

Run: `cd admin && npx vitest run src/hooks/useDebouncedValue.test.ts src/hooks/useResourceList.test.ts`
Expected: PASS (2 + 10 tests).

- [ ] **Step 7: Full suite** (the Phase 2 pages use `useResourceList` for Parties, Elections and Persons)

Run: `cd admin && npm test && npm run build`
Expected: all PASS. Phase 2 tests that type into a list search already wait with `waitFor` (1 s default, longer than 300 ms), for example `Constituencies.test.tsx` "a new search goes back to page 1". Two kinds of Phase 2 assertion may need updating, and nothing else may change:
- If a test asserts a request **synchronously** right after typing, wrap that assertion in `await waitFor(() => …)`.
- If a test relied on `loading` starting `false` (for example an empty state checked before the first load), update that assertion to the loading-first behaviour and say so in the commit message.

- [ ] **Step 8: Commit**

```bash
git add admin/src/hooks/useDebouncedValue.ts admin/src/hooks/useDebouncedValue.test.ts admin/src/hooks/useResourceList.ts admin/src/hooks/useResourceList.test.ts
git commit -m "admin: debounce list searches, drop stale responses, clamp emptied pages, sanitise stored filters

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

If Step 7 changed a Phase 2 page test, add that file to the `git add` above.

---

### Task 3: Phase 1/2 follow-ups — Declare won confirm, clean Save seat, offline pill, guarded logout and health link

decisions §9. Four user-facing fixes:
- **Declare won** asks first in a `ConfirmDialog`.
- **Save seat** is disabled while the seat is clean.
- The live pill turns rose **"Live updates offline"** after 3 failed (re)connects in a row. It keeps retrying, and turns green again when connected.
- **Log out** and the **health dot** link go through `confirmDiscardEdits`.

**Files:**
- Modify:
  - `admin/src/services/election.service.ts` (`subscribeLiveUpdates`, `LiveUpdateHandlers.onStatus`)
  - `admin/src/context/ShellStatusContext.tsx` (`LiveStreamState`)
  - `admin/src/components/shell/TopBar.tsx`
  - `admin/src/components/shell/HealthDot.tsx`
  - `admin/src/components/live/SeatEditor.tsx`
- Test: `admin/src/services/live-sse.test.ts`, `admin/src/components/shell/shell.test.tsx`, `admin/src/pages/LiveConsole.test.tsx`

**Interfaces:**
- Consumes: `ConfirmDialog` (`components/ui/ConfirmDialog`), `confirmDiscardEdits` and `useShellStatus` (`context/ShellStatusContext`).
- Produces:
  - `export type LiveStreamState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline'`.
  - `export const SSE_OFFLINE_AFTER = 3` in `election.service.ts`.
  - `LiveUpdateHandlers.onStatus?: (status: 'connecting' | 'open' | 'reconnecting' | 'offline') => void`.
  - `HealthDot({ canOpenStatus })` is unchanged as a prop. Its link now has the accessible name of the health label, e.g. "All systems OK".

- [ ] **Step 1: Append the failing SSE tests** to `admin/src/services/live-sse.test.ts`. Inside `describe('admin live SSE subscription', …)`, after the last `it`, add:

```ts
  it('reports offline after three failed attempts in a row; a retry does not flip it back; open again once connected', async () => {
    const onStatus = vi.fn();
    const stop = subscribeLiveUpdates(EID, { onResultUpdate: vi.fn(), onBatchUpdate: vi.fn(), onStatus });
    await vi.advanceTimersByTimeAsync(0);
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(['connecting']);
    FakeEventSource.instances[0].onerror!();
    await vi.advanceTimersByTimeAsync(2_100);
    FakeEventSource.instances[1].onerror!();
    await vi.advanceTimersByTimeAsync(3_100);
    FakeEventSource.instances[2].onerror!();
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(['connecting', 'reconnecting', 'reconnecting', 'offline']);
    await vi.advanceTimersByTimeAsync(5_100);
    expect(FakeEventSource.instances).toHaveLength(4);
    expect(onStatus).toHaveBeenLastCalledWith('offline');
    FakeEventSource.instances[3].onopen!();
    expect(onStatus).toHaveBeenLastCalledWith('open');
    stop();
  });

  it('a failing token request counts as a failed attempt', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const onStatus = vi.fn();
    const stop = subscribeLiveUpdates(EID, { onResultUpdate: vi.fn(), onBatchUpdate: vi.fn(), onStatus });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2_100);
    await vi.advanceTimersByTimeAsync(3_100);
    expect(onStatus.mock.calls.map(([s]) => s)).toEqual(['connecting', 'reconnecting', 'reconnecting', 'offline']);
    expect(FakeEventSource.instances).toHaveLength(0);
    stop();
  });
```

- [ ] **Step 2: Update the shell test mocks and add the failing shell tests** in `admin/src/components/shell/shell.test.tsx`.

  a. Replace the hoisted `shell` object and the `ShellStatusContext` mock with:

```tsx
const shell = vi.hoisted(() => ({ editorDirty: false, live: 'idle' as 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline' }));
vi.mock('../../context/ShellStatusContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../context/ShellStatusContext')>()),
  useShellStatus: () => ({ live: shell.live, setLive: () => {}, editorDirty: shell.editorDirty, markDirty: () => {} }),
}));
```

  b. Directly after the existing `vi.mock('@radix-ui/react-select', …)` block, add a dropdown-menu mock. Radix menus need pointer and resize APIs that jsdom lacks; the button calls the same `onSelect`:

```tsx
vi.mock('@radix-ui/react-dropdown-menu', () => {
  const Pass = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Root: Pass, Portal: Pass, Content: Pass,
    Trigger: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    Item: ({ children, onSelect }: { children?: ReactNode; onSelect?: (e: Event) => void }) => (
      <button type="button" onClick={() => onSelect?.(new Event('select', { cancelable: true }))}>{children}</button>
    ),
  };
});
```

  c. Add these imports below the existing `import { ElectionPicker, shortElectionName } from './ElectionPicker';`:

```tsx
import { TopBar } from './TopBar';
import { HealthDot } from './HealthDot';
```

  d. Replace the existing `afterEach(…)` line with:

```tsx
afterEach(() => {
  cleanup();
  shell.editorDirty = false;
  shell.live = 'idle';
  election.setElectionId.mockClear();
  auth.logout.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
```

  e. Append at the end of the file:

```tsx
describe('TopBar', () => {
  it('with unsaved edits, Log out asks first; cancel keeps the session, confirm logs out', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(auth.logout).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('Log out does not ask when nothing is unsaved', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    const confirm = vi.spyOn(window, 'confirm');
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('the live pill reads "Live updates offline" in rose when the stream is offline', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    shell.live = 'offline';
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    const pill = screen.getByText('Live updates offline');
    expect(pill.className).toContain('bg-bad-soft');
    expect(pill.className).toContain('text-bad-text');
  });
});

describe('HealthDot', () => {
  // The health request never settles here, so the label stays "Checking systems…" for the whole test.
  it('with unsaved edits, the link to System status asks first and cancel stays put', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/parties/BJP']}><HealthDot canOpenStatus /><Routes><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: 'Checking systems…' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(screen.getByTestId('where').textContent).toBe('/parties/BJP');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('link', { name: 'Checking systems…' }));
    expect(screen.getByTestId('where').textContent).toBe('/status');
  });

  it('without the status role it is a labelled dot, not a link', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
    render(<MemoryRouter><HealthDot canOpenStatus={false} /></MemoryRouter>);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('img', { name: 'Checking systems…' })).toBeTruthy();
  });
});
```

- [ ] **Step 3: Update the Live Console page test** `admin/src/pages/LiveConsole.test.tsx`.

  a. Change the testing-library import to:

```tsx
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
```

  b. Replace the whole test `it('Save seat on a clean seat sends nothing; Declare won still works', …)` with:

```tsx
  it('Save seat is disabled while the seat is clean, enabled after an edit', () => {
    renderPage();
    const save = () => screen.getByRole('button', { name: 'Save seat' }) as HTMLButtonElement;
    expect(save().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    expect(save().disabled).toBe(false);
  });

  it('Declare won asks first; cancel saves nothing, confirming declares the leader and saves', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Declare won' }));
    const dialog = screen.getByRole('dialog', { name: 'Declare Ravi Prasad the winner?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(saveSeat).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Declare won' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, declare won' }));
    await waitFor(() => expect(saveSeat).toHaveBeenCalledTimes(1));
    expect(saveSeat).toHaveBeenCalledWith('s2', expect.objectContaining({
      overrides: [
        { result_id: 'a', votes: 61204, status: 'WON', margin: 12214 },
        { result_id: 'b', votes: 48990, status: 'LOST', margin: 12214 },
      ],
    }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
```

- [ ] **Step 4: Run them to confirm they fail**

Run: `cd admin && npx vitest run src/services/live-sse.test.ts src/components/shell/shell.test.tsx src/pages/LiveConsole.test.tsx`
Expected: FAIL:
- SSE: the calls array is `['connecting', 'reconnecting', 'connecting', 'reconnecting', …]` and never `'offline'`. The token test sees no `'reconnecting'`.
- Shell: Log out calls `logout` without asking. There is no "Live updates offline" text, which is a TypeScript error on `LIVE_PILL[live]` at build time but a test failure here. No link is named "Checking systems…".
- Live Console: Save seat is enabled on a clean seat, and there is no dialog "Declare Ravi Prasad the winner?".

- [ ] **Step 5: Add `'offline'` to the stream state** in `admin/src/context/ShellStatusContext.tsx`. Replace the `LiveStreamState` line with:

```ts
/** `offline`: SSE_OFFLINE_AFTER failed (re)connects in a row; the stream keeps retrying. */
export type LiveStreamState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'offline';
```

- [ ] **Step 6: Count failures in `subscribeLiveUpdates`** (`admin/src/services/election.service.ts`).

  a. In `LiveUpdateHandlers`, replace the `onStatus` line with:

```ts
  /** Stream state for the top-bar pill: 'offline' after SSE_OFFLINE_AFTER failed attempts in a row. */
  onStatus?: (status: 'connecting' | 'open' | 'reconnecting' | 'offline') => void;
```

  b. Directly above the `/** Delay before reconnect attempt` comment, add:

```ts
/** After this many failed (re)connects in a row the pill says "offline" (the stream keeps retrying). */
export const SSE_OFFLINE_AFTER = 3;
```

  c. Replace the whole `subscribeLiveUpdates` function with:

```ts
export function subscribeLiveUpdates(electionId: string, handlers: LiveUpdateHandlers): () => void {
  let es: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  /** Failed attempts since the last successful open (token request or stream error). */
  let failures = 0;
  let opened = false;
  let closed = false;

  const retry = () => {
    if (closed) return;
    timer = setTimeout(connect, sseRetryDelay(attempt++));
  };

  const fail = () => {
    if (closed) return;
    failures += 1;
    handlers.onStatus?.(failures >= SSE_OFFLINE_AFTER ? 'offline' : 'reconnecting');
    retry();
  };

  async function connect() {
    if (closed) return;
    // Only the very first attempt says "connecting"; retries keep "reconnecting" / "offline" on the pill.
    if (!opened && failures === 0) handlers.onStatus?.('connecting');
    let token: string;
    try {
      token = (await getLiveSseToken(electionId)).token;
    } catch {
      return fail();
    }
    if (closed) return;
    const source = new EventSource(
      `${API_BASE_URL}/admin/live/updates?election_id=${encodeURIComponent(electionId)}&token=${encodeURIComponent(token)}`,
    );
    es = source;
    source.onopen = () => {
      if (opened) handlers.onReconnect?.();
      opened = true;
      attempt = 0;
      failures = 0;
      handlers.onStatus?.('open');
    };
    source.onerror = () => {
      source.close();
      if (es === source) es = null;
      fail();
    };
    source.addEventListener('result-update', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data?.const_id) handlers.onResultUpdate(data);
      } catch { /* malformed frame */ }
    });
    source.addEventListener('batch-update', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (Array.isArray(data)) handlers.onBatchUpdate(data.filter((u) => u?.const_id));
      } catch { /* malformed frame */ }
    });
    source.addEventListener('seat-lock', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data?.const_id) handlers.onSeatLock?.({ const_id: data.const_id, lock: data.lock ?? null });
      } catch { /* malformed frame */ }
    });
  }

  void connect();
  return () => {
    closed = true;
    clearTimeout(timer);
    es?.close();
    es = null;
  };
}
```

- [ ] **Step 7: Rewrite `admin/src/components/shell/HealthDot.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../services/api-client';
import { confirmDiscardEdits, useShellStatus } from '../../context/ShellStatusContext';
import { cn } from '../ui/cn';

type Health = 'unknown' | 'ok' | 'degraded';
const POLL_MS = 30_000;

export function HealthDot({ canOpenStatus }: { canOpenStatus: boolean }) {
  const [health, setHealth] = useState<Health>('unknown');
  const { editorDirty } = useShellStatus();
  useEffect(() => {
    let alive = true;
    const check = () => fetch(`${API_BASE_URL}/health/ready`)
      .then((r) => alive && setHealth(r.ok ? 'ok' : 'degraded'))
      .catch(() => alive && setHealth('degraded'));
    check();
    const t = setInterval(check, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const label = health === 'ok' ? 'All systems OK' : health === 'degraded' ? 'Database or Redis degraded' : 'Checking systems…';
  const dot = <span aria-hidden className={cn('inline-block h-2.5 w-2.5 rounded-full', health === 'ok' ? 'bg-ok' : health === 'degraded' ? 'bg-bad' : 'bg-muted')} />;
  return canOpenStatus ? (
    <Link
      to="/status"
      aria-label={label}
      title={label}
      // BrowserRouter has no useBlocker: leaving an editor with unsaved edits asks here.
      onClick={(e) => { if (!confirmDiscardEdits(editorDirty)) e.preventDefault(); }}
      className="p-1"
    >
      {dot}
    </Link>
  ) : (
    <span role="img" aria-label={label} title={label} className="p-1">{dot}</span>
  );
}
```

- [ ] **Step 8: Rewrite `admin/src/components/shell/TopBar.tsx`** (offline pill and guarded Log out; everything else unchanged)

```tsx
import { useEffect, useState } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { confirmDiscardEdits, useShellStatus, type LiveStreamState } from '../../context/ShellStatusContext';
import { ElectionPicker } from './ElectionPicker';
import { HealthDot } from './HealthDot';
import { ShortcutsDialog } from './ShortcutsDialog';
import { CommandPalette } from './CommandPalette';
import { Kbd } from '../ui/Kbd';
import { cn } from '../ui/cn';

const LIVE_PILL: Record<Exclude<LiveStreamState, 'idle'>, { text: string; cls: string; dot: string }> = {
  open: { text: 'Live updates on', cls: 'bg-ok-soft text-ok-text border-ok/30', dot: 'bg-ok' },
  connecting: { text: 'Connecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
  reconnecting: { text: 'Reconnecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
  offline: { text: 'Live updates offline', cls: 'bg-bad-soft text-bad-text border-bad/30', dot: 'bg-bad' },
};

const isMac = () => typeof navigator !== 'undefined'
  && /mac/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '');

export function TopBar() {
  const { user, logout, hasRole } = useAuth();
  const { live, editorDirty } = useShellStatus();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const initials = (user?.name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const pill = live === 'idle' ? null : LIVE_PILL[live];

  // ⌘K (macOS) / Ctrl+K anywhere opens the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || e.altKey || e.repeat || e.isComposing) return;
      if ((isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Logging out unmounts any open editor: unsaved edits ask first (declining keeps the menu open).
  const signOut = (e: Event) => {
    if (!confirmDiscardEdits(editorDirty)) { e.preventDefault(); return; }
    logout();
  };

  return (
    <header className="tw-ui sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-card px-6">
      <div className="flex items-center gap-3">
        <ElectionPicker />
        <button
          type="button"
          aria-label="Search (⌘K)"
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 w-72 items-center gap-2 rounded-control border border-line bg-subtle px-2.5 text-xs text-muted hover:border-line-strong"
        >
          <Search size={14} aria-hidden />
          <span className="flex-1 text-left">Search seats, candidates…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>
      <div className="flex items-center gap-3 whitespace-nowrap">
        {pill && (
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', pill.cls)}>
            <span className={cn('h-2 w-2 rounded-full', pill.dot)} aria-hidden />{pill.text}
          </span>
        )}
        <HealthDot canOpenStatus={hasRole('SUPER_ADMIN')} />
        <ShortcutsDialog />
        <Menu.Root>
          <Menu.Trigger className="flex items-center gap-2 rounded-control px-1.5 py-1 hover:bg-subtle">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold text-white">{initials}</span>
            <span className="text-xs font-medium text-ink">{user?.name}</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={6} className="tw-ui z-50 min-w-44 rounded-card border border-line bg-card p-1 shadow-lg">
              <div className="px-2.5 py-1.5 text-[11px] text-muted">{user?.role.replace('_', ' ').toLowerCase()}</div>
              <Menu.Item onSelect={signOut} className="cursor-pointer rounded-control px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-subtle">
                Log out
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
```

  The live pill text sits in the outer `<span>` that carries `pill.cls`, so `getByText('Live updates offline')` returns the element that carries the colour classes.

- [ ] **Step 9: Declare won confirm and clean Save seat** in `admin/src/components/live/SeatEditor.tsx`.

  a. Add the import below `import { Kbd } from '../ui/Kbd';`:

```tsx
import { ConfirmDialog } from '../ui/ConfirmDialog';
```

  b. Directly below `const readOnly = lock.state === 'locked';`, add:

```tsx
  const [confirmDeclare, setConfirmDeclare] = useState(false);
```

  c. Directly below the `useImperativeHandle(…)` line, add:

```tsx
  const leaderName = ed.rows.find((r) => r.result_id === ed.leaderId)?.candidate_name;
```

  d. Replace the two action buttons `<Button variant="primary" … >Save seat</Button>` and `<Button variant="success" … >Declare won</Button>` with:

```tsx
            <Button variant="primary" onClick={() => void submit(false)} disabled={saving || readOnly || !ed.dirty}>Save seat</Button>
            <Button variant="success" onClick={() => setConfirmDeclare(true)} disabled={saving || readOnly || !ed.leaderId}>Declare won</Button>
```

  e. Directly before the closing `</section>` of the component, add:

```tsx
      <ConfirmDialog
        open={confirmDeclare}
        title={`Declare ${leaderName ?? 'the leader'} the winner?`}
        description={`${leaderName ?? 'The leader'} is set to Won and every other candidate to Lost, then the seat is saved. The public results page shows it straight away.`}
        confirmLabel="Yes, declare won"
        tone="primary"
        busy={saving}
        onConfirm={() => { void submit(true).finally(() => setConfirmDeclare(false)); }}
        onCancel={() => setConfirmDeclare(false)}
      />
```

  The Enter shortcut still calls `submit(false)` only, which does nothing on a clean seat. `ConfirmDialog` portals outside the editor box, so the Live Console's Enter and Esc handlers never fire inside it.

- [ ] **Step 10: Run the three test files**

Run: `cd admin && npx vitest run src/services/live-sse.test.ts src/components/shell/shell.test.tsx src/pages/LiveConsole.test.tsx`
Expected: PASS (5 + 13 + 13 tests).

- [ ] **Step 11: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. `tsc` accepts `onStatus: setLive` in `useLiveConsole.ts` because both unions now include `'offline'`.

- [ ] **Step 12: Commit**

```bash
git add admin/src/services/election.service.ts admin/src/services/live-sse.test.ts admin/src/context/ShellStatusContext.tsx admin/src/components/shell/TopBar.tsx admin/src/components/shell/HealthDot.tsx admin/src/components/shell/shell.test.tsx admin/src/components/live/SeatEditor.tsx admin/src/pages/LiveConsole.test.tsx
git commit -m "admin: confirm Declare won, disable clean Save seat, offline live pill, guard logout and health link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Login page, `ProtectedRoute` (return path) and the access-denied state

decisions §2, the design (`docs/design/admin/login.png`) and the NOTES fixes: the real `/logo-mark.png`, and the error banner only after a failed sign-in.

The page:
- a centred 400px card on the page background
- title "MatdaanPulse Admin" and subtitle "Sign in to manage elections and live results"
- email and password fields, with show/hide on the password
- a full-width indigo "Sign in" button
- footer "Admin access only · accounts are created by a super admin"

Errors are chosen by `ApiError.status`:
- 401 / 400 → "Invalid email or password". The backend's `MinLength(8)` makes a short password a 400, so do **not** block short passwords client-side.
- 429 → "Too many attempts — wait a minute and try again".
- Anything else → `describeError(err, 'Sign-in failed')`. This covers "Network error — check your connection" and "Sign-in failed: …".

Routing:
- A signed-in visit to `/login` redirects into the app.
- `ProtectedRoute` passes `state={{ from: location }}`, and Login returns there after sign-in.
- `ProtectedRoute` moves out of `App.tsx` into `components/routing/`.
- Its access-denied block loses the `var(--text-secondary)` inline style and becomes a Tailwind `EmptyState`.

**Files:**
- Create: `admin/src/components/routing/ProtectedRoute.tsx`, `admin/src/components/ui/PasswordInput.tsx`
- Rewrite: `admin/src/pages/Login.tsx`, `admin/src/App.tsx`
- Modify: `admin/src/theme/tailwind.css` (`@source` for `../pages/Login.tsx` and `../components/routing`)
- Test: `admin/src/components/routing/routing.test.tsx`, `admin/src/pages/Login.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` → `{ isAuthenticated, login(email, password): Promise<void>, hasRole(...roles) }`; `ApiError` (`services/api-client`); `describeError`; `Field`, `Input`, `Button`, `EmptyState`.
- Produces:
  - `ProtectedRoute({ children, roles? }: { children: ReactNode; roles?: string[] })`.
  - `returnPath(state: unknown): string`. It returns an in-app path from `state.from`; `/login`, a protocol-relative `//…` path, a non-path value or no state gives `'/'`.
  - `PasswordInput`, a `forwardRef<HTMLInputElement>` with props `Omit<InputProps, 'type'> & { label: string; error?: string; hint?: string }`. It renders its own label, the input, and a toggle `button` named "Show password" with `aria-pressed`.
  - From `pages/Login.tsx`: `INVALID_LOGIN`, `TOO_MANY_LOGINS`, `MISSING_LOGIN` (string constants) and `loginErrorMessage(err: unknown): string`.

- [ ] **Step 1: Write the failing routing test** `admin/src/components/routing/routing.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({ isAuthenticated: false, roles: [] as string[] }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: auth.isAuthenticated, hasRole: (...r: string[]) => r.some((x) => auth.roles.includes(x)) }),
}));
import { ProtectedRoute, returnPath } from './ProtectedRoute';

function LoginProbe() {
  const { state } = useLocation();
  return <output data-testid="back">{returnPath(state)}</output>;
}

const renderAt = (at: string, roles?: string[]) => render(
  <MemoryRouter initialEntries={[at]}>
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route path="/feedback" element={<ProtectedRoute roles={roles}><p>Feedback inbox</p></ProtectedRoute>} />
    </Routes>
  </MemoryRouter>,
);

afterEach(() => { cleanup(); auth.isAuthenticated = false; auth.roles = []; });

describe('ProtectedRoute', () => {
  it('a signed-out visit goes to /login and remembers the page, including the query', () => {
    renderAt('/feedback?status=new');
    expect(screen.queryByText('Feedback inbox')).toBeNull();
    expect(screen.getByTestId('back').textContent).toBe('/feedback?status=new');
  });

  it('a signed-in user without the role sees "Access denied" in sentence case', () => {
    auth.isAuthenticated = true;
    auth.roles = ['VIEWER'];
    renderAt('/feedback', ['SUPER_ADMIN', 'EDITOR']);
    expect(screen.getByRole('heading', { name: 'Access denied' })).toBeTruthy();
    expect(screen.getByText('You do not have permission to view this page.')).toBeTruthy();
    expect(screen.queryByText('Feedback inbox')).toBeNull();
  });

  it('a signed-in user with the role sees the page', () => {
    auth.isAuthenticated = true;
    auth.roles = ['EDITOR'];
    renderAt('/feedback', ['SUPER_ADMIN', 'EDITOR']);
    expect(screen.getByText('Feedback inbox')).toBeTruthy();
  });
});

describe('returnPath', () => {
  it.each([
    [undefined, '/'],
    [null, '/'],
    [{}, '/'],
    [{ from: { pathname: '/logs', search: '?action=RESULT_OVERRIDE' } }, '/logs?action=RESULT_OVERRIDE'],
    [{ from: { pathname: '/candidates/c7', search: '', hash: '#top' } }, '/candidates/c7#top'],
    [{ from: { pathname: '/login' } }, '/'],
    [{ from: { pathname: '//evil.example/x' } }, '/'],
    [{ from: { pathname: 'https://evil.example' } }, '/'],
    [{ from: { pathname: 42 } }, '/'],
  ])('%j → %s', (state, expected) => {
    expect(returnPath(state)).toBe(expected);
  });
});
```

- [ ] **Step 2: Write the failing login test** `admin/src/pages/Login.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const auth = vi.hoisted(() => ({ isAuthenticated: false, login: vi.fn(async (_e: string, _p: string) => {}) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => auth }));
import Login from './Login';
import { ApiError } from '../services/api-client';

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

const renderLogin = (state?: unknown) => render(
  <MemoryRouter initialEntries={[{ pathname: '/login', state }]}>
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

const signIn = (email = ' admin@matdaanpulse.in ', password = 'correct-horse') => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
};

afterEach(() => { cleanup(); auth.isAuthenticated = false; auth.login.mockReset(); auth.login.mockResolvedValue(undefined); });

describe('Login', () => {
  it('shows the card per the design with no banner before an attempt', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'MatdaanPulse Admin' })).toBeTruthy();
    expect(screen.getByText('Sign in to manage elections and live results')).toBeTruthy();
    expect(screen.getByText('Admin access only · accounts are created by a super admin')).toBeTruthy();
    expect((document.querySelector('img') as HTMLImageElement).getAttribute('src')).toBe('/logo-mark.png');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('401 → "Invalid email or password", with the trimmed email sent', async () => {
    auth.login.mockRejectedValueOnce(new ApiError('Invalid credentials', 401));
    renderLogin();
    signIn();
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
    expect(auth.login).toHaveBeenCalledWith('admin@matdaanpulse.in', 'correct-horse');
  });

  it('400 (a password under 8 characters fails backend validation) → the same message', async () => {
    auth.login.mockRejectedValueOnce(new ApiError('Validation failed', 400, 'VALIDATION', [{ field: 'password', message: 'too short' }]));
    renderLogin();
    signIn('admin@matdaanpulse.in', 'short');
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
    expect(auth.login).toHaveBeenCalledWith('admin@matdaanpulse.in', 'short');
  });

  it('429 → "Too many attempts — wait a minute and try again"', async () => {
    auth.login.mockRejectedValueOnce(new ApiError('ThrottlerException: Too Many Requests', 429));
    renderLogin();
    signIn();
    expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts — wait a minute and try again');
  });

  it('a network failure says so; a 5xx falls back to describeError', async () => {
    auth.login.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    renderLogin();
    signIn();
    expect((await screen.findByRole('alert')).textContent).toBe('Network error — check your connection');
    auth.login.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sign-in failed: Internal server error'));
  });

  it('empty fields ask for both without calling the API', () => {
    renderLogin();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert').textContent).toBe('Enter your email and password');
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('after signing in, returns to the page that sent the user here', async () => {
    renderLogin({ from: { pathname: '/logs', search: '?action=RESULT_OVERRIDE' } });
    signIn();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/logs?action=RESULT_OVERRIDE'));
  });

  it('never returns to /login or a protocol-relative path', async () => {
    renderLogin({ from: { pathname: '//evil.example/x' } });
    signIn();
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'));
  });

  it('an already signed-in visit is redirected into the app', () => {
    auth.isAuthenticated = true;
    renderLogin({ from: { pathname: '/feedback' } });
    expect(screen.getByTestId('where').textContent).toBe('/feedback');
  });

  it('the eye button shows and hides the password', () => {
    renderLogin();
    const password = screen.getByLabelText('Password') as HTMLInputElement;
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(password.type).toBe('password');
    fireEvent.click(toggle);
    expect(password.type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(toggle);
    expect(password.type).toBe('password');
    expect(toggle.getAttribute('type')).toBe('button');
  });
});
```

- [ ] **Step 3: Run both to confirm they fail**

Run: `cd admin && npx vitest run src/components/routing/routing.test.tsx src/pages/Login.test.tsx`
Expected: FAIL:
- routing: "Failed to resolve import './ProtectedRoute'".
- Login:
  - "Unable to find a label with the text of: Password". The old input has `id="password"` and a `<label htmlFor>`, but no "Show password" button exists.
  - The banner text is "Invalid credentials. Please try again.".
  - No redirect happens.

- [ ] **Step 4: Create `admin/src/components/routing/ProtectedRoute.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EmptyState } from '../ui/EmptyState';

interface FromState { from?: { pathname?: unknown; search?: unknown; hash?: unknown } }

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * Where to go after signing in: the in-app page that sent the user to /login (`state.from`, set below).
 * Anything else — no state, /login itself, a protocol-relative "//host" or a non-path value — goes to "/".
 */
export function returnPath(state: unknown): string {
  const from = (state as FromState | null | undefined)?.from;
  const pathname = text(from?.pathname);
  if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.startsWith('/\\') || pathname === '/login') return '/';
  return `${pathname}${text(from?.search)}${text(from?.hash)}`;
}

/** Signed-out users go to /login (remembering this page); a signed-in user without the role sees "Access denied". */
export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { isAuthenticated, hasRole } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && roles.length > 0 && !roles.some((r) => hasRole(r))) {
    return (
      <div className="tw-ui flex h-full items-center justify-center bg-page p-10 font-sans">
        <EmptyState icon={ShieldAlert} title="Access denied" description="You do not have permission to view this page." />
      </div>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 5: Create `admin/src/components/ui/PasswordInput.tsx`**

```tsx
import { forwardRef, useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input, type InputProps } from './Input';
import { cn } from './cn';

interface PasswordInputProps extends Omit<InputProps, 'type'> {
  label: string;
  error?: string;
  hint?: string;
}

/**
 * Password field with its own label and a show/hide toggle. Not wrapped in <Field>: Field's label wraps exactly
 * one control, and the toggle is a second one.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(function PasswordInput(
  { label, error, hint, className, id, ...props },
  ref,
) {
  const uid = useId();
  const inputId = id ?? `${uid}-input`;
  const hintId = `${uid}-hint`;
  const errorId = `${uid}-error`;
  const [shown, setShown] = useState(false);
  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={inputId} className="mb-1 block text-xs font-medium text-ink-2">{label}</label>
      <div className="relative">
        <Input
          ref={ref}
          id={inputId}
          type={shown ? 'text' : 'password'}
          invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className="pr-10"
          {...props}
        />
        <button
          type="button"
          aria-label="Show password"
          aria-pressed={shown}
          onClick={() => setShown((s) => !s)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-control p-1.5 text-muted hover:text-ink"
        >
          {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
      {hint && !error && <p id={hintId} className="text-[11px] text-muted">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
});
```

- [ ] **Step 6: Rewrite `admin/src/pages/Login.tsx`**

```tsx
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api-client';
import { describeError } from '../utils/api-error';
import { returnPath } from '../components/routing/ProtectedRoute';
import { Field } from '../components/ui/Field';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';

export const INVALID_LOGIN = 'Invalid email or password';
export const TOO_MANY_LOGINS = 'Too many attempts — wait a minute and try again';
export const MISSING_LOGIN = 'Enter your email and password';

/**
 * One banner message per failure. 400 is the backend's own validation (e.g. a password under 8 characters),
 * which is just a wrong password to the person signing in. 429 is the 5-per-minute sign-in throttle.
 */
export function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401 || err.status === 400) return INVALID_LOGIN;
    if (err.status === 429) return TOO_MANY_LOGINS;
  }
  return describeError(err, 'Sign-in failed');
}

/** PAGE: sign in (outside the shell). Returns to the page that sent the user here. */
export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const target = returnPath(state);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && !submitting) return <Navigate to={target} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const address = email.trim();
    if (!address || !password) { setError(MISSING_LOGIN); return; }
    setError(null);
    setSubmitting(true);
    try {
      await login(address, password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(loginErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="tw-ui flex min-h-screen flex-col items-center justify-center bg-page px-4 font-sans text-ink">
      <form
        noValidate
        aria-labelledby="signin-title"
        onSubmit={(e) => { void submit(e); }}
        className="w-full max-w-[400px] rounded-panel border border-line bg-card p-8 shadow-sm"
      >
        <img src="/logo-mark.png" alt="" className="h-12 w-12 rounded-card" />
        <h1 id="signin-title" className="mt-4 text-xl font-semibold tracking-tight text-ink">MatdaanPulse Admin</h1>
        <p className="mt-1 text-sm text-ink-2">Sign in to manage elections and live results</p>
        <div className="mt-6 space-y-4">
          <Field label="Email">
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="you@matdaanpulse.in"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <PasswordInput
            label="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" disabled={submitting} className="mt-5 w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
        {error && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-control border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad-text">
            <AlertCircle size={14} aria-hidden className="shrink-0" />
            {error}
          </div>
        )}
      </form>
      <p className="mt-6 text-xs text-muted">Admin access only · accounts are created by a super admin</p>
    </div>
  );
}
```

- [ ] **Step 7: Rewrite `admin/src/App.tsx`.** It uses the shared `ProtectedRoute`; the routes are unchanged.

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ErrorBoundary from './components/atoms/ErrorBoundary';
import Layout from './components/Layout';
import { ProtectedRoute } from './components/routing/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Elections from './pages/Elections';
import Manifests from './pages/Manifests';
import UserManager from './pages/UserManager';
import AuditLogs from './pages/AuditLogs';
import Feedback from './pages/Feedback';
import SystemStatus from './pages/SystemStatus';
import Parties from './pages/Parties';
import { EditRedirect } from './components/routing/EditRedirect';
import Candidates from './pages/Candidates';
import LiveConsole from './pages/LiveConsole';
import Constituencies from './pages/Constituencies';
import Persons from './pages/Persons';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <ErrorBoundary>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="elections/:id/edit" element={<EditRedirect base="/elections" />} />
                <Route path="elections/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Elections /></ProtectedRoute>} />

                {/* Manifests: one per election; full-width panel at /manifests/:electionId */}
                <Route path="manifests/:id/edit" element={<EditRedirect base="/manifests" />} />
                <Route path="manifests/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Manifests /></ProtectedRoute>} />

                {/* Parties: list + panel at /parties/:id; old /:id/edit links redirect */}
                <Route path="parties/:id/edit" element={<EditRedirect base="/parties" />} />
                <Route path="parties/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Parties /></ProtectedRoute>} />

                {/* Candidates */}
                <Route path="candidates/:id/edit" element={<EditRedirect base="/candidates" />} />
                <Route path="candidates/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Candidates /></ProtectedRoute>} />

                {/* Persons */}
                <Route path="persons/:id/edit" element={<EditRedirect base="/persons" />} />
                <Route path="persons/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Persons /></ProtectedRoute>} />

                {/* Constituencies */}
                <Route path="constituencies/:id/edit" element={<EditRedirect base="/constituencies" />} />
                <Route path="constituencies/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Constituencies /></ProtectedRoute>} />

                {/* Overrides & Logs */}
                <Route path="overrides" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><LiveConsole /></ProtectedRoute>} />
                <Route path="feedback" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Feedback /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute roles={['SUPER_ADMIN']}><UserManager /></ProtectedRoute>} />
                <Route path="logs" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AuditLogs /></ProtectedRoute>} />
                <Route path="status" element={<ProtectedRoute roles={['SUPER_ADMIN']}><SystemStatus /></ProtectedRoute>} />
              </Route>
            </Routes>
          </BrowserRouter>
        </ErrorBoundary>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
```

- [ ] **Step 8: `@source` lines.** In `admin/src/theme/tailwind.css`, add these lines directly after `@source "../pages/Manifests.tsx";`:

```css
@source "../pages/Login.tsx";
@source "../components/routing";
```

`components/ui/PasswordInput.tsx` is already covered by `@source "../components/ui"`.

- [ ] **Step 9: Run the two test files**

Run: `cd admin && npx vitest run src/components/routing/routing.test.tsx src/pages/Login.test.tsx`
Expected: PASS (3 + 9 routing tests, 10 login tests).

- [ ] **Step 10: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. There is no unused `React` import left in `App.tsx`; `noUnusedLocals` would catch one.

- [ ] **Step 11: Commit**

```bash
git add admin/src/components/routing admin/src/components/ui/PasswordInput.tsx admin/src/pages/Login.tsx admin/src/pages/Login.test.tsx admin/src/App.tsx admin/src/theme/tailwind.css
git commit -m "admin: redesigned login (status-specific errors, return path, show password) and Tailwind access-denied

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Shared helpers — IST time, audit wording, feedback kinds, seat counts, dashboard summaries, readiness

The Dashboard (Task 6), Feedback (Task 7) and Audit logs (Task 9) need the same vocabulary. This task builds it once, as pure, unit-tested helpers:
- **Time:** relative time, IST formatting, and the inclusive IST day bounds for the audit filter.
- **Audit wording:** real action and entity labels and readable sentences, plus the `AuditLog` type fix. The backend returns `users`, not `user`; `user_id` is `null` after a user is deleted.
- **Feedback:** kind labels and badge tones (bug rose, data_error amber, suggestion indigo, other slate).
- **Seats:** seat counts and "% reporting", lifted out of `useLiveConsole`.
- **Dashboard:** summaries built from live results, locks, `/admin/status` and `/health/ready`.
- **Readiness:** a `/health/ready` reader that keeps the body of a 503. A degraded check answers 503 with the normal health JSON, which `apiFetch` would turn into an error.

**Files:**
- Create:
  - `admin/src/utils/time.ts`, `admin/src/utils/audit.ts`, `admin/src/utils/feedback.ts`, `admin/src/utils/dashboard.ts`
  - `admin/src/services/health.service.ts`
  - `admin/src/components/feedback/FeedbackKindBadge.tsx`
- Modify:
  - `admin/src/types/index.ts` (`AuditLog`)
  - `admin/src/components/ui/Badge.tsx` (export `Tone`)
  - `admin/src/utils/seat-math.ts`, `admin/src/hooks/useLiveConsole.ts`
  - `admin/src/pages/AuditLogs.tsx` (compile fix only: `user` → `users`)
  - `admin/src/theme/tailwind.css` (`@source "../components/feedback"`)
- Test:
  - `admin/src/utils/time.test.ts`, `audit.test.ts`, `feedback.test.ts`, `dashboard.test.ts`
  - `admin/src/services/health.service.test.ts`
  - `admin/src/utils/seat-math.test.ts` (append)

**Interfaces:**
- Consumes:
  - `LiveConstituency`, `SeatLock`, `AuditLog`, `Election` and `FeedbackKind` / `FeedbackStatus` (`types`)
  - `SystemStatus` (`services/status.service`)
  - `API_BASE_URL` (`services/api-client`)
  - `Badge` (`components/ui/Badge`)
- Produces:
  - `utils/time.ts`:
    - `IST_TIME_ZONE = 'Asia/Kolkata'`
    - `timeAgo(iso: string, now?: number): string` → `'just now' | 'N min ago' | 'N h ago' | 'N d ago' | ''`
    - `formatIst(iso: string): string` → `'01 Oct 2026, 14:32'`
    - `formatIstDate(iso: string): string` → `'1 Oct 2026'`
    - `clockIst(iso: string): string` → `'14:32:08'`
    - `isIsoDay(v: unknown): v is string`
    - `istDayStart(day: string): string` → `'2026-10-01T00:00:00.000+05:30'`, or `''` for a bad value
    - `istDayEnd(day: string): string` → `'2026-10-01T23:59:59.999+05:30'`, or `''`
  - `utils/audit.ts`:
    - `AUDIT_ACTIONS` and `AUDIT_ENTITIES`, readonly `{ value: string; label: string }[]`
    - `actionLabel(a: string): string` and `entityLabel(t: string): string`
    - `isAuditAction(v: unknown): boolean` and `isAuditEntity(v: unknown): boolean`
    - `actionTone(a: string): Tone`
    - `auditActor(log: AuditLog): string` → name, else email, else `'Deleted user'`
    - `interface SeatLookup { seatForConst(constId: string): string | null; seatForResult(resultId: string): { seat: string; candidate: string } | null }`
    - `describeAudit(log: AuditLog, lookup?: Partial<SeatLookup>): string`
  - `utils/feedback.ts`:
    - `FEEDBACK_KINDS: Record<FeedbackKind, { label: string; tone: Tone }>` and `kindMeta(kind: string)`
    - `FEEDBACK_STATUSES: FeedbackStatus[]`
    - `FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string>` and `FEEDBACK_STATUS_TONE: Record<FeedbackStatus, Tone>`
    - `isFeedbackStatus(v: unknown): v is FeedbackStatus`
    - `firstLine(message: string, max?: number): string`
  - `components/feedback/FeedbackKindBadge.tsx`: `FeedbackKindBadge({ kind }: { kind: string })`.
  - `utils/seat-math.ts` (new exports):
    - `SEAT_LOCK_TTL_MS = 120_000`
    - `isLockLapsed(lock: { acquired_at: string }, now: number): boolean`
    - `countSeats(seats: LiveConstituency[]): SeatCounts` with `SeatCounts = { all: number; PENDING: number; LEADING: number; WON: number }`
    - `reportingPercent(counts: SeatCounts): number`
    - `useLiveConsole` keeps exporting `SEAT_LOCK_TTL_MS` (re-export).
  - `services/health.service.ts`:
    - `interface ReadinessCheck { status: 'healthy' | 'unhealthy'; latencyMs: number }`
    - `interface Readiness { status: 'healthy' | 'degraded'; checks: { database: ReadinessCheck; redis: ReadinessCheck } }`
    - `getReadiness(): Promise<Readiness>`, which resolves for 200 **and** 503 health bodies and throws otherwise.
  - `utils/dashboard.ts`:
    - `interface LiveSummary { total: number; declared: number; leading: number; pending: number; reportingPct: number; topLeader: { party: string; seats: number } | null; lastUpdate: string | null; round: number | null }`
    - `summarizeLive(seats: LiveConstituency[]): LiveSummary`
    - `leadingSubtitle(s: LiveSummary): string` and `lastUpdateSubtitle(s: LiveSummary, now: number): string`
    - `interface EditingNow { constId: string; userName: string; seat: string }` and `editingNow(locks: SeatLock[], seats: LiveConstituency[], now: number): EditingNow[]`
    - `seatLookup(seats: LiveConstituency[]): SeatLookup`
    - `interface HealthRow { label: string; detail: string; value: string; ok: boolean }` and `interface HealthSummary { ok: boolean; rows: HealthRow[] }`
    - `healthFromStatus(s: SystemStatus): HealthSummary` and `healthFromReadiness(r: Readiness): HealthSummary`
    - `ELECTION_PHASE: Record<Election['status'], string>`
    - `groupElections(elections: Election[]): { live: Election[]; upcoming: Election[]; finalized: Election[] }`
  - `types/index.ts`: `AuditLog.user_id: string | null` and `AuditLog.users?: Pick<User, 'id' | 'email' | 'name' | 'role'> | null` (the `user` field is removed).
  - `components/ui/Badge.tsx`: `export type Tone = 'accent' | 'ok' | 'warn' | 'bad' | 'muted'`.

- [ ] **Step 1: Write the failing time test** `admin/src/utils/time.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { clockIst, formatIst, formatIstDate, isIsoDay, istDayEnd, istDayStart, timeAgo } from './time';

const NOW = Date.parse('2026-10-01T10:00:00Z');

describe('timeAgo', () => {
  it.each([
    ['2026-10-01T09:59:30Z', 'just now'],
    ['2026-10-01T09:55:00Z', '5 min ago'],
    ['2026-10-01T07:00:00Z', '3 h ago'],
    ['2026-09-29T10:00:00Z', '2 d ago'],
    ['2026-10-01T10:05:00Z', 'just now'],
    ['not a date', ''],
  ])('%s → %s', (iso, expected) => expect(timeAgo(iso, NOW)).toBe(expected));
});

describe('IST formatting (independent of the machine zone)', () => {
  it('formatIst shows the IST date and 24-hour time', () => {
    expect(formatIst('2026-09-30T20:00:00Z')).toBe('01 Oct 2026, 01:30');
  });
  it('formatIstDate and clockIst', () => {
    expect(formatIstDate('2026-10-01T05:00:00Z')).toBe('1 Oct 2026');
    expect(clockIst('2026-09-30T10:00:00.000Z')).toBe('15:30:00');
  });
  it('an unparseable value formats to an empty string', () => {
    expect(formatIst('nope')).toBe('');
    expect(clockIst('')).toBe('');
  });
});

describe('IST day bounds (audit filter, both ends inclusive)', () => {
  it('start and end of the IST calendar day', () => {
    expect(istDayStart('2026-10-01')).toBe('2026-10-01T00:00:00.000+05:30');
    expect(istDayEnd('2026-10-01')).toBe('2026-10-01T23:59:59.999+05:30');
    expect(new Date(istDayStart('2026-10-01')).toISOString()).toBe('2026-09-30T18:30:00.000Z');
    expect(new Date(istDayEnd('2026-10-01')).toISOString()).toBe('2026-10-01T18:29:59.999Z');
  });
  it('anything that is not YYYY-MM-DD gives an empty string', () => {
    for (const bad of ['', '01/10/2026', '2026-10-1', 'MANIFEST_PUBLISH']) {
      expect(istDayStart(bad)).toBe('');
      expect(istDayEnd(bad)).toBe('');
      expect(isIsoDay(bad)).toBe(false);
    }
    expect(isIsoDay('2026-10-01')).toBe(true);
    expect(isIsoDay(20261001)).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing audit test** `admin/src/utils/audit.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, actionLabel, actionTone, auditActor, describeAudit, entityLabel, isAuditAction, isAuditEntity } from './audit';
import type { AuditLog } from '../types';

const log = (over: Partial<AuditLog>): AuditLog => ({
  id: 'l1', user_id: 'u1', users: { id: 'u1', email: 'priya@x.in', name: 'Priya S', role: 'EDITOR' },
  action: 'RESULT_OVERRIDE', entity_type: 'result', entity_id: 'r1', old_value: null, new_value: null,
  timestamp: '2026-10-01T08:00:00.000Z', ...over,
});

describe('audit vocabulary', () => {
  it('lists exactly the actions and entities the backend writes', () => {
    expect(AUDIT_ACTIONS.map((a) => a.value)).toEqual(['RESULT_OVERRIDE', 'RESULT_BULK_OVERRIDE', 'SEAT_LOCK_TAKEOVER']);
    expect(AUDIT_ENTITIES.map((e) => e.value)).toEqual(['result', 'election', 'constituency']);
    expect(isAuditAction('SEAT_LOCK_TAKEOVER')).toBe(true);
    expect(isAuditAction('MANIFEST_PUBLISH')).toBe(false);
    expect(isAuditEntity('constituency')).toBe(true);
    expect(isAuditEntity('manifest')).toBe(false);
  });

  it('labels are sentence case; unknown values are humanised', () => {
    expect(actionLabel('RESULT_BULK_OVERRIDE')).toBe('Seat save (bulk)');
    expect(actionLabel('MANIFEST_PUBLISH')).toBe('Manifest publish');
    expect(entityLabel('constituency')).toBe('Seat');
    expect(entityLabel('party')).toBe('Party');
    expect(actionTone('SEAT_LOCK_TAKEOVER')).toBe('warn');
    expect(actionTone('SOMETHING_ELSE')).toBe('muted');
  });

  it('auditActor: name, else email, else "Deleted user"', () => {
    expect(auditActor(log({}))).toBe('Priya S');
    expect(auditActor(log({ users: { id: 'u1', email: 'priya@x.in', name: '', role: 'EDITOR' } }))).toBe('priya@x.in');
    expect(auditActor(log({ user_id: null, users: null }))).toBe('Deleted user');
  });
});

describe('describeAudit', () => {
  const lookup = {
    seatForConst: (id: string) => (id === 'k145' ? '145 Bikram' : null),
    seatForResult: (id: string) => (id === 'r1' ? { seat: '142 Patna Sahib', candidate: 'Ravi Prasad' } : null),
  };

  it('a lock take-over names the seat and the previous holder', () => {
    const l = log({ action: 'SEAT_LOCK_TAKEOVER', entity_type: 'constituency', entity_id: 'k145', old_value: { user_name: 'Rahul M' } });
    expect(describeAudit(l, lookup)).toBe('Priya S took over 145 Bikram from Rahul M');
    expect(describeAudit(l)).toBe('Priya S took over a seat from Rahul M');
  });

  it('a bulk save counts results and rounds', () => {
    const l = log({ action: 'RESULT_BULK_OVERRIDE', entity_type: 'election', entity_id: 'e1', new_value: { results_updated: 3, constituencies_with_rounds: 1 } });
    expect(describeAudit(l)).toBe('Priya S saved 3 results and rounds for 1 seat');
    expect(describeAudit(log({ action: 'RESULT_BULK_OVERRIDE', new_value: { results_updated: 1, constituencies_with_rounds: 0 } }))).toBe('Priya S saved 1 result');
    expect(describeAudit(log({ action: 'RESULT_BULK_OVERRIDE', new_value: null }))).toBe('Priya S saved results');
  });

  it('a single override names the candidate and seat when known', () => {
    const l = log({ new_value: { votes: 61204, status: 'LEADING', margin: 12214 } });
    expect(describeAudit(l, lookup)).toBe('Priya S set Ravi Prasad in 142 Patna Sahib to 61,204 votes');
    expect(describeAudit(log({ entity_id: 'zzz', new_value: { votes: 5 } }), lookup)).toBe('Priya S overrode a result to 5 votes');
  });

  it('any other action is still readable', () => {
    expect(describeAudit(log({ action: 'MANIFEST_PUBLISH', entity_type: 'manifest', entity_id: 'e1', users: null, user_id: null })))
      .toBe('Deleted user: Manifest publish · Manifest e1');
  });
});
```

- [ ] **Step 3: Write the failing feedback test** `admin/src/utils/feedback.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { FEEDBACK_KINDS, FEEDBACK_STATUSES, FEEDBACK_STATUS_LABEL, firstLine, isFeedbackStatus, kindMeta } from './feedback';

describe('feedback metadata', () => {
  it('kind badges: bug rose, data error amber, suggestion indigo, other slate', () => {
    expect(FEEDBACK_KINDS.bug).toEqual({ label: 'Bug', tone: 'bad' });
    expect(FEEDBACK_KINDS.data_error).toEqual({ label: 'Data error', tone: 'warn' });
    expect(FEEDBACK_KINDS.suggestion).toEqual({ label: 'Suggestion', tone: 'accent' });
    expect(FEEDBACK_KINDS.other).toEqual({ label: 'Other', tone: 'muted' });
    expect(kindMeta('spam')).toEqual({ label: 'spam', tone: 'muted' });
  });

  it('statuses', () => {
    expect(FEEDBACK_STATUSES).toEqual(['new', 'read', 'resolved']);
    expect(FEEDBACK_STATUS_LABEL.resolved).toBe('Resolved');
    expect(isFeedbackStatus('read')).toBe(true);
    expect(isFeedbackStatus('archived')).toBe(false);
    expect(isFeedbackStatus('')).toBe(false);
  });

  it('firstLine: first non-empty line, trimmed and capped', () => {
    expect(firstLine('\n  Round 2 total is wrong  \nDetails…')).toBe('Round 2 total is wrong');
    expect(firstLine('a'.repeat(130), 120)).toBe(`${'a'.repeat(119)}…`);
    expect(firstLine('   ')).toBe('');
  });
});
```

- [ ] **Step 4: Append the failing seat-math tests** to `admin/src/utils/seat-math.test.ts`.

  a. Change its import line to:

```ts
import { parseVotes, rankSeat, seatMargin, deriveStatuses, buildSeatOverrides, seatStatus, countSeats, reportingPercent, isLockLapsed, SEAT_LOCK_TTL_MS, type SeatRow } from './seat-math';
```

  b. Append at the end of the file:

```ts
describe('seat counts, reporting and lock lapse', () => {
  const seat = (id: string, votes: number[], won = false) => ({
    const_id: id, const_name: id, const_no: 1, const_type: 'GEN', current_round: null, total_rounds: null,
    candidates: votes.map((v, i) => ({
      result_id: `${id}-${i}`, candidate_id: `c${i}`, candidate_name: `C${i}`, party_id: `P${i}`, party_name: `P${i}`,
      party_color: null, party_abbr: `P${i}`, votes: v, status: won && i === 0 ? 'WON' : 'TRAILING', margin: 0, last_updated: '',
    })),
  });

  it('countSeats and reportingPercent', () => {
    const counts = countSeats([seat('a', [0, 0]), seat('b', [5, 3]), seat('c', [9, 1], true)]);
    expect(counts).toEqual({ all: 3, PENDING: 1, LEADING: 1, WON: 1 });
    expect(reportingPercent(counts)).toBe(67);
    expect(reportingPercent({ all: 0, PENDING: 0, LEADING: 0, WON: 0 })).toBe(0);
  });

  it('isLockLapsed: older than the TTL; an unparseable time never lapses', () => {
    const now = Date.parse('2026-10-01T10:00:00Z');
    expect(SEAT_LOCK_TTL_MS).toBe(120_000);
    expect(isLockLapsed({ acquired_at: '2026-10-01T09:57:59Z' }, now)).toBe(true);
    expect(isLockLapsed({ acquired_at: '2026-10-01T09:59:00Z' }, now)).toBe(false);
    expect(isLockLapsed({ acquired_at: 't' }, now)).toBe(false);
  });
});
```

- [ ] **Step 5: Write the failing readiness test** `admin/src/services/health.service.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { getReadiness } from './health.service';

afterEach(() => vi.unstubAllGlobals());

const degraded = {
  status: 'degraded',
  checks: { database: { status: 'healthy', latencyMs: 4 }, redis: { status: 'unhealthy', latencyMs: 2000 } },
  uptimeSeconds: 10, timestamp: '2026-10-01T10:00:00.000Z',
};

describe('getReadiness', () => {
  it('a 503 with a health body is a degraded result, not an error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503, json: async () => degraded })));
    await expect(getReadiness()).resolves.toMatchObject({ status: 'degraded', checks: { redis: { status: 'unhealthy' } } });
    expect(String((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0])).toMatch(/\/health\/ready$/);
  });

  it('a body without checks (e.g. a proxy error page) throws', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } })));
    await expect(getReadiness()).rejects.toThrow('Health check failed (502)');
  });
});
```

- [ ] **Step 6: Write the failing dashboard test** `admin/src/utils/dashboard.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import {
  ELECTION_PHASE, editingNow, groupElections, healthFromReadiness, healthFromStatus, lastUpdateSubtitle, leadingSubtitle, seatLookup, summarizeLive,
} from './dashboard';
import type { Election, LiveConstituency } from '../types';
import type { SystemStatus } from '../services/status.service';

const cand = (id: string, party: string, votes: number, status: string, last = '2026-10-01T09:00:00.000Z') => ({
  result_id: id, candidate_id: `c-${id}`, candidate_name: `Cand ${id}`, party_id: party, party_name: party, party_color: null,
  party_abbr: party, votes, status, margin: 0, last_updated: last,
});
const SEATS: LiveConstituency[] = [
  { const_id: 'k1', const_name: 'Valmiki Nagar', const_no: 1, const_type: 'GEN', current_round: null, total_rounds: null, candidates: [cand('a1', 'BJP', 0, 'TRAILING'), cand('a2', 'INC', 0, 'TRAILING')] },
  { const_id: 'k2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24, candidates: [cand('b1', 'BJP', 900, 'LEADING', '2026-10-01T09:58:00.000Z'), cand('b2', 'INC', 700, 'TRAILING')] },
  { const_id: 'k3', const_name: 'Bikram', const_no: 145, const_type: 'GEN', current_round: 6, total_rounds: 20, candidates: [cand('c1', 'BJP', 500, 'LEADING'), cand('c2', 'RJD', 400, 'TRAILING')] },
  { const_id: 'k4', const_name: 'Danapur', const_no: 143, const_type: 'GEN', current_round: 24, total_rounds: 24, candidates: [cand('d1', 'RJD', 800, 'WON'), cand('d2', 'BJP', 600, 'LOST')] },
];
const NOW = Date.parse('2026-10-01T10:00:00.000Z');

describe('summarizeLive', () => {
  it('counts seats, finds the party ahead, the newest update and the highest round', () => {
    const s = summarizeLive(SEATS);
    expect(s).toEqual({
      total: 4, declared: 1, leading: 2, pending: 1, reportingPct: 75,
      topLeader: { party: 'BJP', seats: 2 }, lastUpdate: '2026-10-01T09:58:00.000Z', round: 24,
    });
    expect(leadingSubtitle(s)).toBe('BJP ahead in 2 seats');
    expect(lastUpdateSubtitle(s, NOW)).toBe('2 min ago · Round 24');
  });

  it('an election with no votes yet', () => {
    const s = summarizeLive([SEATS[0]]);
    expect(s).toMatchObject({ total: 1, pending: 1, leading: 0, topLeader: null, lastUpdate: null, round: null, reportingPct: 0 });
    expect(leadingSubtitle(s)).toBe('no seat has a leader yet');
    expect(lastUpdateSubtitle(s, NOW)).toBe('no votes yet');
    expect(leadingSubtitle({ ...s, topLeader: { party: 'JDU', seats: 1 } })).toBe('JDU ahead in 1 seat');
  });
});

describe('editingNow and seatLookup', () => {
  it('names the seat for each live lock and drops lapsed ones', () => {
    const locks = [
      { const_id: 'k3', user_id: 'u1', user_name: 'Priya S', acquired_at: '2026-10-01T09:59:30.000Z' },
      { const_id: 'k2', user_id: 'u2', user_name: 'Rahul M', acquired_at: '2026-10-01T09:50:00.000Z' },
      { const_id: 'gone', user_id: 'u3', user_name: 'Mannu K', acquired_at: '2026-10-01T09:59:50.000Z' },
    ];
    expect(editingNow(locks, SEATS, NOW)).toEqual([
      { constId: 'k3', userName: 'Priya S', seat: '145 Bikram' },
      { constId: 'gone', userName: 'Mannu K', seat: 'gone' },
    ]);
  });

  it('seatLookup maps constituency and result ids', () => {
    const l = seatLookup(SEATS);
    expect(l.seatForConst('k2')).toBe('142 Patna Sahib');
    expect(l.seatForResult('c1')).toEqual({ seat: '145 Bikram', candidate: 'Cand c1' });
    expect(l.seatForConst('x')).toBeNull();
    expect(l.seatForResult('x')).toBeNull();
  });
});

describe('health summaries', () => {
  const status = {
    db: { ok: true, latencyMs: 12, pool: { connectionLimit: 5, poolTimeoutSeconds: null } },
    redis: { pubReady: true, subReady: true, publishes: 0, published: 0, publishErrors: 0 },
    live: { sseConnections: 1, eventsPublished: 0, overridesApplied: 0, overridesLast5m: 0, overridesPerMin: 18, lastOverrideAt: null },
  } as unknown as SystemStatus;

  it('from /admin/status (SUPER_ADMIN)', () => {
    expect(healthFromStatus(status)).toEqual({
      ok: true,
      rows: [
        { label: 'Database', detail: 'PostgreSQL', value: 'OK · 12 ms', ok: true },
        { label: 'Redis', detail: 'Cache and pub/sub', value: 'OK', ok: true },
        { label: 'Live updates (SSE)', detail: 'Admin streams', value: '1 connection', ok: true },
        { label: 'Overrides', detail: 'Last 5 min', value: '18 / min', ok: true },
      ],
    });
    const down = { ...status, redis: { ...status.redis, subReady: false } } as SystemStatus;
    expect(healthFromStatus(down).ok).toBe(false);
    expect(healthFromStatus(down).rows[1]).toEqual({ label: 'Redis', detail: 'Cache and pub/sub', value: 'Down', ok: false });
  });

  it('from /health/ready (EDITOR)', () => {
    const r = healthFromReadiness({ status: 'degraded', checks: { database: { status: 'healthy', latencyMs: 4 }, redis: { status: 'unhealthy', latencyMs: 2000 } } });
    expect(r).toEqual({
      ok: false,
      rows: [
        { label: 'Database', detail: 'PostgreSQL', value: 'OK · 4 ms', ok: true },
        { label: 'Redis', detail: 'Cache and pub/sub', value: 'Down', ok: false },
      ],
    });
  });
});

describe('elections overview', () => {
  const e = (id: string, status: Election['status']): Election => ({ id, name: id, type: 'VS', state_id: 1, year: 2025, status, tentative_next_date: null, manifest_url: null });
  it('groups by status and names each phase', () => {
    const g = groupElections([e('a', 'Live'), e('b', 'Upcoming'), e('c', 'Finalized'), e('d', 'Finalized')]);
    expect(g.live.map((x) => x.id)).toEqual(['a']);
    expect(g.upcoming.map((x) => x.id)).toEqual(['b']);
    expect(g.finalized.map((x) => x.id)).toEqual(['c', 'd']);
    expect(ELECTION_PHASE).toEqual({ Live: 'counting in progress', Upcoming: 'upcoming', Finalized: 'final results' });
  });
});
```

- [ ] **Step 7: Run all six to confirm they fail**

Run: `cd admin && npx vitest run src/utils/time.test.ts src/utils/audit.test.ts src/utils/feedback.test.ts src/utils/seat-math.test.ts src/services/health.service.test.ts src/utils/dashboard.test.ts`
Expected: FAIL. Each new file fails with "Failed to resolve import". `seat-math.test.ts` fails with "countSeats is not a function" (or a missing-export error).

- [ ] **Step 8: Fix the `AuditLog` type** in `admin/src/types/index.ts`. Replace the whole `AuditLog` interface with:

```ts
export interface AuditLog {
  id: string;
  /** null once the acting user is deleted (FK ON DELETE SET NULL); the entry is kept. */
  user_id: string | null;
  /** The acting user, as GET /admin/audit-logs includes it (`include: { users: … }`). */
  users?: Pick<User, 'id' | 'email' | 'name' | 'role'> | null;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value?: unknown;
  new_value?: unknown;
  timestamp: string;
}
```

Then make the minimal compile fix in `admin/src/pages/AuditLogs.tsx`, which Task 9 rewrites:
- Replace `${l.user?.name || l.user_id}` with `${l.users?.name || l.user_id || ''}`.
- Replace `{log.user?.name || log.user_id?.split('-')[0] || '-'}` with `{log.users?.name || log.user_id?.split('-')[0] || '-'}`.

- [ ] **Step 9: Export the badge tone type** in `admin/src/components/ui/Badge.tsx`. Change `type Tone = 'accent' | 'ok' | 'warn' | 'bad' | 'muted';` to:

```ts
export type Tone = 'accent' | 'ok' | 'warn' | 'bad' | 'muted';
```

- [ ] **Step 10: Create `admin/src/utils/time.ts`**

```ts
/** India Standard Time: admin dates are shown, and the audit day filter is read, in this zone. */
export const IST_TIME_ZONE = 'Asia/Kolkata';

const parse = (iso: string): Date | null => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t) : null;
};

/** "just now", "5 min ago", "3 h ago", "2 d ago". A future time reads "just now"; an unparseable one ''. */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const d = parse(iso);
  if (!d) return '';
  const s = Math.max(0, Math.floor((now - d.getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.floor(h / 24)} d ago`;
}

/** "01 Oct 2026, 14:32" — IST, 24-hour. */
export function formatIst(iso: string): string {
  const d = parse(iso);
  return d
    ? d.toLocaleString('en-IN', { timeZone: IST_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
}

/** "1 Oct 2026" — IST. */
export function formatIstDate(iso: string): string {
  const d = parse(iso);
  return d ? d.toLocaleDateString('en-IN', { timeZone: IST_TIME_ZONE, dateStyle: 'medium' }) : '';
}

/** "14:32:08" — IST, 24-hour. */
export function clockIst(iso: string): string {
  const d = parse(iso);
  return d ? d.toLocaleTimeString('en-GB', { timeZone: IST_TIME_ZONE, hour12: false }) : '';
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A `<input type="date">` value: YYYY-MM-DD. */
export const isIsoDay = (v: unknown): v is string => typeof v === 'string' && DAY.test(v);

/** First instant of an IST calendar day, with its offset (the backend compares with `gte`). '' when not a day. */
export const istDayStart = (day: string) => (isIsoDay(day) ? `${day}T00:00:00.000+05:30` : '');
/** Last millisecond of an IST calendar day (the backend compares with `lte`, so the day is included). */
export const istDayEnd = (day: string) => (isIsoDay(day) ? `${day}T23:59:59.999+05:30` : '');
```

- [ ] **Step 11: Create `admin/src/utils/audit.ts`**

```ts
import type { Tone } from '../components/ui/Badge';
import type { AuditLog } from '../types';

/** The actions the backend writes today (live/result-override, live/bulk-override, live/seat-lock). */
export const AUDIT_ACTIONS = [
  { value: 'RESULT_OVERRIDE', label: 'Result override' },
  { value: 'RESULT_BULK_OVERRIDE', label: 'Seat save (bulk)' },
  { value: 'SEAT_LOCK_TAKEOVER', label: 'Seat lock take-over' },
] as const;

/** Entity types of those actions: a result row, an election (bulk save), a constituency (lock). */
export const AUDIT_ENTITIES = [
  { value: 'result', label: 'Result' },
  { value: 'election', label: 'Election' },
  { value: 'constituency', label: 'Seat' },
] as const;

const humanise = (v: string) => {
  const s = v.replace(/_/g, ' ').toLowerCase().trim();
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};

export const actionLabel = (a: string) => AUDIT_ACTIONS.find((x) => x.value === a)?.label ?? humanise(a);
export const entityLabel = (t: string) => AUDIT_ENTITIES.find((x) => x.value === t)?.label ?? humanise(t);
export const isAuditAction = (v: unknown) => AUDIT_ACTIONS.some((x) => x.value === v);
export const isAuditEntity = (v: unknown) => AUDIT_ENTITIES.some((x) => x.value === v);

const TONE: Record<string, Tone> = { RESULT_OVERRIDE: 'accent', RESULT_BULK_OVERRIDE: 'accent', SEAT_LOCK_TAKEOVER: 'warn' };
export const actionTone = (a: string): Tone => TONE[a] ?? 'muted';

/** Who did it: the user's name, else their email, else "Deleted user" (the entry outlives the account). */
export function auditActor(log: AuditLog): string {
  return log.users?.name || log.users?.email || 'Deleted user';
}

/** Seat names for audit entities, from the selected election's live results (Dashboard). */
export interface SeatLookup {
  seatForConst(constId: string): string | null;
  seatForResult(resultId: string): { seat: string; candidate: string } | null;
}

const record = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const count = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

/** One readable sentence per entry, e.g. "Priya S took over 145 Bikram from Rahul M". Unknown seats fall back to generic words. */
export function describeAudit(log: AuditLog, lookup?: Partial<SeatLookup>): string {
  const who = auditActor(log);
  const before = record(log.old_value);
  const after = record(log.new_value);
  switch (log.action) {
    case 'SEAT_LOCK_TAKEOVER': {
      const seat = lookup?.seatForConst?.(log.entity_id) ?? 'a seat';
      const from = typeof before.user_name === 'string' && before.user_name ? ` from ${before.user_name}` : '';
      return `${who} took over ${seat}${from}`;
    }
    case 'RESULT_BULK_OVERRIDE': {
      if (typeof after.results_updated !== 'number') return `${who} saved results`;
      const rounds = typeof after.constituencies_with_rounds === 'number' && after.constituencies_with_rounds > 0
        ? ` and rounds for ${count(after.constituencies_with_rounds, 'seat')}`
        : '';
      return `${who} saved ${count(after.results_updated, 'result')}${rounds}`;
    }
    case 'RESULT_OVERRIDE': {
      const votes = typeof after.votes === 'number' ? ` to ${after.votes.toLocaleString('en-IN')} votes` : '';
      const hit = lookup?.seatForResult?.(log.entity_id);
      return hit ? `${who} set ${hit.candidate} in ${hit.seat}${votes}` : `${who} overrode a result${votes}`;
    }
    default:
      return `${who}: ${actionLabel(log.action)} · ${entityLabel(log.entity_type)} ${log.entity_id}`;
  }
}
```

- [ ] **Step 12: Create `admin/src/utils/feedback.ts`**

```ts
import type { Tone } from '../components/ui/Badge';
import type { FeedbackKind, FeedbackStatus } from '../types';

/** Kind badges (NOTES.md): bug rose, data error amber, suggestion indigo, other slate. */
export const FEEDBACK_KINDS: Record<FeedbackKind, { label: string; tone: Tone }> = {
  bug: { label: 'Bug', tone: 'bad' },
  data_error: { label: 'Data error', tone: 'warn' },
  suggestion: { label: 'Suggestion', tone: 'accent' },
  other: { label: 'Other', tone: 'muted' },
};

export const kindMeta = (kind: string): { label: string; tone: Tone } => FEEDBACK_KINDS[kind as FeedbackKind] ?? { label: kind, tone: 'muted' };

export const FEEDBACK_STATUSES: FeedbackStatus[] = ['new', 'read', 'resolved'];
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = { new: 'New', read: 'Read', resolved: 'Resolved' };
export const FEEDBACK_STATUS_TONE: Record<FeedbackStatus, Tone> = { new: 'accent', read: 'muted', resolved: 'ok' };
export const isFeedbackStatus = (v: unknown): v is FeedbackStatus => FEEDBACK_STATUSES.includes(v as FeedbackStatus);

/** First non-empty line of a message, trimmed, cut to `max` characters with an ellipsis. */
export function firstLine(message: string, max = 120): string {
  const line = message.split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? '';
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
```

- [ ] **Step 13: Create `admin/src/components/feedback/FeedbackKindBadge.tsx`**

```tsx
import { Badge } from '../ui/Badge';
import { kindMeta } from '../../utils/feedback';

export function FeedbackKindBadge({ kind }: { kind: string }) {
  const { label, tone } = kindMeta(kind);
  return <Badge tone={tone}>{label}</Badge>;
}
```

  Add `@source "../components/feedback";` to `admin/src/theme/tailwind.css`, directly after `@source "../components/routing";`.

- [ ] **Step 14: Add the seat helpers** to `admin/src/utils/seat-math.ts`. Append at the end of the file:

```ts
/** Mirrors the backend SEAT_LOCK_TTL_SECONDS: an older lock has lapsed (heartbeats re-publish a fresh acquired_at). */
export const SEAT_LOCK_TTL_MS = 120_000;

/** The lock is older than the TTL. An unparseable acquired_at never lapses (the server decides). */
export function isLockLapsed(lock: { acquired_at: string }, now: number): boolean {
  const t = Date.parse(lock.acquired_at);
  return Number.isFinite(t) && now - t > SEAT_LOCK_TTL_MS;
}

export interface SeatCounts { all: number; PENDING: number; LEADING: number; WON: number }

/** Seats per status, for the filter chips and the Dashboard KPIs. */
export function countSeats(seats: LiveConstituency[]): SeatCounts {
  const out: SeatCounts = { all: seats.length, PENDING: 0, LEADING: 0, WON: 0 };
  seats.forEach((s) => { out[seatStatus(s)]++; });
  return out;
}

/** % of seats with any votes (leading or declared), rounded. */
export function reportingPercent(counts: SeatCounts): number {
  return counts.all === 0 ? 0 : Math.round(((counts.LEADING + counts.WON) / counts.all) * 100);
}
```

- [ ] **Step 15: Use them in `admin/src/hooks/useLiveConsole.ts`.**

  a. Replace the import `import { seatStatus, type BulkOverrideItem } from '../utils/seat-math';` with:

```ts
import { countSeats, isLockLapsed, reportingPercent, seatStatus, SEAT_LOCK_TTL_MS, type BulkOverrideItem } from '../utils/seat-math';
```

  b. Replace these lines:

```ts
/** Mirrors the backend SEAT_LOCK_TTL_SECONDS: an older lock has lapsed (heartbeats re-publish a fresh acquired_at). */
export const SEAT_LOCK_TTL_MS = 120_000;
const LOCK_SWEEP_MS = 15_000;
const isLapsed = (l: SeatLock, now: number) => {
  const t = Date.parse(l.acquired_at);
  return Number.isFinite(t) && now - t > SEAT_LOCK_TTL_MS;
};
```

with:

```ts
/** Kept for existing imports; the constant now lives in utils/seat-math. */
export { SEAT_LOCK_TTL_MS };
const LOCK_SWEEP_MS = 15_000;
```

  c. In the `locks` memo, replace `!isLapsed(l, now)` with `!isLockLapsed(l, now)`.

  d. Replace the `counts` memo with:

```ts
  const counts = useMemo(() => countSeats(all), [all]);
```

  e. Replace `const reportingPct = all.length === 0 ? 0 : Math.round(((counts.LEADING + counts.WON) / all.length) * 100);` with:

```ts
  const reportingPct = reportingPercent(counts);
```

- [ ] **Step 16: Create `admin/src/services/health.service.ts`**

```ts
import { API_BASE_URL } from './api-client';

export interface ReadinessCheck { status: 'healthy' | 'unhealthy'; latencyMs: number }
export interface Readiness { status: 'healthy' | 'degraded'; checks: { database: ReadinessCheck; redis: ReadinessCheck } }

/**
 * GET /health/ready (public). A degraded check answers 503 with the same JSON body, so this reads the body
 * whatever the status (apiFetch would throw on the 503). Anything without `checks` is an error.
 */
export async function getReadiness(): Promise<Readiness> {
  const res = await fetch(`${API_BASE_URL}/health/ready`, { cache: 'no-store' });
  const body: unknown = await res.json().catch(() => null);
  const checks = (body as Partial<Readiness> | null)?.checks;
  if (checks?.database && checks?.redis) return body as Readiness;
  throw new Error(`Health check failed (${res.status})`);
}
```

- [ ] **Step 17: Create `admin/src/utils/dashboard.ts`**

```ts
import type { Election, LiveConstituency, SeatLock } from '../types';
import type { SystemStatus } from '../services/status.service';
import type { Readiness } from '../services/health.service';
import type { SeatLookup } from './audit';
import { countSeats, isLockLapsed, reportingPercent, seatStatus } from './seat-math';
import { timeAgo } from './time';

export interface LiveSummary {
  total: number;
  declared: number;
  /** Seats with votes and a leader, not declared yet. */
  leading: number;
  /** Seats with no votes yet. */
  pending: number;
  reportingPct: number;
  /** Party leading in the most undeclared seats. */
  topLeader: { party: string; seats: number } | null;
  /** Newest `last_updated` of any candidate with votes. */
  lastUpdate: string | null;
  /** Highest current round reported by any seat. */
  round: number | null;
}

const count = (n: number, word: string) => `${n.toLocaleString('en-IN')} ${word}${n === 1 ? '' : 's'}`;

/** KPI numbers for the selected election, from GET /admin/elections/:id/live-results. */
export function summarizeLive(seats: LiveConstituency[]): LiveSummary {
  const counts = countSeats(seats);
  const ahead = new Map<string, number>();
  let lastUpdate: string | null = null;
  let lastAt = -Infinity;
  let round: number | null = null;
  for (const s of seats) {
    if (seatStatus(s) === 'LEADING') {
      const lead = s.candidates.find((c) => c.status === 'LEADING');
      if (lead) {
        const party = lead.party_abbr || lead.party_id;
        ahead.set(party, (ahead.get(party) ?? 0) + 1);
      }
    }
    if (s.current_round !== null && (round === null || s.current_round > round)) round = s.current_round;
    for (const c of s.candidates) {
      if (c.votes <= 0) continue;
      const t = Date.parse(c.last_updated);
      if (Number.isFinite(t) && t > lastAt) { lastAt = t; lastUpdate = c.last_updated; }
    }
  }
  let topLeader: LiveSummary['topLeader'] = null;
  for (const [party, n] of ahead) if (!topLeader || n > topLeader.seats) topLeader = { party, seats: n };
  return {
    total: counts.all, declared: counts.WON, leading: counts.LEADING, pending: counts.PENDING,
    reportingPct: reportingPercent(counts), topLeader, lastUpdate, round,
  };
}

/** "BJP ahead in 62 seats". */
export const leadingSubtitle = (s: LiveSummary) =>
  (s.topLeader ? `${s.topLeader.party} ahead in ${count(s.topLeader.seats, 'seat')}` : 'no seat has a leader yet');

/** "2 min ago · Round 4". */
export const lastUpdateSubtitle = (s: LiveSummary, now: number) =>
  (s.lastUpdate ? [timeAgo(s.lastUpdate, now), s.round !== null ? `Round ${s.round}` : null].filter(Boolean).join(' · ') : 'no votes yet');

export interface EditingNow { constId: string; userName: string; seat: string }

/** "Seats being edited now": live (not lapsed) locks, each with its seat's number and name. */
export function editingNow(locks: SeatLock[], seats: LiveConstituency[], now: number): EditingNow[] {
  const byId = new Map(seats.map((s) => [s.const_id, s]));
  return locks
    .filter((l) => !isLockLapsed(l, now))
    .map((l) => {
      const s = byId.get(l.const_id);
      return { constId: l.const_id, userName: l.user_name, seat: s ? `${s.const_no} ${s.const_name}` : l.const_id };
    });
}

/** Seat names for audit sentences (Recent activity). */
export function seatLookup(seats: LiveConstituency[]): SeatLookup {
  const byConst = new Map<string, string>();
  const byResult = new Map<string, { seat: string; candidate: string }>();
  for (const s of seats) {
    const seat = `${s.const_no} ${s.const_name}`;
    byConst.set(s.const_id, seat);
    for (const c of s.candidates) byResult.set(c.result_id, { seat, candidate: c.candidate_name });
  }
  return { seatForConst: (id) => byConst.get(id) ?? null, seatForResult: (id) => byResult.get(id) ?? null };
}

export interface HealthRow { label: string; detail: string; value: string; ok: boolean }
export interface HealthSummary { ok: boolean; rows: HealthRow[] }

/** SUPER_ADMIN: from GET /admin/status. */
export function healthFromStatus(s: SystemStatus): HealthSummary {
  const redisOk = s.redis.pubReady && s.redis.subReady;
  return {
    ok: s.db.ok && redisOk,
    rows: [
      { label: 'Database', detail: 'PostgreSQL', value: s.db.ok ? `OK · ${s.db.latencyMs} ms` : 'Down', ok: s.db.ok },
      { label: 'Redis', detail: 'Cache and pub/sub', value: redisOk ? 'OK' : 'Down', ok: redisOk },
      { label: 'Live updates (SSE)', detail: 'Admin streams', value: count(s.live.sseConnections, 'connection'), ok: true },
      { label: 'Overrides', detail: 'Last 5 min', value: `${s.live.overridesPerMin} / min`, ok: true },
    ],
  };
}

/** Everyone else: from the public GET /health/ready. */
export function healthFromReadiness(r: Readiness): HealthSummary {
  const row = (label: string, detail: string, c: Readiness['checks']['database']): HealthRow => {
    const ok = c.status === 'healthy';
    return { label, detail, value: ok ? `OK · ${c.latencyMs} ms` : 'Down', ok };
  };
  const rows = [row('Database', 'PostgreSQL', r.checks.database), row('Redis', 'Cache and pub/sub', r.checks.redis)];
  return { ok: r.status === 'healthy' && rows.every((x) => x.ok), rows };
}

/** Header suffix: "Bihar VS 2025 · counting in progress". */
export const ELECTION_PHASE: Record<Election['status'], string> = {
  Live: 'counting in progress',
  Upcoming: 'upcoming',
  Finalized: 'final results',
};

export function groupElections(elections: Election[]) {
  return {
    live: elections.filter((e) => e.status === 'Live'),
    upcoming: elections.filter((e) => e.status === 'Upcoming'),
    finalized: elections.filter((e) => e.status === 'Finalized'),
  };
}
```

- [ ] **Step 18: Run the helper tests**

Run: `cd admin && npx vitest run src/utils/time.test.ts src/utils/audit.test.ts src/utils/feedback.test.ts src/utils/seat-math.test.ts src/services/health.service.test.ts src/utils/dashboard.test.ts`
Expected: PASS for all six files. `useLiveConsole.test.ts` still reports `reportingPct` 67; run it too:

Run: `cd admin && npx vitest run src/hooks/useLiveConsole.test.ts`
Expected: PASS.

- [ ] **Step 19: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.
- `SeatLock` is still used by `useLiveConsole.ts` (its `rawLocks` state), so its import stays.
- The `AuditLogs.tsx` compile fix type-checks.

- [ ] **Step 20: Commit**

```bash
git add admin/src/utils admin/src/services/health.service.ts admin/src/services/health.service.test.ts admin/src/components/feedback admin/src/components/ui/Badge.tsx admin/src/types/index.ts admin/src/hooks/useLiveConsole.ts admin/src/pages/AuditLogs.tsx admin/src/theme/tailwind.css
git commit -m "admin: shared helpers for IST time, audit wording, feedback kinds, seat counts, dashboard summaries; AuditLog reads users

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Dashboard (role-gated cards, 30 s refresh while visible)

This task covers spec §2, decisions §3, `docs/design/admin/dashboard.png` and the NOTES fixes.

**Header:** "Dashboard", then `<short election name> · <phase>`. The phase is "counting in progress" (Live), "upcoming" or "final results".

**SUPER_ADMIN and EDITOR** see, for the global election:
- **KPI row.**
  - Seats declared: N / M, with a progress bar.
  - Leading: the number of undeclared seats with a leader, with subtitle "<party> ahead in N seats".
  - Pending, with subtitle "no votes yet".
  - Last update: an IST clock, with subtitle "N min ago · Round R", where R is the highest `current_round`.
  - All derived client-side from `GET /admin/elections/:id/live-results`.
- **Live console card.**
  - "Counting progress · X% of seats reporting".
  - "Seats being edited now: N", with a chip "<user> · <no> <seat>" per live lock (`GET /admin/live/locks`, lapsed locks dropped). A 503 there reads "Seat locking unavailable".
  - An "Open live console" link.
- **System health card.** SUPER_ADMIN gets a summary of `/admin/status` and an "Open system status" link. EDITOR gets the public `/health/ready` and no link.
- **Feedback card.**
  - `GET /admin/feedback?status=new&limit=3`, with a badge "N new".
  - Three previews, each showing a kind badge, the first line of the message, the page path in monospace (plain text) and the relative time. No names.
  - A "View all feedback" link.

**SUPER_ADMIN only:** **Recent activity**, the last 10 entries of `GET /admin/audit-logs` in readable sentences, with a "View audit log" link.

**VIEWER:** only the elections overview, from the already-loaded `useElection().elections`:
- Live / Upcoming / Finalized counts
- the three lists

**Behaviour:**
- No VIEWER request touches an admin endpoint, and no 403 is ever turned into a number.
- Each card has its own loading, error (with "Try again") and empty state.
- A failed refresh keeps the earlier data and says so.
- Everything refreshes every 30 s while the tab is visible and pauses while it is hidden.
- The page root scrolls (`h-full overflow-y-auto`).

`/` joins `BARE_PATHS`. `isBare` already matches it exactly, because `'/' + '/'` is `'//'`.

**Files:**
- Create: `admin/src/hooks/useVisiblePoll.ts`, `admin/src/hooks/useDashboard.ts`
- Rewrite: `admin/src/pages/Dashboard.tsx`
- Delete: `admin/src/hooks/useDashboardManager.ts`
- Modify: `admin/src/components/Layout.tsx` (export `isBare`, append `'/'`), `admin/src/theme/tailwind.css` (`@source "../pages/Dashboard.tsx"`)
- Test: `admin/src/hooks/useVisiblePoll.test.ts`, `admin/src/pages/Dashboard.test.tsx`, `admin/src/components/Layout.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 5:
    - `summarizeLive`, `leadingSubtitle`, `lastUpdateSubtitle`, `editingNow`, `seatLookup`, `healthFromStatus`, `healthFromReadiness`, `ELECTION_PHASE`, `groupElections`, `HealthSummary`, `LiveSummary`
    - `describeAudit`, `auditActor`
    - `firstLine`, `FeedbackKindBadge`
    - `clockIst`, `formatIstDate`, `timeAgo`
    - `getReadiness`
  - existing services:
    - `getLiveResults(electionId)`, `getSeatLocks(electionId)` (`election.service`)
    - `getAuditLogs()` (`audit.service`)
    - `getSystemStatus()` (`status.service`)
    - `getFeedback(page, limit, status)` (`feedback.service`)
  - `useAuth().hasRole`; `useElection()` → `{ electionId, election, elections, loading, error, reload }`
  - `NoElection`, `shortElectionName`, `Badge`, `Button`, `EmptyState`, `cn`
- Produces:
  - `useVisiblePoll(tick: () => void, ms: number, enabled?: boolean): void`. It does not tick on mount, ticks every `ms` while visible, stops while hidden, and ticks once when the tab becomes visible again.
  - `hooks/useDashboard.ts`:
    - constants `DASHBOARD_REFRESH_MS = 30_000`, `RECENT_ACTIVITY = 10`, `FEEDBACK_PREVIEWS = 3`
    - types `CardState<T> = { data: T | null; loading: boolean; error: string | null; reload(): Promise<void> }`, `SeatLocksData = { available: boolean; locks: SeatLock[] }` and `FeedbackPreview = { count: number; items: Feedback[] }`
    - `useDashboard()` returns `{ isSuper, canEdit, electionId, election, elections, electionsLoading, electionsError, reloadElections, now, live, summary, locks, editing, activity, lookup, health, feedback, refreshAll }`
  - `isBare(pathname: string): boolean`, exported from `components/Layout.tsx`.

- [ ] **Step 1: Write the failing poll test** `admin/src/hooks/useVisiblePoll.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useVisiblePoll } from './useVisiblePoll';

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => { setHidden(false); vi.useRealTimers(); });

describe('useVisiblePoll', () => {
  it('ticks every interval while visible, pauses while hidden, and ticks once on return', () => {
    const tick = vi.fn();
    renderHook(() => useVisiblePoll(tick, 30_000));
    expect(tick).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => setHidden(true));
    act(() => { vi.advanceTimersByTime(120_000); });
    expect(tick).toHaveBeenCalledTimes(1);
    act(() => setHidden(false));
    expect(tick).toHaveBeenCalledTimes(2);
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(tick).toHaveBeenCalledTimes(3);
  });

  it('uses the latest callback and does nothing when disabled', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn, on }) => useVisiblePoll(fn, 1000, on), { initialProps: { fn: first, on: true } });
    rerender({ fn: second, on: true });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    rerender({ fn: second, on: false });
    act(() => { vi.advanceTimersByTime(5000); });
    expect(second).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Write the failing layout test** `admin/src/components/Layout.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isBare } from './Layout';

describe('isBare', () => {
  it('"/" (Dashboard) is bare only as an exact path; it does not make every route bare', () => {
    expect(isBare('/')).toBe(true);
    expect(isBare('/parties')).toBe(true);
    expect(isBare('/parties/BJP')).toBe(true);
    expect(isBare('/nowhere')).toBe(false);
  });
});
```

- [ ] **Step 3: Write the failing page test** `admin/src/pages/Dashboard.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Election } from '../types';

const svc = vi.hoisted(() => ({
  getLiveResults: vi.fn(),
  getSeatLocks: vi.fn(),
  getAuditLogs: vi.fn(),
  getSystemStatus: vi.fn(),
  getReadiness: vi.fn(),
  getFeedback: vi.fn(),
  getUsers: vi.fn(),
}));
vi.mock('../services/election.service', () => ({ getLiveResults: svc.getLiveResults, getSeatLocks: svc.getSeatLocks }));
vi.mock('../services/audit.service', () => ({ getAuditLogs: svc.getAuditLogs }));
vi.mock('../services/status.service', () => ({ getSystemStatus: svc.getSystemStatus }));
vi.mock('../services/health.service', () => ({ getReadiness: svc.getReadiness }));
vi.mock('../services/feedback.service', () => ({ getFeedback: svc.getFeedback }));
vi.mock('../services/user.service', () => ({ getUsers: svc.getUsers }));

const ELECTIONS: Election[] = [
  { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 1, year: 2025, status: 'Live', tentative_next_date: null, manifest_url: null },
  { id: 'e2', name: 'Kerala Vidhan Sabha 2026', type: 'VS', state_id: 2, year: 2026, status: 'Upcoming', tentative_next_date: '2026-04-20T00:00:00.000Z', manifest_url: null },
  { id: 'e3', name: 'Lok Sabha 2024', type: 'LS', state_id: null, year: 2024, status: 'Finalized', tentative_next_date: null, manifest_url: null },
];
const ctx = vi.hoisted(() => ({ electionId: 'e1', loading: false, error: null as string | null, reload: vi.fn(async () => {}), list: [] as unknown[] }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({
    elections: ctx.list, electionId: ctx.electionId,
    election: (ctx.list as Election[]).find((e) => e.id === ctx.electionId) ?? null,
    setElectionId: vi.fn(), loading: ctx.loading, error: ctx.error, reload: ctx.reload,
  }),
}));
const auth = vi.hoisted(() => ({ roles: ['SUPER_ADMIN'] as string[] }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Mannu K', role: auth.roles[0], email: 'm@x.in' }, hasRole: (...r: string[]) => r.some((x) => auth.roles.includes(x)) }),
}));
import Dashboard from './Dashboard';
import { ApiError } from '../services/api-client';

// Mid-minute offsets (2.5 min, 4.5 min): the fixtures are built a few ms after the page reads `now`.
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();
const cand = (id: string, party: string, votes: number, status: string, last = ago(3_600_000)) => ({
  result_id: id, candidate_id: `c-${id}`, candidate_name: `Cand ${id}`, party_id: party, party_name: party, party_color: null,
  party_abbr: party, votes, status, margin: 0, last_updated: last,
});
const seats = () => [
  { const_id: 'k1', const_name: 'Valmiki Nagar', const_no: 1, const_type: 'GEN', current_round: null, total_rounds: null, candidates: [cand('a1', 'BJP', 0, 'TRAILING')] },
  { const_id: 'k2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24, candidates: [cand('b1', 'BJP', 900, 'LEADING', ago(150_000)), cand('b2', 'INC', 700, 'TRAILING')] },
  { const_id: 'k3', const_name: 'Bikram', const_no: 145, const_type: 'GEN', current_round: 6, total_rounds: 20, candidates: [cand('c1', 'BJP', 500, 'LEADING'), cand('c2', 'RJD', 400, 'TRAILING')] },
  { const_id: 'k4', const_name: 'Danapur', const_no: 143, const_type: 'GEN', current_round: 24, total_rounds: 24, candidates: [cand('d1', 'RJD', 800, 'WON'), cand('d2', 'BJP', 600, 'LOST')] },
];
const STATUS = {
  db: { ok: true, latencyMs: 12, pool: { connectionLimit: 5, poolTimeoutSeconds: null } },
  redis: { pubReady: true, subReady: true, publishes: 0, published: 0, publishErrors: 0 },
  live: { sseConnections: 3, eventsPublished: 0, overridesApplied: 0, overridesLast5m: 0, overridesPerMin: 18, lastOverrideAt: null },
};
const FEEDBACK = () => ({
  success: true,
  data: [
    { id: 'f1', kind: 'bug', message: 'Round 2 total is wrong\nPlease check', email: 'a@b.in', page: '/elections/e1/seat/142', status: 'new', createdAt: ago(600_000) },
    { id: 'f2', kind: 'data_error', message: 'Margin looks off', email: null, page: null, status: 'new', createdAt: ago(1_680_000) },
  ],
  pagination: { page: 1, limit: 3, total: 5, totalPages: 2 },
});

const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  auth.roles = ['SUPER_ADMIN'];
  ctx.electionId = 'e1'; ctx.loading = false; ctx.error = null; ctx.list = ELECTIONS;
  svc.getLiveResults.mockImplementation(async () => seats());
  svc.getSeatLocks.mockImplementation(async () => [{ const_id: 'k3', user_id: 'u1', user_name: 'Priya S', acquired_at: new Date().toISOString() }]);
  svc.getAuditLogs.mockImplementation(async () => [{
    id: 'l1', user_id: 'u1', users: { id: 'u1', email: 'p@x.in', name: 'Priya S', role: 'EDITOR' },
    action: 'SEAT_LOCK_TAKEOVER', entity_type: 'constituency', entity_id: 'k3', old_value: { user_name: 'Rahul M' }, new_value: null, timestamp: ago(270_000),
  }]);
  svc.getSystemStatus.mockImplementation(async () => STATUS);
  svc.getReadiness.mockImplementation(async () => ({ status: 'healthy', checks: { database: { status: 'healthy', latencyMs: 4 }, redis: { status: 'healthy', latencyMs: 2 } } }));
  svc.getFeedback.mockImplementation(async () => FEEDBACK());
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.useRealTimers(); });

const renderDashboard = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);
const region = (name: string) => screen.getByRole('region', { name });
const ADMIN_CALLS = ['getLiveResults', 'getSeatLocks', 'getAuditLogs', 'getSystemStatus', 'getReadiness', 'getFeedback', 'getUsers'] as const;

describe('Dashboard — SUPER_ADMIN', () => {
  it('shows the KPIs, live console, readable activity, system health and new feedback', async () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByText('Bihar VS 2025 · counting in progress')).toBeTruthy();
    expect(await screen.findByText('BJP ahead in 2 seats')).toBeTruthy();
    expect(region('Seats declared').textContent).toContain('1 / 4');
    expect(within(region('Leading')).getByText('2')).toBeTruthy();
    expect(within(region('Pending')).getByText('no votes yet')).toBeTruthy();
    expect(within(region('Last update')).getByText('2 min ago · Round 24')).toBeTruthy();

    const live = region('Live console');
    expect(within(live).getByText('Counting progress · 75% of seats reporting')).toBeTruthy();
    expect(await within(live).findByText('Seats being edited now: 1')).toBeTruthy();
    expect(within(live).getByText('Priya S · 145 Bikram')).toBeTruthy();
    expect(within(live).getByRole('link', { name: /Open live console/ }).getAttribute('href')).toBe('/overrides');

    const activity = region('Recent activity');
    expect(await within(activity).findByText('Priya S took over 145 Bikram from Rahul M')).toBeTruthy();
    expect(within(activity).getByText('4 min ago')).toBeTruthy();
    expect(within(activity).getByRole('link', { name: /View audit log/ }).getAttribute('href')).toBe('/logs');

    const health = region('System health');
    expect(await within(health).findByText('All OK')).toBeTruthy();
    expect(within(health).getByText('OK · 12 ms')).toBeTruthy();
    expect(within(health).getByText('3 connections')).toBeTruthy();
    expect(within(health).getByRole('link', { name: /Open system status/ }).getAttribute('href')).toBe('/status');

    const feedback = region('Feedback');
    expect(await within(feedback).findByText('5 new')).toBeTruthy();
    expect(within(feedback).getByText('Bug')).toBeTruthy();
    expect(within(feedback).getByText('Data error')).toBeTruthy();
    expect(within(feedback).getByText('Round 2 total is wrong')).toBeTruthy();
    expect(within(feedback).getByText('/elections/e1/seat/142').tagName).toBe('P');
    expect(within(feedback).queryByRole('link', { name: /elections\/e1/ })).toBeNull();
    expect(within(feedback).getByRole('link', { name: /View all feedback/ }).getAttribute('href')).toBe('/feedback');
    expect(svc.getFeedback).toHaveBeenCalledWith(1, 3, 'new');
    expect(svc.getUsers).not.toHaveBeenCalled();
  });
});

describe('Dashboard — role gating (Review Focus 1)', () => {
  it('an EDITOR never requests audit logs or /admin/status and has no Recent activity card', async () => {
    auth.roles = ['EDITOR'];
    renderDashboard();
    expect(await within(region('System health')).findByText('All OK')).toBeTruthy();
    expect(await within(region('Feedback')).findByText('5 new')).toBeTruthy();
    expect(svc.getAuditLogs).not.toHaveBeenCalled();
    expect(svc.getSystemStatus).not.toHaveBeenCalled();
    expect(svc.getReadiness).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Recent activity' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Open system status/ })).toBeNull();
    expect(within(region('System health')).getByText('OK · 4 ms')).toBeTruthy();
  });

  it('a VIEWER sees only the elections overview and no admin endpoint is called', async () => {
    auth.roles = ['VIEWER'];
    renderDashboard();
    expect(screen.getByText('Elections at a glance')).toBeTruthy();
    expect(within(region('Live')).getByText('1')).toBeTruthy();
    expect(within(region('Upcoming')).getByText('1')).toBeTruthy();
    expect(within(region('Finalized')).getByText('1')).toBeTruthy();
    expect(within(region('Live now')).getByText('Bihar Vidhan Sabha 2025')).toBeTruthy();
    expect(within(region('Upcoming elections')).getByText('Kerala Vidhan Sabha 2026')).toBeTruthy();
    expect(within(region('Upcoming elections')).getByText('20 Apr 2026')).toBeTruthy();
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    for (const fn of ADMIN_CALLS) expect(svc[fn]).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Seats declared' })).toBeNull();
    expect(screen.queryByText(/^0$/)).toBeNull();
  });
});

describe('Dashboard — card states', () => {
  it('a degraded readiness check says so (EDITOR)', async () => {
    auth.roles = ['EDITOR'];
    svc.getReadiness.mockResolvedValueOnce({ status: 'degraded', checks: { database: { status: 'healthy', latencyMs: 4 }, redis: { status: 'unhealthy', latencyMs: 2000 } } });
    renderDashboard();
    const health = region('System health');
    expect(await within(health).findByText('Degraded')).toBeTruthy();
    expect(within(health).getByText('Down')).toBeTruthy();
  });

  it('one failing card shows its own error with Try again; the others still load', async () => {
    svc.getFeedback.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    renderDashboard();
    const feedback = region('Feedback');
    expect((await within(feedback).findByRole('alert')).textContent).toContain('Could not load feedback');
    expect(await within(region('System health')).findByText('All OK')).toBeTruthy();
    fireEvent.click(within(feedback).getByRole('button', { name: 'Try again' }));
    expect(await within(feedback).findByText('5 new')).toBeTruthy();
    expect(svc.getFeedback).toHaveBeenCalledTimes(2);
  });

  it('seat locking down (503) reads "Seat locking unavailable"', async () => {
    svc.getSeatLocks.mockRejectedValueOnce(new ApiError('Seat locking is unavailable', 503));
    renderDashboard();
    expect(await within(region('Live console')).findByText('Seat locking unavailable')).toBeTruthy();
  });

  it('with no election, shows the one empty state and loads no live data', async () => {
    ctx.electionId = '';
    ctx.list = [];
    renderDashboard();
    expect(screen.getByText('No election yet')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create an election' }).getAttribute('href')).toBe('/elections/new');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(svc.getLiveResults).not.toHaveBeenCalled();
  });

  it('refreshes every 30 s while the tab is visible and pauses while hidden', async () => {
    vi.useFakeTimers();
    try {
      renderDashboard();
      await act(async () => { await vi.advanceTimersByTimeAsync(0); });
      expect(svc.getFeedback).toHaveBeenCalledTimes(1);
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(svc.getFeedback).toHaveBeenCalledTimes(2);
      expect(svc.getLiveResults).toHaveBeenCalledTimes(2);
      expect(ctx.reload).toHaveBeenCalledTimes(1);
      act(() => setHidden(true));
      await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
      expect(svc.getFeedback).toHaveBeenCalledTimes(2);
      await act(async () => { setHidden(false); await vi.advanceTimersByTimeAsync(0); });
      expect(svc.getFeedback).toHaveBeenCalledTimes(3);
    } finally {
      setHidden(false);
    }
  });
});
```

- [ ] **Step 4: Run them to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/useVisiblePoll.test.ts src/components/Layout.test.tsx src/pages/Dashboard.test.tsx`
Expected: FAIL:
- "Failed to resolve import './useVisiblePoll'".
- `isBare` is not exported (`isBare is not a function`).
- The Dashboard test finds "System Dashboard" instead of "Dashboard", and has no regions.

- [ ] **Step 5: Create `admin/src/hooks/useVisiblePoll.ts`**

```ts
import { useEffect, useRef } from 'react';

/**
 * Calls `tick` every `ms` while the tab is visible. Paused while hidden; ticks once when the tab comes back.
 * Does not tick on mount (the caller does its first load itself). The latest `tick` is always used.
 */
export function useVisiblePoll(tick: () => void, ms: number, enabled = true): void {
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(() => {
    if (!enabled) return undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (timer === undefined) timer = setInterval(() => tickRef.current(), ms); };
    const stop = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
    const onVisibility = () => {
      if (document.hidden) stop();
      else { tickRef.current(); start(); }
    };
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [ms, enabled]);
}
```

- [ ] **Step 6: Create `admin/src/hooks/useDashboard.ts`**

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { getLiveResults, getSeatLocks } from '../services/election.service';
import { getAuditLogs } from '../services/audit.service';
import { getSystemStatus } from '../services/status.service';
import { getReadiness } from '../services/health.service';
import { getFeedback } from '../services/feedback.service';
import { ApiError } from '../services/api-client';
import { describeError } from '../utils/api-error';
import { editingNow, healthFromReadiness, healthFromStatus, seatLookup, summarizeLive, type HealthSummary } from '../utils/dashboard';
import { useVisiblePoll } from './useVisiblePoll';
import type { AuditLog, Feedback, LiveConstituency, SeatLock } from '../types';

export const DASHBOARD_REFRESH_MS = 30_000;
export const RECENT_ACTIVITY = 10;
export const FEEDBACK_PREVIEWS = 3;

export interface CardState<T> { data: T | null; loading: boolean; error: string | null; reload: () => Promise<void> }
export interface SeatLocksData { available: boolean; locks: SeatLock[] }
export interface FeedbackPreview { count: number; items: Feedback[] }

/**
 * One dashboard card's data. `loader` null means this role cannot see the card, so nothing is requested.
 * A change of `key` (election, role) starts over; a failed refresh keeps the earlier data. Only the latest
 * request's answer is applied.
 */
function useCard<T>(loader: (() => Promise<T>) | null, key: string, fallback: string): CardState<T> {
  const [state, setState] = useState<Omit<CardState<T>, 'reload'>>({ data: null, loading: !!loader, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const run = loaderRef.current;
    if (!run) return;
    const request = ++latest.current;
    setState((s) => ({ ...s, loading: true }));
    try {
      const data = await run();
      if (request === latest.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (request === latest.current) setState((s) => ({ data: s.data, loading: false, error: describeError(err, fallback) }));
    }
  }, [fallback]);

  useEffect(() => {
    latest.current++;
    setState({ data: null, loading: !!loaderRef.current, error: null });
    void reload();
  }, [key, reload]);

  return { ...state, reload };
}

/**
 * CONTROLLER: Dashboard. Cards are gated by role (spec §2, decisions §3):
 * SUPER_ADMIN everything; EDITOR without Recent activity and with the public readiness check;
 * VIEWER none of these (the page shows the elections overview from ElectionContext).
 */
export function useDashboard() {
  const { hasRole } = useAuth();
  const { electionId, election, elections, loading: electionsLoading, error: electionsError, reload: reloadElections } = useElection();
  const isSuper = hasRole('SUPER_ADMIN');
  const canEdit = hasRole('SUPER_ADMIN', 'EDITOR');
  const liveId = canEdit ? electionId : '';

  const live = useCard<LiveConstituency[]>(liveId ? () => getLiveResults(liveId) : null, `live:${liveId}`, 'Could not load live results');
  const locks = useCard<SeatLocksData>(
    liveId
      ? async () => {
        try {
          return { available: true, locks: await getSeatLocks(liveId) };
        } catch (err) {
          // Redis down: locking is off (the Live Console warns too); not a card error.
          if (err instanceof ApiError && err.status === 503) return { available: false, locks: [] };
          throw err;
        }
      }
      : null,
    `locks:${liveId}`,
    'Could not load seat locks',
  );
  const activity = useCard<AuditLog[]>(
    isSuper ? async () => (await getAuditLogs()).slice(0, RECENT_ACTIVITY) : null,
    `activity:${isSuper}`,
    'Could not load recent activity',
  );
  const health = useCard<HealthSummary>(
    isSuper
      ? async () => healthFromStatus(await getSystemStatus())
      : canEdit ? async () => healthFromReadiness(await getReadiness()) : null,
    `health:${isSuper}:${canEdit}`,
    'Could not load system health',
  );
  const feedback = useCard<FeedbackPreview>(
    canEdit
      ? async () => {
        const res = await getFeedback(1, FEEDBACK_PREVIEWS, 'new');
        const items = res.data ?? [];
        return { count: res.pagination?.total ?? items.length, items };
      }
      : null,
    `feedback:${canEdit}`,
    'Could not load feedback',
  );

  const [now, setNow] = useState(() => Date.now());
  const reloadLive = live.reload;
  const reloadLocks = locks.reload;
  const reloadActivity = activity.reload;
  const reloadHealth = health.reload;
  const reloadFeedback = feedback.reload;
  const refreshAll = useCallback(() => {
    setNow(Date.now());
    void reloadElections();
    void reloadLive();
    void reloadLocks();
    void reloadActivity();
    void reloadHealth();
    void reloadFeedback();
  }, [reloadElections, reloadLive, reloadLocks, reloadActivity, reloadHealth, reloadFeedback]);
  useVisiblePoll(refreshAll, DASHBOARD_REFRESH_MS);

  const summary = useMemo(() => (live.data ? summarizeLive(live.data) : null), [live.data]);
  const editing = useMemo(
    () => (live.data && locks.data ? editingNow(locks.data.locks, live.data, now) : []),
    [live.data, locks.data, now],
  );
  const lookup = useMemo(() => seatLookup(live.data ?? []), [live.data]);

  return {
    isSuper, canEdit, electionId, election, elections, electionsLoading, electionsError, reloadElections, now,
    live, summary, locks, editing, activity, lookup, health, feedback, refreshAll,
  };
}
```

- [ ] **Step 7: Rewrite `admin/src/pages/Dashboard.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { useDashboard, type CardState } from '../hooks/useDashboard';
import { shortElectionName } from '../components/shell/ElectionPicker';
import { NoElection } from '../components/entity/NoElection';
import { FeedbackKindBadge } from '../components/feedback/FeedbackKindBadge';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../components/ui/cn';
import { ELECTION_PHASE, groupElections, lastUpdateSubtitle, leadingSubtitle } from '../utils/dashboard';
import { auditActor, describeAudit } from '../utils/audit';
import { firstLine } from '../utils/feedback';
import { clockIst, formatIstDate, timeAgo } from '../utils/time';
import type { Election } from '../types';

type DashboardData = ReturnType<typeof useDashboard>;

const fmt = (n: number) => n.toLocaleString('en-IN');
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const VIEW_LINK = 'inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent-hover';

/** PAGE: Dashboard — counting overview for editors, elections overview for viewers. Refreshes every 30 s. */
export default function Dashboard() {
  const d = useDashboard();
  const subtitle = d.canEdit && d.election
    ? `${shortElectionName(d.election.name, d.election.type, d.election.year)} · ${ELECTION_PHASE[d.election.status]}`
    : 'Elections at a glance';
  return (
    <div className="tw-ui h-full overflow-y-auto bg-page font-sans text-ink">
      <div className="space-y-4 p-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>
        </header>
        {d.canEdit ? <CountingView d={d} /> : <ElectionsOverview d={d} />}
      </div>
    </div>
  );
}

function CountingView({ d }: { d: DashboardData }) {
  if (!d.electionId) {
    if (d.electionsLoading) return <p className="py-10 text-center text-sm text-muted">Loading elections…</p>;
    return <div className="rounded-card border border-line bg-card shadow-sm"><NoElection error={d.electionsError} /></div>;
  }
  return (
    <>
      <KpiRow d={d} />
      <LiveConsoleCard d={d} />
      <div className={cn('grid items-stretch gap-4', d.isSuper ? 'grid-cols-3' : 'grid-cols-2')}>
        {d.isSuper && <ActivityCard d={d} />}
        <HealthCard d={d} />
        <FeedbackCard d={d} />
      </div>
    </>
  );
}

// --- KPIs ---

function Kpi({ label, value, suffix, sub, valueClass, children }: {
  label: string; value: string; suffix?: string; sub?: string; valueClass?: string; children?: ReactNode;
}) {
  return (
    <section aria-label={label} className="rounded-card border border-line bg-card p-4 shadow-sm">
      <h2 className="text-xs font-medium text-ink-2">{label}</h2>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
        <span className={valueClass}>{value}</span>
        {suffix && <span className="text-sm font-normal text-muted">{suffix}</span>}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
      {children}
    </section>
  );
}

function KpiRow({ d }: { d: DashboardData }) {
  const s = d.summary;
  if (!s) {
    if (d.live.error) {
      return (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad-text">
          {d.live.error}
          <Button size="sm" variant="outline" onClick={() => { void d.live.reload(); }}>Try again</Button>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-4 gap-4">
        {['Seats declared', 'Leading', 'Pending', 'Last update'].map((label) => <Kpi key={label} label={label} value="—" sub="Loading…" />)}
      </div>
    );
  }
  const declaredPct = s.total ? Math.round((s.declared / s.total) * 100) : 0;
  return (
    <div className="grid grid-cols-4 gap-4">
      <Kpi label="Seats declared" value={fmt(s.declared)} suffix={` / ${fmt(s.total)}`}>
        <div role="progressbar" aria-label="Seats declared" aria-valuenow={declaredPct} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-1.5 overflow-hidden rounded-full bg-subtle">
          <div className="h-full rounded-full bg-ok" style={{ width: `${declaredPct}%` }} />
        </div>
      </Kpi>
      <Kpi label="Leading" value={fmt(s.leading)} valueClass="text-accent" sub={leadingSubtitle(s)} />
      <Kpi label="Pending" value={fmt(s.pending)} sub="no votes yet" />
      <Kpi label="Last update" value={s.lastUpdate ? clockIst(s.lastUpdate) : '—'} sub={lastUpdateSubtitle(s, d.now)} />
    </div>
  );
}

// --- Live console ---

function Avatar({ name }: { name: string }) {
  return (
    <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[9px] font-semibold text-accent">
      {initials(name)}
    </span>
  );
}

function LiveConsoleCard({ d }: { d: DashboardData }) {
  const pct = d.summary?.reportingPct ?? 0;
  const { locks } = d;
  let editing: ReactNode;
  if (locks.data && !locks.data.available) editing = <span>Seat locking unavailable</span>;
  else if (locks.data) {
    editing = (
      <>
        <span>Seats being edited now: {d.editing.length}</span>
        {d.editing.map((e) => (
          <span key={e.constId} className="inline-flex items-center gap-1.5 rounded-control border border-line bg-subtle px-2 py-0.5 text-ink">
            <Avatar name={e.userName} />
            <span>{e.userName} · {e.seat}</span>
          </span>
        ))}
      </>
    );
  } else if (locks.error) editing = <span className="text-bad-text">Could not load seat locks</span>;
  else editing = <span>Checking seat locks…</span>;

  return (
    <section aria-label="Live console" className="flex items-center justify-between gap-6 rounded-card border border-line bg-card px-4 py-3.5 shadow-sm">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-base font-semibold text-ink">Live console</h2>
          <span className="text-xs text-ink-2">Counting progress · {pct}% of seats reporting</span>
          <div role="progressbar" aria-label="Counting progress" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-1.5 w-48 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
          <Lock size={13} aria-hidden className="text-muted" />
          {editing}
        </div>
      </div>
      <Link to="/overrides" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-control bg-accent px-4 text-sm font-medium text-white shadow-sm hover:bg-accent-hover">
        Open live console <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  );
}

// --- Cards ---

function Card({ title, badge, footer, className, children }: { title: string; badge?: ReactNode; footer?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn('flex flex-col rounded-card border border-line bg-card p-4 shadow-sm', className)}>
      <header className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {badge}
      </header>
      {/* Content starts at the top; the "View …" link stays pinned to the bottom (NOTES.md). */}
      <div className="flex-1">{children}</div>
      {footer && <div className="mt-4 border-t border-line pt-3">{footer}</div>}
    </section>
  );
}

/** A card's own loading / error / data states. A failed refresh keeps the earlier data. */
function CardBody<T>({ state, children }: { state: CardState<T>; children: (data: T) => ReactNode }) {
  if (state.data !== null) {
    return (
      <>
        {children(state.data)}
        {state.error && <p className="mt-2 text-[11px] text-muted">Last refresh failed — showing earlier data.</p>}
      </>
    );
  }
  if (state.error) {
    return (
      <div role="alert" className="space-y-2 py-4 text-center">
        <p className="text-xs text-bad-text">{state.error}</p>
        <Button size="sm" variant="outline" onClick={() => { void state.reload(); }}>Try again</Button>
      </div>
    );
  }
  return <p className="py-6 text-center text-xs text-muted">Loading…</p>;
}

function ActivityCard({ d }: { d: DashboardData }) {
  return (
    <Card title="Recent activity" className="min-h-64" footer={<Link to="/logs" className={VIEW_LINK}>View audit log <ArrowRight size={12} aria-hidden /></Link>}>
      <CardBody state={d.activity}>
        {(logs) => (logs.length === 0 ? <p className="py-6 text-center text-xs text-muted">No activity yet.</p> : (
          <ul className="list-none divide-y divide-line">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 py-2 text-sm">
                <Avatar name={auditActor(l)} />
                <span className="min-w-0 flex-1 truncate text-ink">{describeAudit(l, d.lookup)}</span>
                <time dateTime={l.timestamp} className="shrink-0 text-[11px] text-muted">{timeAgo(l.timestamp, d.now)}</time>
              </li>
            ))}
          </ul>
        ))}
      </CardBody>
    </Card>
  );
}

function HealthCard({ d }: { d: DashboardData }) {
  const h = d.health.data;
  return (
    <Card
      title="System health"
      className="min-h-64"
      badge={h ? <Badge tone={h.ok ? 'ok' : 'bad'}>{h.ok ? 'All OK' : 'Degraded'}</Badge> : undefined}
      footer={d.isSuper ? <Link to="/status" className={VIEW_LINK}>Open system status <ArrowRight size={12} aria-hidden /></Link> : undefined}
    >
      <CardBody state={d.health}>
        {(health) => (
          <ul className="list-none space-y-2">
            {health.rows.map((r) => (
              <li key={r.label} className="flex items-center gap-2.5 rounded-control border border-line px-3 py-2 text-sm">
                <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', r.ok ? 'bg-ok' : 'bg-bad')} />
                <span className="font-medium text-ink">{r.label}</span>
                <span className="ml-auto text-xs text-muted">{r.detail}</span>
                <span className={cn('text-xs font-semibold tabular-nums', r.ok ? 'text-ink' : 'text-bad-text')}>{r.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function FeedbackCard({ d }: { d: DashboardData }) {
  const f = d.feedback.data;
  return (
    <Card
      title="Feedback"
      className="min-h-64"
      badge={f && f.count > 0 ? <Badge tone="accent">{fmt(f.count)} new</Badge> : undefined}
      footer={<Link to="/feedback" className={VIEW_LINK}>View all feedback <ArrowRight size={12} aria-hidden /></Link>}
    >
      <CardBody state={d.feedback}>
        {(fb) => (fb.items.length === 0 ? <p className="py-6 text-center text-xs text-muted">No new feedback.</p> : (
          <ul className="list-none space-y-2">
            {fb.items.map((item) => (
              <li key={item.id} className="space-y-1.5 rounded-control border border-line bg-page px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <FeedbackKindBadge kind={item.kind} />
                  <time dateTime={item.createdAt} className="ml-auto text-[11px] text-muted">{timeAgo(item.createdAt, d.now)}</time>
                </div>
                <p className="text-sm text-ink">{firstLine(item.message)}</p>
                {/* Plain text on purpose: the path is user input and must never become a link. */}
                {item.page && <p className="truncate font-mono text-[11px] text-muted">{item.page}</p>}
              </li>
            ))}
          </ul>
        ))}
      </CardBody>
    </Card>
  );
}

// --- VIEWER ---

function ElectionsOverview({ d }: { d: DashboardData }) {
  if (d.electionsLoading) return <p className="py-10 text-center text-sm text-muted">Loading elections…</p>;
  if (d.electionsError) {
    return (
      <div className="rounded-card border border-line bg-card shadow-sm">
        <EmptyState
          title="Could not load elections"
          description="Check the connection and try again."
          action={<Button variant="outline" size="sm" onClick={() => { void d.reloadElections(); }}>Try again</Button>}
        />
      </div>
    );
  }
  const g = groupElections(d.elections);
  return (
    <>
      <div className="grid grid-cols-3 gap-4">
        <Kpi label="Live" value={fmt(g.live.length)} valueClass="text-ok-text" sub="counting now" />
        <Kpi label="Upcoming" value={fmt(g.upcoming.length)} sub="scheduled" />
        <Kpi label="Finalized" value={fmt(g.finalized.length)} sub="final results" />
      </div>
      <div className="grid grid-cols-3 items-start gap-4">
        <ElectionList title="Live now" elections={g.live} empty="No election is counting right now." />
        <ElectionList title="Upcoming elections" elections={g.upcoming} empty="Nothing scheduled." showDate />
        <ElectionList title="Finalized elections" elections={g.finalized} empty="No finalized elections yet." />
      </div>
    </>
  );
}

function ElectionList({ title, elections, empty, showDate }: { title: string; elections: Election[]; empty: string; showDate?: boolean }) {
  return (
    <Card title={title}>
      {elections.length === 0 ? <p className="py-4 text-center text-xs text-muted">{empty}</p> : (
        <ul className="list-none divide-y divide-line">
          {elections.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-ink">{e.name}</span>
              <span className="shrink-0 text-xs text-muted">
                {showDate && e.tentative_next_date ? formatIstDate(e.tentative_next_date) : `${e.type} · ${e.year}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
```

- [ ] **Step 8: Make the Dashboard bare** in `admin/src/components/Layout.tsx`.

  a. Replace the `BARE_PATHS` and `isBare` lines with:

```tsx
/** Rebuilt pages manage their own padding and scrolling; legacy pages keep `.admin-content` until they migrate. Each page task appends its path. */
export const BARE_PATHS: string[] = ['/overrides', '/parties', '/elections', '/persons', '/candidates', '/constituencies', '/manifests', '/'];
/** Exact path or a sub-path. '/' is exact only: its sub-path prefix would be '//'. */
export const isBare = (pathname: string) => BARE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
```

  b. In `admin/src/theme/tailwind.css`, add `@source "../pages/Dashboard.tsx";` directly after `@source "../pages/Login.tsx";`.

- [ ] **Step 9: Delete the old controller**

```bash
git rm admin/src/hooks/useDashboardManager.ts
grep -rn "useDashboardManager" admin/src
```

Expected: the grep prints nothing.

- [ ] **Step 10: Run the three test files**

Run: `cd admin && npx vitest run src/hooks/useVisiblePoll.test.ts src/components/Layout.test.tsx src/pages/Dashboard.test.tsx`
Expected: PASS (2 + 1 + 8 tests).

- [ ] **Step 11: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS, with no unused-import errors from `tsc`.

- [ ] **Step 12: Commit**

```bash
git add admin/src/hooks/useVisiblePoll.ts admin/src/hooks/useVisiblePoll.test.ts admin/src/hooks/useDashboard.ts admin/src/pages/Dashboard.tsx admin/src/pages/Dashboard.test.tsx admin/src/components/Layout.tsx admin/src/components/Layout.test.tsx admin/src/theme/tailwind.css
git commit -m "admin: dashboard with role-gated KPI, live console, activity, health and feedback cards

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Feedback page (table + side panel, status actions, server paging)

This task covers decisions §4 and the page map's Feedback section. The page uses `EntityPage` + `DataTable`:
- Server-side status chips: All, New, Read, Resolved.
- Server paging at 50 per page.
- Row actions Mark read, Resolve and Mark new, with a per-row busy state.
- A Refresh button.

The side panel at `/feedback/:id` shows:
- the full message
- the email as a `mailto:` link
- the page path as plain text, never a link (it is user input)
- the kind, the status and the received time (IST)
- the same actions

There is no GET-by-id endpoint, so the panel resolves its record from the loaded page.

After an action, the panel keeps the PATCH response, so it doesn't flip to "not found" when the record leaves the filtered list. For example, Resolve under "New" removes the row. The page clamps back when an action empties the last page (Task 2).

Without a record:
- the list is loading → "Loading feedback…"
- the list failed → "Could not load feedback" with Try again
- the list loaded but the id is missing → "Feedback not found"

**Files:**
- Create: `admin/src/components/entity/feedback/FeedbackPanel.tsx`
- Rewrite: `admin/src/pages/Feedback.tsx`
- Modify:
  - `admin/src/App.tsx` (route `feedback/*`)
  - `admin/src/components/Layout.tsx` (append `'/feedback'` to `BARE_PATHS`)
  - `admin/src/theme/tailwind.css` (`@source "../pages/Feedback.tsx"`)
- Test: `admin/src/pages/Feedback.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 2: `useResourceList({ key: 'feedback', pageSize: 50, initialFilters, sanitizeFilters, onLoad })`
  - from Task 5: `FeedbackKindBadge`, `FEEDBACK_STATUS_LABEL`, `FEEDBACK_STATUS_TONE`, `isFeedbackStatus`, `formatIst`
  - from Phase 2: `useEntityRoute('/feedback')`, `EntityPage`, `PageHeader`, `Toolbar`, `ChipGroup`, `DataTable`, `Column`, `Pager`, `EmptyState`, `Sheet`, `Badge`, `Button`, `renderEntityPage`
  - services: `getFeedback(page, limit, status?)` → `PaginatedResponse<Feedback>`, and `updateFeedbackStatus(id, status)` → `Feedback`
- Produces:
  - `FeedbackPanel({ item, listLoading, listError, busy, onSetStatus, onRetry, onClose })`, with types `item: Feedback | null`, `onSetStatus(item: Feedback, status: FeedbackStatus): void`, `onRetry(): void` and `onClose(): void`.
  - `STATUS_ACTIONS: { status: FeedbackStatus; label: string }[]`, exported from `FeedbackPanel.tsx`.

- [ ] **Step 1: Write the failing page test** `admin/src/pages/Feedback.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Feedback as Item, FeedbackStatus } from '../types';

const db = vi.hoisted(() => ({ rows: [] as Item[] }));
const svc = vi.hoisted(() => ({
  getFeedback: vi.fn(),
  updateFeedbackStatus: vi.fn(),
}));
vi.mock('../services/feedback.service', () => svc);
import Feedback from './Feedback';
import { renderEntityPage } from '../test-utils/entity-harness';
import { ApiError } from '../services/api-client';

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, kind: 'other', message: `Message ${id}`, email: null, page: null, status: 'new', createdAt: '2026-10-01T08:30:00.000Z', ...over,
});
const SEED = (): Item[] => [
  item('f1', { kind: 'bug', message: 'Round 2 total is wrong\nPlease check', email: 'a@b.in', page: '/elections/e1/seat/142' }),
  item('f2', { kind: 'data_error', message: 'Margin looks off' }),
  item('f3', { kind: 'suggestion', message: 'Add a seat search', status: 'read' }),
];

beforeEach(() => {
  db.rows = SEED();
  svc.getFeedback.mockImplementation(async (page: number, limit: number, status?: FeedbackStatus) => {
    const all = status ? db.rows.filter((f) => f.status === status) : db.rows;
    return { success: true, data: all.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / limit)) } };
  });
  svc.updateFeedbackStatus.mockImplementation(async (id: string, status: FeedbackStatus) => {
    db.rows = db.rows.map((f) => (f.id === id ? { ...f, status } : f));
    return db.rows.find((f) => f.id === id);
  });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

const renderAt = (at = '/feedback') => renderEntityPage('/feedback', <Feedback />, at);
const table = () => screen.getByRole('table', { name: 'Feedback' });
const rowOf = (text: string) => within(table()).getByText(text).closest('tr')!;
const chips = () => within(screen.getByRole('group', { name: 'Status' }));

describe('Feedback page', () => {
  it('lists reports with kind badges, a mailto email and the page path as plain text', async () => {
    renderAt();
    const row = (await within(table()).findByText(/Round 2 total is wrong/)).closest('tr')!;
    expect(within(row).getByText('Bug')).toBeTruthy();
    expect(within(row).getByRole('link', { name: 'a@b.in' }).getAttribute('href')).toBe('mailto:a@b.in');
    expect(within(row).getByText('/elections/e1/seat/142').closest('a')).toBeNull();
    expect(within(rowOf('Margin looks off')).getByText('Data error')).toBeTruthy();
    expect(within(rowOf('Add a seat search')).getByText('Read')).toBeTruthy();
    expect(screen.getByText('Showing 1–3 of 3 reports')).toBeTruthy();
    expect(svc.getFeedback).toHaveBeenCalledWith(1, 50, undefined);
  });

  it('status chips filter on the server; a stale stored filter starts on All', async () => {
    localStorage.setItem('feedback_filters', JSON.stringify({ status: 'archived' }));
    renderAt();
    await within(table()).findByText('Add a seat search');
    expect(chips().getByRole('button', { name: 'All' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(chips().getByRole('button', { name: 'New' }));
    await waitFor(() => expect(svc.getFeedback).toHaveBeenLastCalledWith(1, 50, 'new'));
    await waitFor(() => expect(within(table()).queryByText('Add a seat search')).toBeNull());
  });

  it('a row action is busy only on its row, then toasts and refreshes', async () => {
    let release!: (v: Item) => void;
    svc.updateFeedbackStatus.mockImplementationOnce((id: string, status: FeedbackStatus) => new Promise<Item>((r) => {
      release = (v) => r(v);
      db.rows = db.rows.map((f) => (f.id === id ? { ...f, status } : f));
    }));
    renderAt();
    await within(table()).findByText('Margin looks off');
    const before = svc.getFeedback.mock.calls.length;
    fireEvent.click(within(rowOf('Margin looks off')).getByRole('button', { name: 'Resolve' }));
    expect((within(rowOf('Margin looks off')).getByRole('button', { name: 'Mark read' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(rowOf('Add a seat search')).getByRole('button', { name: 'Resolve' }) as HTMLButtonElement).disabled).toBe(false);
    release(item('f2', { kind: 'data_error', message: 'Margin looks off', status: 'resolved' }));
    expect(await screen.findByText('Marked resolved')).toBeTruthy();
    await waitFor(() => expect(svc.getFeedback.mock.calls.length).toBeGreaterThan(before));
    expect(svc.updateFeedbackStatus).toHaveBeenCalledWith('f2', 'resolved');
  });

  it('a row opens the panel; resolving it under the New filter keeps the panel on the record', async () => {
    localStorage.setItem('feedback_filters', JSON.stringify({ status: 'new' }));
    renderAt();
    fireEvent.click(await within(table()).findByText(/Round 2 total is wrong/));
    expect(screen.getByTestId('where').textContent).toBe('/feedback/f1');
    const panel = await screen.findByRole('dialog', { name: 'Feedback' });
    expect(within(panel).getByText('Round 2 total is wrong Please check')).toBeTruthy();
    expect(within(panel).getByText('/elections/e1/seat/142').closest('a')).toBeNull();
    expect(within(panel).getByRole('link', { name: 'a@b.in' })).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(within(table()).queryByText(/Round 2 total is wrong/)).toBeNull());
    expect(within(panel).getByText('Resolved')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Mark read' })).toBeTruthy();
    expect(within(panel).queryByRole('button', { name: 'Resolve' })).toBeNull();
  });

  it('clamps back a page when an action empties the last page', async () => {
    db.rows = Array.from({ length: 51 }, (_, i) => item(`n${i + 1}`, { message: `Report ${i + 1}` }));
    localStorage.setItem('feedback_filters', JSON.stringify({ status: 'new' }));
    renderAt();
    await within(table()).findByText('Report 1');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(within((await within(table()).findByText('Report 51')).closest('tr')!).getByRole('button', { name: 'Resolve' }));
    await waitFor(() => expect(screen.getByText('Page 1 of 1')).toBeTruthy());
    expect(await within(table()).findByText('Report 1')).toBeTruthy();
  });

  it('a deep link to an unknown id says not found', async () => {
    renderAt('/feedback/zzz');
    await within(table()).findByText('Margin looks off');
    expect(await within(screen.getByRole('dialog')).findByText('Feedback not found')).toBeTruthy();
  });

  it('a failed list shows Could not load feedback with Try again, in the table and the panel', async () => {
    svc.getFeedback.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    renderAt('/feedback/f1');
    const panel = await screen.findByRole('dialog');
    expect(await within(panel).findByText('Could not load feedback')).toBeTruthy();
    expect(within(table().parentElement!.parentElement!).getByText('Could not load feedback')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Try again' }));
    expect(await within(panel).findByText('Round 2 total is wrong Please check')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `cd admin && npx vitest run src/pages/Feedback.test.tsx`
Expected: FAIL. "Unable to find role="table" and name "Feedback"": the legacy table has no `aria-label`, and the buttons read "MARK READ".

- [ ] **Step 3: Create `admin/src/components/entity/feedback/FeedbackPanel.tsx`**

```tsx
import { Sheet } from '../../ui/Sheet';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { FeedbackKindBadge } from '../../feedback/FeedbackKindBadge';
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_TONE, kindMeta } from '../../../utils/feedback';
import { formatIst } from '../../../utils/time';
import type { Feedback, FeedbackStatus } from '../../../types';

/** Every status except the current one is offered. */
export const STATUS_ACTIONS: { status: FeedbackStatus; label: string }[] = [
  { status: 'read', label: 'Mark read' },
  { status: 'resolved', label: 'Resolve' },
  { status: 'new', label: 'Mark new' },
];

interface FeedbackPanelProps {
  item: Feedback | null;
  listLoading: boolean;
  listError: string | null;
  busy: boolean;
  onSetStatus: (item: Feedback, status: FeedbackStatus) => void;
  onRetry: () => void;
  onClose: () => void;
}

/** One public report, read-only, with the status actions. The page keys it by id. */
export function FeedbackPanel({ item, listLoading, listError, busy, onSetStatus, onRetry, onClose }: FeedbackPanelProps) {
  return (
    <Sheet
      open
      onRequestClose={onClose}
      title="Feedback"
      description={item ? `${kindMeta(item.kind).label} · received ${formatIst(item.createdAt)} (IST)` : undefined}
      footer={item ? (
        <>
          <Badge tone={FEEDBACK_STATUS_TONE[item.status]}>{FEEDBACK_STATUS_LABEL[item.status]}</Badge>
          <div className="flex items-center gap-2">
            {STATUS_ACTIONS.filter((a) => a.status !== item.status).map((a) => (
              <Button key={a.status} size="sm" variant={a.status === 'resolved' ? 'primary' : 'outline'} disabled={busy} onClick={() => onSetStatus(item, a.status)}>
                {a.label}
              </Button>
            ))}
          </div>
        </>
      ) : undefined}
    >
      {!item ? (
        listLoading ? <p className="py-10 text-center text-sm text-muted">Loading feedback…</p>
          : listError ? (
            <EmptyState
              title="Could not load feedback"
              description={listError}
              action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
            />
          )
            : <EmptyState title="Feedback not found" description="It may be on another page or hidden by the status filter. Close this panel to go back to the list." />
      ) : (
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-xs font-medium text-muted">Kind</dt>
            <dd className="mt-1"><FeedbackKindBadge kind={item.kind} /></dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Message</dt>
            <dd className="mt-1 whitespace-pre-wrap text-ink [overflow-wrap:anywhere]">{item.message}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Email</dt>
            <dd className="mt-1">
              {item.email
                ? <a href={`mailto:${item.email}`} className="break-all text-accent hover:underline">{item.email}</a>
                : <span className="text-muted">Not given</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">Page</dt>
            {/* Plain text on purpose: the path is user input and must never become a link. */}
            <dd className="mt-1 font-mono text-xs text-ink-2 [overflow-wrap:anywhere]">{item.page || <span className="font-sans text-muted">Not given</span>}</dd>
          </div>
        </dl>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 4: Rewrite `admin/src/pages/Feedback.tsx`**

```tsx
import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getFeedback, updateFeedbackStatus } from '../services/feedback.service';
import { useResourceList } from '../hooks/useResourceList';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { useToast } from '../context/ToastContext';
import { EntityPage } from '../components/entity/EntityPage';
import { FeedbackPanel, STATUS_ACTIONS } from '../components/entity/feedback/FeedbackPanel';
import { FeedbackKindBadge } from '../components/feedback/FeedbackKindBadge';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { FEEDBACK_STATUS_LABEL, FEEDBACK_STATUS_TONE, isFeedbackStatus } from '../utils/feedback';
import { formatIst } from '../utils/time';
import type { Feedback as FeedbackItem, FeedbackStatus } from '../types';

const PAGE_SIZE = 50;
type StatusFilter = '' | FeedbackStatus;

const CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'resolved', label: 'Resolved' },
];

/**
 * PAGE: Feedback — inbox for the public feedback form: triage reports as new → read → resolved.
 * Table + panel at /feedback/:id (no GET-by-id endpoint: the panel reads the loaded page).
 */
export default function Feedback() {
  const route = useEntityRoute('/feedback');
  const { toast, toastError } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  /** The record last changed here: the panel keeps showing it after it leaves the filtered list. */
  const [changed, setChanged] = useState<FeedbackItem | null>(null);

  const list = useResourceList<{ status: StatusFilter }>({
    key: 'feedback',
    pageSize: PAGE_SIZE,
    initialFilters: { status: '' },
    sanitizeFilters: (f) => ({ status: isFeedbackStatus(f.status) ? f.status : '' }),
    onLoad: async (page, _search, filters) => {
      const res = await getFeedback(page, PAGE_SIZE, filters.status || undefined);
      return { data: res.data || [], total: res.pagination?.total || 0 };
    },
  });
  const rows = list.items as FeedbackItem[];

  const setStatus = async (item: FeedbackItem, status: FeedbackStatus) => {
    setBusyId(item.id);
    try {
      const updated = await updateFeedbackStatus(item.id, status);
      setChanged(updated?.id ? updated : { ...item, status });
      toast(`Marked ${FEEDBACK_STATUS_LABEL[status].toLowerCase()}`);
      void list.refresh();
    } catch (err) {
      toastError(err, 'Status update failed');
    } finally {
      setBusyId(null);
    }
  };

  const selected = !route.id ? null : changed?.id === route.id ? changed : rows.find((f) => f.id === route.id) ?? null;

  const columns: Column<FeedbackItem>[] = [
    { key: 'received', header: 'Received', className: 'whitespace-nowrap text-xs text-ink-2', cell: (f) => formatIst(f.createdAt) },
    { key: 'kind', header: 'Kind', cell: (f) => <FeedbackKindBadge kind={f.kind} /> },
    {
      key: 'message', header: 'Message', className: 'max-w-md',
      cell: (f) => <span className="line-clamp-3 whitespace-pre-wrap [overflow-wrap:anywhere]">{f.message}</span>,
    },
    {
      key: 'email', header: 'Email', className: 'text-xs',
      cell: (f) => (f.email ? <a href={`mailto:${f.email}`} className="break-all text-accent hover:underline">{f.email}</a> : <span className="text-muted">—</span>),
    },
    {
      // Plain text on purpose: the path is user input and must never become a link.
      key: 'page', header: 'Page', className: 'max-w-[220px] font-mono text-[11px] text-ink-2 [overflow-wrap:anywhere]',
      cell: (f) => f.page || <span className="font-sans text-muted">—</span>,
    },
    { key: 'status', header: 'Status', cell: (f) => <Badge tone={FEEDBACK_STATUS_TONE[f.status]}>{FEEDBACK_STATUS_LABEL[f.status]}</Badge> },
    {
      key: 'actions', header: <span className="sr-only">Actions</span>, className: 'whitespace-nowrap',
      cell: (f) => (
        <div className="flex justify-end gap-1.5">
          {STATUS_ACTIONS.filter((a) => a.status !== f.status).map((a) => (
            <Button key={a.status} size="sm" variant="outline" disabled={busyId === f.id} onClick={() => { void setStatus(f, a.status); }}>{a.label}</Button>
          ))}
        </div>
      ),
    },
  ];

  const filterLabel = CHIPS.find((c) => c.value === list.filters.status)?.label.toLowerCase();

  return (
    <EntityPage
      header={
        <PageHeader
          title="Feedback"
          count={list.total}
          subtitle="Reports from the public site"
          actions={<Button variant="outline" disabled={list.loading} onClick={() => { void list.refresh(); }}><RefreshCw size={14} aria-hidden />Refresh</Button>}
        />
      }
      toolbar={
        <Toolbar>
          <ChipGroup<StatusFilter> label="Status" value={list.filters.status} onChange={(status) => list.updateFilters({ status })} options={CHIPS} />
        </Toolbar>
      }
      table={
        <>
          {list.error && rows.length > 0 && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/30 bg-bad-soft px-4 py-2.5 text-sm text-bad-text">
              {list.error}
              <Button size="sm" variant="outline" onClick={() => { void list.refresh(); }}>Try again</Button>
            </div>
          )}
          <DataTable
            label="Feedback"
            columns={columns}
            rows={rows}
            rowKey={(f) => f.id}
            selectedKey={route.id}
            onRowClick={(f) => route.open(f.id)}
            loading={list.loading}
            empty={list.error
              ? <EmptyState title="Could not load feedback" description={list.error} action={<Button variant="outline" size="sm" onClick={() => { void list.refresh(); }}>Try again</Button>} />
              : <EmptyState title="No feedback found" description={list.filters.status ? `There is no ${filterLabel} feedback.` : 'Reports from the public feedback form appear here.'} />}
            footer={<Pager page={list.page} totalPages={list.totalPages} total={list.total} pageSize={PAGE_SIZE} noun="reports" onPage={list.loadPage} />}
          />
        </>
      }
      panel={route.id ? (
        <FeedbackPanel
          key={route.id}
          item={selected}
          listLoading={list.loading}
          listError={list.error}
          busy={busyId === route.id}
          onSetStatus={(f, status) => { void setStatus(f, status); }}
          onRetry={() => { void list.refresh(); }}
          onClose={() => route.close()}
        />
      ) : null}
    />
  );
}
```

- [ ] **Step 5: Route, bare path, `@source`.**

  a. In `admin/src/App.tsx`, replace

```tsx
                <Route path="feedback" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Feedback /></ProtectedRoute>} />
```

  with

```tsx
                <Route path="feedback/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Feedback /></ProtectedRoute>} />
```

  b. In `admin/src/components/Layout.tsx`, append `'/feedback'` to the `BARE_PATHS` array, after `'/'`.

  c. In `admin/src/theme/tailwind.css`, add `@source "../pages/Feedback.tsx";` after `@source "../pages/Dashboard.tsx";`. `components/entity/feedback` is already covered by `@source "../components/entity"`.

- [ ] **Step 6: Run the page test**

Run: `cd admin && npx vitest run src/pages/Feedback.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 7: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.
- `Feedback.tsx` no longer imports `AdminPageHeader` or `ErrorBoundary`.
- `grep -n "AdminPageHeader\|className=\"btn" admin/src/pages/Feedback.tsx` prints nothing.

- [ ] **Step 8: Commit**

```bash
git add admin/src/pages/Feedback.tsx admin/src/pages/Feedback.test.tsx admin/src/components/entity/feedback admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: feedback inbox as table + panel (status chips, row actions, page clamp)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Users page (table + panel, create, edit with optional password, one-step delete confirm)

This task covers decisions §5 and the page map's Users section. The page uses `EntityPage` + `DataTable`. `GET /admin/users` (plain array, newest first, capped at 200) is loaded **once** and filtered in memory on the debounced search (name or email). When 200 come back, the page shows "Showing first 200".

**Create** (`/users/new`):
- fields: name, email, temporary password (at least 8 characters, show/hide), role (default Viewer)
- calls `POST /admin/users`, then opens the new record

**Edit panel** (`/users/:id`):
- fields: name, email, role, and an optional "Set new password"
- saving sends one `PATCH /admin/users/:id`. There is no instant inline role select any more.
- an empty password is **omitted**

**Delete:**
- one `ConfirmDialog`, then `DELETE /admin/users/:id`
- the second `window.confirm` in the old hook is gone

**Your own account:**
- Delete is disabled, with the hint "You cannot delete your own account."
- The role select is also disabled, with the hint "You cannot change your own role.". The backend re-reads the role on every request, but `AuthContext` keeps the old one, so a self-demotion would leave the UI offering pages that 403.

**Errors:**
- A 403 (the backend refuses to remove or demote the last SUPER_ADMIN) shows inline in the panel. The user stays in the list.
- A 409 (P2002, duplicate email) shows under Email.
- 400 field errors show under their fields.
- None of these raise a toast. Every other failure raises one `toastError`.
- The client checks name (required), email (format) and password length before sending.

**Files:**
- Create: `admin/src/pages/Users.tsx`, `admin/src/components/entity/users/UserPanel.tsx`, `admin/src/components/entity/users/UserCreatePanel.tsx`
- Rewrite: `admin/src/hooks/useUserManager.ts`
- Modify:
  - `admin/src/services/user.service.ts` (`UpdateUserData`)
  - `admin/src/App.tsx` (route `users/*` → `Users`)
  - `admin/src/components/Layout.tsx` (append `'/users'`)
  - `admin/src/theme/tailwind.css` (`@source "../pages/Users.tsx"`)
- Delete: `admin/src/pages/UserManager.tsx`
- Test: `admin/src/hooks/useUserManager.test.tsx`, `admin/src/pages/Users.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 2: `useDebouncedValue`, `SEARCH_DEBOUNCE_MS`
  - from Task 4: `PasswordInput`
  - from Task 5: `formatIstDate`
  - from Phase 2: `useEntityRoute`, `NEW_ID`, `useUnsavedGuard`, `EntityPage`, `PanelFooter`, `Sheet`, `ConfirmDialog`, `Field`, `FormSection`, `Input`, `Select`, `PageHeader`, `Toolbar`, `SearchInput`, `DataTable`, `EmptyState`, `Badge`, `Button`, `renderEntityPage`
  - `useAuth().user` and `useShellStatus().editorDirty`
- Produces:
  - `user.service.ts`:
    - `interface UpdateUserData { name?: string; email?: string; role?: User['role']; password?: string }`
    - `updateUser(id: string, data: UpdateUserData): Promise<User>`
  - `hooks/useUserManager.ts`:
    - types `UserRole = User['role']`, `UserForm = { name; email; role; password }` and `SaveOutcome<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string>; banner: string | null }`
    - constants `USER_LIST_CAP = 200`, `MIN_PASSWORD = 8`, `ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[]`, `EMPTY_USER: UserForm`, `LAST_SUPER_ADMIN`, `DUPLICATE_EMAIL`
    - functions:
      - `roleLabel(role: UserRole): string`
      - `sameUserForm(a: UserForm, b: UserForm): boolean`
      - `validateUser(form: UserForm, requirePassword: boolean): Record<string, string>`
      - `panelError(err: unknown): { fields: Record<string, string>; banner: string | null } | null`
      - `userPatch(form: UserForm, isSelf: boolean): UpdateUserData`
    - `useUserManager()` returns `{ users, visible, loading, error, search, setSearch, saving, capped, reload, create(form): Promise<SaveOutcome<User>>, update(id, data): Promise<SaveOutcome<User>>, remove(id): Promise<SaveOutcome<true>> }`
  - Panels:
    - `<UserPanel user isSelf listLoading listError saving onRetry onClose onSave onDelete onDeleted />`
    - `<UserCreatePanel saving onCreate onCreated onClose />`

- [ ] **Step 1: Write the failing hook test** `admin/src/hooks/useUserManager.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';
import type { User } from '../types';

const svc = vi.hoisted(() => ({ getUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn() }));
vi.mock('../services/user.service', () => svc);
import { DUPLICATE_EMAIL, EMPTY_USER, LAST_SUPER_ADMIN, panelError, useUserManager, userPatch, validateUser } from './useUserManager';
import { ApiError } from '../services/api-client';

const u = (id: string, name: string, email: string, role: User['role'] = 'EDITOR'): User => ({ id, name, email, role, created_at: '2026-10-01T05:00:00.000Z' });
const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('user form rules', () => {
  it('validateUser: name and email required, email format, password length (required only on create)', () => {
    expect(validateUser(EMPTY_USER, true)).toEqual({ name: 'Name is required', email: 'Email is required', password: 'At least 8 characters' });
    expect(validateUser({ ...EMPTY_USER, name: 'A', email: 'not-an-email' }, false)).toEqual({ email: 'Enter a valid email address' });
    expect(validateUser({ ...EMPTY_USER, name: 'A', email: 'a@b.in' }, false)).toEqual({});
    expect(validateUser({ ...EMPTY_USER, name: 'A', email: 'a@b.in', password: 'short' }, false)).toEqual({ password: 'At least 8 characters' });
  });

  it('userPatch trims, omits an empty password, and leaves out the role on your own account', () => {
    const form = { name: ' Priya S ', email: ' priya@x.in ', role: 'VIEWER' as const, password: '' };
    expect(userPatch(form, false)).toEqual({ name: 'Priya S', email: 'priya@x.in', role: 'VIEWER' });
    expect('password' in userPatch(form, false)).toBe(false);
    expect(userPatch({ ...form, password: 'long-enough' }, true)).toEqual({ name: 'Priya S', email: 'priya@x.in', password: 'long-enough' });
  });

  it('panelError: 403 last super admin, 409 duplicate email, 400 fields; anything else is for a toast', () => {
    expect(panelError(new ApiError('Cannot delete the last SUPER_ADMIN', 403))).toEqual({ fields: {}, banner: LAST_SUPER_ADMIN });
    expect(panelError(new ApiError('A record with the same unique value already exists', 409))).toEqual({ fields: { email: DUPLICATE_EMAIL }, banner: null });
    expect(panelError(new ApiError('Validation failed', 400, 'V', [{ field: 'email', message: 'email must be an email' }]))).toEqual({ fields: { email: 'email must be an email' }, banner: null });
    expect(panelError(new ApiError('Internal server error', 500))).toBeNull();
    expect(panelError(new TypeError('Failed to fetch'))).toBeNull();
  });
});

describe('useUserManager', () => {
  it('loads once, filters in memory after typing pauses, and reports the 200 cap', async () => {
    svc.getUsers.mockResolvedValue([u('a', 'Priya S', 'priya@x.in'), u('b', 'Rahul M', 'rahul@x.in')]);
    const { result } = renderHook(() => useUserManager(), { wrapper });
    await waitFor(() => expect(result.current.visible).toHaveLength(2));
    act(() => result.current.setSearch('RAHUL'));
    expect(result.current.search).toBe('RAHUL');
    await waitFor(() => expect(result.current.visible.map((x) => x.id)).toEqual(['b']));
    expect(svc.getUsers).toHaveBeenCalledTimes(1);
    expect(result.current.capped).toBe(false);
    svc.getUsers.mockResolvedValueOnce(Array.from({ length: 200 }, (_, i) => u(`x${i}`, `User ${i}`, `u${i}@x.in`)));
    await act(async () => { await result.current.reload(); });
    expect(result.current.capped).toBe(true);
  });

  it('update merges the response into the list; a field error does not toast', async () => {
    svc.getUsers.mockResolvedValue([u('a', 'Priya S', 'priya@x.in')]);
    svc.updateUser.mockResolvedValueOnce({ id: 'a', name: 'Priya Singh', email: 'priya@x.in', role: 'EDITOR' });
    const { result } = renderHook(() => useUserManager(), { wrapper });
    await waitFor(() => expect(result.current.users).toHaveLength(1));
    let out: Awaited<ReturnType<typeof result.current.update>> | undefined;
    await act(async () => { out = await result.current.update('a', { name: 'Priya Singh' }); });
    expect(out).toEqual({ ok: true, value: { id: 'a', name: 'Priya Singh', email: 'priya@x.in', role: 'EDITOR' } });
    expect(result.current.users[0]).toEqual({ ...u('a', 'Priya Singh', 'priya@x.in') });
    svc.updateUser.mockRejectedValueOnce(new ApiError('dup', 409));
    await act(async () => { out = await result.current.update('a', { email: 'taken@x.in' }); });
    expect(out).toEqual({ ok: false, fields: { email: DUPLICATE_EMAIL }, banner: null });
    expect(document.body.textContent).not.toContain('Could not save user');
  });
});
```

- [ ] **Step 2: Write the failing page test** `admin/src/pages/Users.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { User } from '../types';

const svc = vi.hoisted(() => ({ getUsers: vi.fn(), createUser: vi.fn(), updateUser: vi.fn(), deleteUser: vi.fn() }));
vi.mock('../services/user.service', () => svc);
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'me', name: 'Mannu K', email: 'mannu@x.in', role: 'SUPER_ADMIN' }, hasRole: (...r: string[]) => r.includes('SUPER_ADMIN') }),
}));
import Users from './Users';
import { renderEntityPage } from '../test-utils/entity-harness';
import { ApiError } from '../services/api-client';
import { DUPLICATE_EMAIL, LAST_SUPER_ADMIN } from '../hooks/useUserManager';

const u = (id: string, name: string, email: string, role: User['role']): User => ({ id, name, email, role, created_at: '2026-10-01T05:00:00.000Z' });
let USERS: User[] = [];

beforeEach(() => {
  USERS = [
    u('me', 'Mannu K', 'mannu@x.in', 'SUPER_ADMIN'),
    u('u2', 'Priya S', 'priya@x.in', 'EDITOR'),
    u('u3', 'Rahul M', 'rahul@x.in', 'VIEWER'),
    u('u4', 'Asha T', 'asha@x.in', 'SUPER_ADMIN'),
  ];
  svc.getUsers.mockImplementation(async () => USERS);
  svc.updateUser.mockImplementation(async (id: string, data: Partial<User>) => ({ ...USERS.find((x) => x.id === id)!, ...data }));
  svc.deleteUser.mockImplementation(async () => undefined);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/users') => renderEntityPage('/users', <Users />, at);
const table = () => screen.getByRole('table', { name: 'Users' });
const rowOf = (name: string) => within(table()).getByText(name).closest('tr')!;
const where = () => screen.getByTestId('where').textContent;

describe('Users page', () => {
  it('lists users with sentence-case role badges and marks your own row', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    expect(within(rowOf('Mannu K')).getByText('You')).toBeTruthy();
    expect(within(rowOf('Mannu K')).getByText('Super admin')).toBeTruthy();
    expect(within(rowOf('Priya S')).getByText('Editor')).toBeTruthy();
    expect(within(rowOf('Rahul M')).getByText('Viewer')).toBeTruthy();
    expect(within(rowOf('Rahul M')).getByText('1 Oct 2026')).toBeTruthy();
    expect(within(rowOf('Rahul M')).queryByRole('combobox')).toBeNull();
    expect(screen.queryByText('Showing first 200')).toBeNull();
  });

  it('search filters by name or email once typing pauses, without refetching', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    fireEvent.change(screen.getByLabelText('Search users'), { target: { value: 'rahul@' } });
    await waitFor(() => expect(within(table()).queryByText('Priya S')).toBeNull());
    expect(within(table()).getByText('Rahul M')).toBeTruthy();
    expect(svc.getUsers).toHaveBeenCalledTimes(1);
  });

  it('says "Showing first 200" when the backend cap is reached', async () => {
    USERS = Array.from({ length: 200 }, (_, i) => u(`x${i}`, `User ${i}`, `u${i}@x.in`, 'VIEWER'));
    renderAt();
    expect(await screen.findByText('Showing first 200')).toBeTruthy();
  });

  it('your own account: role and delete are disabled with hints; saving sends no role (Review Focus 2)', async () => {
    renderAt('/users/me');
    const panel = await screen.findByRole('dialog', { name: 'Mannu K' });
    expect((await within(panel).findByLabelText('Role') as HTMLSelectElement).disabled).toBe(true);
    expect(within(panel).getByText('You cannot change your own role.')).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Delete user' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).getByText('You cannot delete your own account.')).toBeTruthy();
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Mannu Kumar' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateUser).toHaveBeenCalledWith('me', { name: 'Mannu Kumar', email: 'mannu@x.in' }));
  });

  it('edits another user through Save; an empty new password is not sent; a short one is refused first', async () => {
    renderAt('/users/u2');
    const panel = await screen.findByRole('dialog', { name: 'Priya S' });
    fireEvent.change(await within(panel).findByLabelText('Role'), { target: { value: 'VIEWER' } });
    expect(svc.updateUser).not.toHaveBeenCalled();
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateUser).toHaveBeenCalledWith('u2', { name: 'Priya S', email: 'priya@x.in', role: 'VIEWER' }));
    expect(await screen.findByText('User updated')).toBeTruthy();
    await waitFor(() => expect(within(rowOf('Priya S')).getByText('Viewer')).toBeTruthy());
    fireEvent.change(within(panel).getByLabelText('Set new password'), { target: { value: 'short' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(within(panel).getByText('At least 8 characters')).toBeTruthy();
    expect(svc.updateUser).toHaveBeenCalledTimes(1);
  });

  it('a 403 on demoting the last super admin shows inline and keeps the form', async () => {
    svc.updateUser.mockRejectedValueOnce(new ApiError('Cannot demote the last SUPER_ADMIN', 403));
    renderAt('/users/u4');
    const panel = await screen.findByRole('dialog', { name: 'Asha T' });
    fireEvent.change(await within(panel).findByLabelText('Role'), { target: { value: 'EDITOR' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect((await within(panel).findByRole('alert')).textContent).toBe(LAST_SUPER_ADMIN);
    expect((within(panel).getByLabelText('Role') as HTMLSelectElement).value).toBe('EDITOR');
    expect(screen.queryByText('User updated')).toBeNull();
  });

  it('deleting asks once in a dialog (never window.confirm) and removes the user', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    renderAt('/users/u3');
    const panel = await screen.findByRole('dialog', { name: 'Rahul M' });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Delete user' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Delete Rahul M?' })).getByRole('button', { name: 'Yes, delete' }));
    await waitFor(() => expect(svc.deleteUser).toHaveBeenCalledWith('u3'));
    await waitFor(() => expect(where()).toBe('/users'));
    expect(within(table()).queryByText('Rahul M')).toBeNull();
    expect(await screen.findByText('User deleted')).toBeTruthy();
    expect(confirm).not.toHaveBeenCalled();
  });

  it('the last super admin: a 403 on delete shows inline, the user stays, no success toast', async () => {
    svc.deleteUser.mockRejectedValueOnce(new ApiError('Cannot delete the last SUPER_ADMIN', 403));
    renderAt('/users/u4');
    const panel = await screen.findByRole('dialog', { name: 'Asha T' });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Delete user' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete' }));
    expect((await within(panel).findByRole('alert')).textContent).toBe(LAST_SUPER_ADMIN);
    expect(where()).toBe('/users/u4');
    expect(within(table()).getByText('Asha T')).toBeTruthy();
    expect(screen.queryByText('User deleted')).toBeNull();
  });

  it('create: checks fields first; a duplicate email (409) shows under Email with no toast', async () => {
    svc.createUser.mockRejectedValueOnce(new ApiError('A record with the same unique value already exists', 409));
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'New user' }));
    expect(where()).toBe('/users/new');
    const panel = screen.getByRole('dialog', { name: 'New user' });
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Sunita Y' } });
    fireEvent.change(within(panel).getByLabelText('Email'), { target: { value: 'priya@x.in' } });
    fireEvent.change(within(panel).getByLabelText('Temporary password'), { target: { value: 'short' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create user' }));
    expect(within(panel).getByText('At least 8 characters')).toBeTruthy();
    expect(svc.createUser).not.toHaveBeenCalled();
    fireEvent.change(within(panel).getByLabelText('Temporary password'), { target: { value: 'long-enough-1' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create user' }));
    expect(await within(panel).findByText(DUPLICATE_EMAIL)).toBeTruthy();
    expect(svc.createUser).toHaveBeenCalledWith({ name: 'Sunita Y', email: 'priya@x.in', password: 'long-enough-1', role: 'VIEWER' });
    expect(screen.queryByText(/Could not create user/)).toBeNull();
  });

  it('a successful create opens the new user', async () => {
    svc.createUser.mockImplementationOnce(async (d: { name: string; email: string; role: User['role'] }) => {
      const created = u('u9', d.name, d.email, d.role);
      USERS = [created, ...USERS];
      return created;
    });
    renderAt('/users/new');
    const panel = screen.getByRole('dialog', { name: 'New user' });
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Sunita Y' } });
    fireEvent.change(within(panel).getByLabelText('Email'), { target: { value: 'sunita@x.in' } });
    fireEvent.change(within(panel).getByLabelText('Temporary password'), { target: { value: 'long-enough-1' } });
    fireEvent.change(within(panel).getByLabelText('Role'), { target: { value: 'EDITOR' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create user' }));
    await waitFor(() => expect(where()).toBe('/users/u9'));
    expect(await screen.findByRole('dialog', { name: 'Sunita Y' })).toBeTruthy();
    expect(await screen.findByText('User created')).toBeTruthy();
  });

  it('a failed list shows Could not load users with Try again', async () => {
    svc.getUsers.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    renderAt();
    expect(await screen.findByText('Could not load users')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await within(table()).findByText('Priya S')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run both to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/useUserManager.test.tsx src/pages/Users.test.tsx`
Expected: FAIL:
- the hook test: `validateUser is not a function`
- the page test: "Failed to resolve import './Users'"

- [ ] **Step 4: Type the update payload** in `admin/src/services/user.service.ts`. Replace the `updateUser` function with:

```ts
/** PATCH /admin/users/:id — send only what changes; `password` only when a new one was typed. */
export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: User['role'];
  password?: string;
}

export function updateUser(id: string, data: UpdateUserData) {
  return apiFetch<User>(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}
```

- [ ] **Step 5: Rewrite `admin/src/hooks/useUserManager.ts`**

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getUsers, createUser, updateUser, deleteUser, type UpdateUserData } from '../services/user.service';
import { useToast } from '../context/ToastContext';
import { ApiError, fieldErrorMap } from '../services/api-client';
import { describeError } from '../utils/api-error';
import { useDebouncedValue } from './useDebouncedValue';
import { SEARCH_DEBOUNCE_MS } from './useResourceList';
import type { User } from '../types';

export type UserRole = User['role'];
export interface UserForm { name: string; email: string; role: UserRole; password: string }
export type SaveOutcome<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string>; banner: string | null };

/** GET /admin/users returns at most this many (newest first). */
export const USER_LIST_CAP = 200;
export const MIN_PASSWORD = 8;
export const ROLE_OPTIONS: { value: UserRole; label: string; hint: string }[] = [
  { value: 'VIEWER', label: 'Viewer', hint: 'read only' },
  { value: 'EDITOR', label: 'Editor', hint: 'can update results' },
  { value: 'SUPER_ADMIN', label: 'Super admin', hint: 'full access' },
];
export const EMPTY_USER: UserForm = { name: '', email: '', role: 'VIEWER', password: '' };
export const LAST_SUPER_ADMIN = 'This is the last super admin. Make another user a super admin first.';
export const DUPLICATE_EMAIL = 'An account with this email already exists';

export const roleLabel = (role: UserRole) => ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role;
export const sameUserForm = (a: UserForm, b: UserForm) => a.name === b.name && a.email === b.email && a.role === b.role && a.password === b.password;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** What the server would reject, checked first. A new user needs a password; an edit only checks one that was typed. */
export function validateUser(form: UserForm, requirePassword: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  const email = form.email.trim();
  if (!email) errors.email = 'Email is required';
  else if (!EMAIL.test(email)) errors.email = 'Enter a valid email address';
  if ((requirePassword || form.password) && form.password.length < MIN_PASSWORD) errors.password = `At least ${MIN_PASSWORD} characters`;
  return errors;
}

/**
 * Failures shown inside the panel instead of a toast: 403 (the last SUPER_ADMIN cannot be removed or demoted),
 * 409 (duplicate email; the backend sends no field list) and 400 field errors. null → the caller toasts.
 */
export function panelError(err: unknown): { fields: Record<string, string>; banner: string | null } | null {
  if (!(err instanceof ApiError)) return null;
  if (err.status === 403) {
    return { fields: {}, banner: /last super_?admin/i.test(err.message) ? LAST_SUPER_ADMIN : 'You do not have permission to change this user.' };
  }
  if (err.status === 409) return { fields: { email: DUPLICATE_EMAIL }, banner: null };
  const fields = fieldErrorMap(err);
  return Object.keys(fields).length > 0 ? { fields, banner: null } : null;
}

/** PATCH body: trimmed name and email; the role unless it is your own account; the password only when typed. */
export function userPatch(form: UserForm, isSelf: boolean): UpdateUserData {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    ...(isSelf ? {} : { role: form.role }),
    ...(form.password ? { password: form.password } : {}),
  };
}

/**
 * CONTROLLER: Users. The list (max 200) is loaded once and filtered in memory on the debounced search.
 * Saves return a SaveOutcome so the panel can show field errors / the last-super-admin message inline.
 */
export function useUserManager() {
  const { toast, toastError } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await getUsers());
    } catch (err) {
      setError(describeError(err, 'Could not load users'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)) : users;
  }, [users, query]);

  const run = async <T>(action: () => Promise<T>, success: string, failure: string): Promise<SaveOutcome<T>> => {
    setSaving(true);
    try {
      const value = await action();
      toast(success);
      return { ok: true, value };
    } catch (err) {
      const shown = panelError(err);
      if (shown) return { ok: false, ...shown };
      toastError(err, failure);
      return { ok: false, fields: {}, banner: null };
    } finally {
      setSaving(false);
    }
  };

  const create = async (form: UserForm) => {
    const out = await run(
      () => createUser({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role }),
      'User created',
      'Could not create user',
    );
    if (out.ok) await reload();
    return out;
  };

  const update = async (id: string, data: UpdateUserData) => {
    const out = await run(() => updateUser(id, data), 'User updated', 'Could not save user');
    if (out.ok) setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...out.value } : u)));
    return out;
  };

  const remove = async (id: string) => {
    const out = await run(async () => { await deleteUser(id); return true as const; }, 'User deleted', 'Could not delete user');
    if (out.ok) setUsers((prev) => prev.filter((u) => u.id !== id));
    return out;
  };

  return { users, visible, loading, error, search, setSearch, saving, capped: users.length >= USER_LIST_CAP, reload, create, update, remove };
}
```

- [ ] **Step 6: Create `admin/src/components/entity/users/UserPanel.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import {
  EMPTY_USER, MIN_PASSWORD, ROLE_OPTIONS, sameUserForm, userPatch, validateUser,
  type SaveOutcome, type UserForm, type UserRole,
} from '../../../hooks/useUserManager';
import type { UpdateUserData } from '../../../services/user.service';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { PasswordInput } from '../../ui/PasswordInput';
import { Button } from '../../ui/Button';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import type { User } from '../../../types';

interface UserPanelProps {
  /** From the loaded list (there is no GET-by-id); null while loading, after a failed load, or for an unknown id. */
  user: User | null;
  isSelf: boolean;
  listLoading: boolean;
  listError: string | null;
  saving: boolean;
  onRetry: () => void;
  onClose: () => void;
  onSave: (data: UpdateUserData) => Promise<SaveOutcome<User>>;
  onDelete: () => Promise<SaveOutcome<true>>;
  onDeleted: () => void;
}

const toForm = (u: User): UserForm => ({ name: u.name, email: u.email, role: u.role, password: '' });

/** One account: name, email, role, an optional new password, and Delete. The page keys it by id. */
export function UserPanel({ user, isSelf, listLoading, listError, saving, onRetry, onClose, onSave, onDelete, onDeleted }: UserPanelProps) {
  const [form, setForm] = useState<UserForm>(() => (user ? toForm(user) : EMPTY_USER));
  const [saved, setSaved] = useState<UserForm>(() => (user ? toForm(user) : EMPTY_USER));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const formRef = useRef(form);
  formRef.current = form;

  // A deep link can open the panel before the list arrives: take the record once, when it does.
  const filled = useRef(!!user);
  useEffect(() => {
    if (user && !filled.current) {
      filled.current = true;
      const next = toForm(user);
      setForm(next);
      setSaved(next);
    }
  }, [user]);

  const dirty = !sameUserForm(form, saved);
  useUnsavedGuard(dirty);
  const set = (patch: Partial<UserForm>) => setForm({ ...form, ...patch });

  const save = async () => {
    const problems = validateUser(form, false);
    setErrors(problems);
    setBanner(null);
    if (Object.keys(problems).length > 0) return;
    const submitted = form;
    const out = await onSave(userPatch(submitted, isSelf));
    if (out.ok) {
      // The submitted values are the new baseline; edits typed during the save stay dirty.
      const next = { ...submitted, name: submitted.name.trim(), email: submitted.email.trim(), password: '' };
      setSaved(next);
      if (sameUserForm(formRef.current, submitted)) setForm(next);
    } else {
      setErrors(out.fields);
      setBanner(out.banner);
    }
  };

  const remove = async () => {
    setDeleting(true);
    const out = await onDelete();
    setDeleting(false);
    setConfirmDelete(false);
    if (out.ok) onDeleted();
    else setBanner(out.banner);
  };

  const roleHint = isSelf ? 'You cannot change your own role.' : ROLE_OPTIONS.find((o) => o.value === form.role)?.hint;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={user?.name || 'User'}
      description={user?.email}
      footer={user ? (
        <PanelFooter
          dirty={dirty}
          saving={saving}
          canSave={!!form.name.trim() && !!form.email.trim()}
          onCancel={() => { setForm(saved); setErrors({}); setBanner(null); }}
          onSave={() => { void save(); }}
        />
      ) : undefined}
    >
      {!user ? (
        listLoading ? <p className="py-10 text-center text-sm text-muted">Loading user…</p>
          : listError
            ? <EmptyState title="Could not load users" description={listError} action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>} />
            : <EmptyState title="User not found" description="The account may have been deleted. Close this panel to go back to the list." />
      ) : (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-5">
          {banner && <div role="alert" className="rounded-control border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad-text">{banner}</div>}
          <FormSection title="Account">
            <Field label="Name" error={errors.name}>
              <Input value={form.name} invalid={!!errors.name} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Email" error={errors.email}>
              <Input type="email" value={form.email} invalid={!!errors.email} autoComplete="off" onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Role" error={errors.role} hint={roleHint}>
              <Select value={form.role} disabled={isSelf} onChange={(e) => set({ role: e.target.value as UserRole })}>
                {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
              </Select>
            </Field>
          </FormSection>
          <FormSection title="Password">
            <PasswordInput
              label="Set new password"
              autoComplete="new-password"
              value={form.password}
              error={errors.password}
              hint={`Leave empty to keep the current password. At least ${MIN_PASSWORD} characters.`}
              onChange={(e) => set({ password: e.target.value })}
            />
          </FormSection>
          <FormSection title="Remove access">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-ink-2">
                {isSelf ? 'You cannot delete your own account.' : 'They are signed out and can no longer sign in. Their audit log entries are kept.'}
              </p>
              <Button size="sm" variant="danger" disabled={isSelf || deleting} onClick={() => setConfirmDelete(true)}>Delete user</Button>
            </div>
          </FormSection>
          <button type="submit" hidden aria-hidden tabIndex={-1} />
        </form>
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${user?.name ?? 'this user'}?`}
        description="They are signed out at once and can no longer sign in. Their audit log entries are kept."
        confirmLabel="Yes, delete"
        busy={deleting}
        onConfirm={() => { void remove(); }}
        onCancel={() => setConfirmDelete(false)}
      />
    </Sheet>
  );
}
```

- [ ] **Step 7: Create `admin/src/components/entity/users/UserCreatePanel.tsx`**

```tsx
import { useState } from 'react';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { EMPTY_USER, MIN_PASSWORD, ROLE_OPTIONS, sameUserForm, validateUser, type SaveOutcome, type UserForm, type UserRole } from '../../../hooks/useUserManager';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { PasswordInput } from '../../ui/PasswordInput';
import { PanelFooter } from '../PanelFooter';
import type { User } from '../../../types';

interface UserCreatePanelProps {
  saving: boolean;
  onCreate: (form: UserForm) => Promise<SaveOutcome<User>>;
  onCreated: (user: User) => void;
  onClose: () => void;
}

/** /users/new: name, email, temporary password, role. */
export function UserCreatePanel({ saving, onCreate, onCreated, onClose }: UserCreatePanelProps) {
  const [form, setForm] = useState<UserForm>(EMPTY_USER);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const dirty = !sameUserForm(form, EMPTY_USER);
  useUnsavedGuard(dirty);
  const set = (patch: Partial<UserForm>) => setForm({ ...form, ...patch });

  const submit = async () => {
    if (saving) return;
    const problems = validateUser(form, true);
    setErrors(problems);
    setBanner(null);
    if (Object.keys(problems).length > 0) return;
    const out = await onCreate(form);
    if (out.ok) onCreated(out.value);
    else { setErrors(out.fields); setBanner(out.banner); }
  };

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title="New user"
      description="They sign in with this email and the temporary password."
      footer={
        <PanelFooter
          dirty={dirty}
          saving={saving}
          canSave={!!form.name.trim() && !!form.email.trim() && !!form.password}
          onCancel={() => { setForm(EMPTY_USER); setErrors({}); setBanner(null); }}
          onSave={() => { void submit(); }}
          saveLabel="Create user"
        />
      }
    >
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-5">
        {banner && <div role="alert" className="rounded-control border border-bad/30 bg-bad-soft px-3 py-2 text-xs text-bad-text">{banner}</div>}
        <FormSection title="Account">
          <Field label="Name" error={errors.name}>
            <Input value={form.name} invalid={!!errors.name} autoComplete="off" onChange={(e) => set({ name: e.target.value })} />
          </Field>
          <Field label="Email" error={errors.email}>
            <Input type="email" value={form.email} invalid={!!errors.email} autoComplete="off" onChange={(e) => set({ email: e.target.value })} />
          </Field>
          <PasswordInput
            label="Temporary password"
            autoComplete="new-password"
            value={form.password}
            error={errors.password}
            hint={`At least ${MIN_PASSWORD} characters.`}
            onChange={(e) => set({ password: e.target.value })}
          />
          <Field label="Role" error={errors.role}>
            <Select value={form.role} onChange={(e) => set({ role: e.target.value as UserRole })}>
              {ROLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label} — {o.hint}</option>)}
            </Select>
          </Field>
        </FormSection>
        <button type="submit" hidden aria-hidden tabIndex={-1} />
      </form>
    </Sheet>
  );
}
```

- [ ] **Step 8: Create `admin/src/pages/Users.tsx`**

```tsx
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { NEW_ID, useEntityRoute } from '../hooks/useEntityRoute';
import { roleLabel, useUserManager, USER_LIST_CAP } from '../hooks/useUserManager';
import { EntityPage } from '../components/entity/EntityPage';
import { UserPanel } from '../components/entity/users/UserPanel';
import { UserCreatePanel } from '../components/entity/users/UserCreatePanel';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge, type Tone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatIstDate } from '../utils/time';
import type { User } from '../types';

const ROLE_TONE: Record<User['role'], Tone> = { SUPER_ADMIN: 'accent', EDITOR: 'ok', VIEWER: 'muted' };

/** PAGE: Users (SUPER_ADMIN) — accounts table + panel at /users/:id, create at /users/new. */
export default function Users() {
  const { user: me } = useAuth();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/users', editorDirty);
  const m = useUserManager();
  const id = route.id;
  const selected = id && !route.isNew ? m.users.find((u) => u.id === id) ?? null : null;

  const columns: Column<User>[] = [
    {
      key: 'user', header: 'User',
      cell: (u) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink">{u.name}</span>
            {u.id === me?.id && <Badge tone="muted">You</Badge>}
          </div>
          <div className="truncate text-xs text-muted">{u.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', cell: (u) => <Badge tone={ROLE_TONE[u.role]}>{roleLabel(u.role)}</Badge> },
    { key: 'created', header: 'Created', className: 'whitespace-nowrap text-xs text-ink-2', cell: (u) => (u.created_at ? formatIstDate(u.created_at) : '—') },
  ];

  const panel = !id ? null : route.isNew ? (
    <UserCreatePanel saving={m.saving} onCreate={m.create} onCreated={(u) => route.open(u.id, { force: true })} onClose={() => route.close()} />
  ) : (
    <UserPanel
      key={id}
      user={selected}
      isSelf={id === me?.id}
      listLoading={m.loading}
      listError={m.error}
      saving={m.saving}
      onRetry={() => { void m.reload(); }}
      onClose={() => route.close()}
      onSave={(data) => m.update(id, data)}
      onDelete={() => m.remove(id)}
      onDeleted={() => route.close({ force: true })}
    />
  );

  return (
    <EntityPage
      header={
        <PageHeader
          title="Users"
          count={m.users.length}
          subtitle="Who can sign in to the admin panel"
          actions={<Button variant="primary" onClick={() => route.open(NEW_ID)}><Plus size={16} aria-hidden />New user</Button>}
        />
      }
      toolbar={
        <Toolbar>
          <SearchInput label="Search users" placeholder="Search by name or email…" value={m.search} onChange={m.setSearch} />
          {m.capped && <span className="text-xs text-muted">Showing first {USER_LIST_CAP}</span>}
        </Toolbar>
      }
      table={
        <DataTable
          label="Users"
          columns={columns}
          rows={m.visible}
          rowKey={(u) => u.id}
          selectedKey={id}
          onRowClick={(u) => route.open(u.id)}
          loading={m.loading}
          empty={m.error
            ? <EmptyState title="Could not load users" description={m.error} action={<Button variant="outline" size="sm" onClick={() => { void m.reload(); }}>Try again</Button>} />
            : m.users.length === 0
              ? <EmptyState title="No users yet" description="Create the first account with New user." />
              : <EmptyState title="No users match" description="Try a different name or email." />}
        />
      }
      panel={panel}
    />
  );
}
```

- [ ] **Step 9: Route, bare path, `@source`; delete the old page.**

  a. In `admin/src/App.tsx`:
  - Replace `import UserManager from './pages/UserManager';` with `import Users from './pages/Users';`.
  - Replace the `users` route line with:

```tsx
                <Route path="users/*" element={<ProtectedRoute roles={['SUPER_ADMIN']}><Users /></ProtectedRoute>} />
```

  b. In `admin/src/components/Layout.tsx`, append `'/users'` to `BARE_PATHS`.

  c. In `admin/src/theme/tailwind.css`, add `@source "../pages/Users.tsx";` after `@source "../pages/Feedback.tsx";`.

  d. Delete the old page and check nothing else uses it:

```bash
git rm admin/src/pages/UserManager.tsx
grep -rn "UserManager\|handleUpdateRole\|handleCreate: handleSave" admin/src
```

Expected: the grep prints nothing. `components/common/FieldError.tsx` is now unused; Task 13 deletes it.

- [ ] **Step 10: Run the two test files**

Run: `cd admin && npx vitest run src/hooks/useUserManager.test.tsx src/pages/Users.test.tsx`
Expected: PASS (5 + 10 tests).

- [ ] **Step 11: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. `tsc` accepts the generic arrow `async <T>(…)` in the `.ts` hook file.

- [ ] **Step 12: Commit**

```bash
git add admin/src/pages/Users.tsx admin/src/pages/Users.test.tsx admin/src/components/entity/users admin/src/hooks/useUserManager.ts admin/src/hooks/useUserManager.test.tsx admin/src/services/user.service.ts admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: users as table + panel (create, edit with optional password, single delete confirm, self and last-admin guards)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Audit logs (real filters, inclusive IST dates, readable rows, safe CSV, JSON panel)

This task covers decisions §6 and the page map's Audit section. It fixes these bugs:
- The admin name now comes from the `users` relation (Task 5 typed it).
- The action options are the three real actions plus "Any action". The entity options are result, election and constituency (shown as "Seat").
- `from` and `to` are IST calendar days sent as `YYYY-MM-DDT00:00:00.000+05:30` / `YYYY-MM-DDT23:59:59.999+05:30`, so both ends are included. The filters are labelled "(IST)".
- From after To shows a message and sends no request.
- Stale stored filters are reset.
- Errors render, with Try again.
- The table keeps its rows while refreshing. `DataTable` only shows "Loading…" when it has no rows.
- "Showing latest 200" appears when the cap is reached.
- CSV fields are all quoted, with inner quotes doubled. They include the before/after JSON. A leading `=`, `+`, `@`, tab or CR is prefixed with `'` against spreadsheet formulas. The file starts with a BOM, so Excel reads it as UTF-8.
- A row opens a side panel at `/logs/:id` with the full PRE/POST JSON, pretty-printed.

**Files:**
- Create: `admin/src/utils/csv.ts`, `admin/src/components/entity/audit/AuditPanel.tsx`
- Rewrite: `admin/src/services/audit.service.ts`, `admin/src/pages/AuditLogs.tsx`
- Modify:
  - `admin/src/App.tsx` (route `logs/*`)
  - `admin/src/components/Layout.tsx` (append `'/logs'`)
  - `admin/src/theme/tailwind.css` (`@source "../pages/AuditLogs.tsx"`)
- Test: `admin/src/services/audit.service.test.ts`, `admin/src/utils/csv.test.ts`, `admin/src/pages/AuditLogs.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 2: `useResourceList` (`sanitizeFilters`)
  - from Task 5:
    - `AUDIT_ACTIONS`, `AUDIT_ENTITIES`, `actionLabel`, `actionTone`, `auditActor`, `describeAudit`, `entityLabel`, `isAuditAction`, `isAuditEntity`
    - `formatIst`, `isIsoDay`, `istDayStart`, `istDayEnd`
  - from Phase 2: `useEntityRoute('/logs')`, `EntityPage`, `Sheet`, `PageHeader`, `Toolbar`, `Select`, `Input`, `DataTable`, `EmptyState`, `Badge`, `Button`, `renderEntityPage`
- Produces:
  - `services/audit.service.ts`:
    - `AUDIT_LIMIT = 200`
    - `interface AuditFilters { user_id?: string; action?: string; entity_type?: string; from?: string; to?: string }`
    - `getAuditLogs(filters?: AuditFilters): Promise<AuditLog[]>`. `from` / `to` are `YYYY-MM-DD`; any other value is dropped.
  - `utils/csv.ts`: `csvField(v: unknown): string`, `toCsv(header: string[], rows: unknown[][]): string`, `auditCsv(logs: AuditLog[]): string`, `downloadCsv(filename: string, text: string): void`.
  - `AuditPanel({ log, listLoading, listError, onRetry, onClose })`, with `log: AuditLog | null`.
  - `RANGE_ERROR`, exported from `pages/AuditLogs.tsx`.

- [ ] **Step 1: Write the failing service test** `admin/src/services/audit.service.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';

const api = vi.hoisted(() => ({ apiFetch: vi.fn(async (_path: string) => [] as unknown[]) }));
vi.mock('./api-client', () => api);
import { getAuditLogs } from './audit.service';

afterEach(() => api.apiFetch.mockClear());
const query = () => new URL(`http://x${api.apiFetch.mock.calls[0][0]}`).searchParams;

describe('getAuditLogs (Review Focus 3)', () => {
  it('sends From and To as the start and end of the IST day, so the whole day is included', async () => {
    await getAuditLogs({ action: 'RESULT_OVERRIDE', entity_type: 'result', from: '2026-10-01', to: '2026-10-01' });
    expect(query().get('from')).toBe('2026-10-01T00:00:00.000+05:30');
    expect(query().get('to')).toBe('2026-10-01T23:59:59.999+05:30');
    expect(query().get('action')).toBe('RESULT_OVERRIDE');
    expect(query().get('entity_type')).toBe('result');
    // '+' must be percent-encoded, or the server would read a space.
    expect(api.apiFetch.mock.calls[0][0]).toContain('%2B05%3A30');
  });

  it('no filters → no query string; a value that is not a day is dropped', async () => {
    await getAuditLogs();
    expect(api.apiFetch).toHaveBeenLastCalledWith('/admin/audit-logs');
    api.apiFetch.mockClear();
    await getAuditLogs({ from: '01/10/2026', to: '' });
    expect(api.apiFetch).toHaveBeenLastCalledWith('/admin/audit-logs');
  });
});
```

- [ ] **Step 2: Write the failing CSV test** `admin/src/utils/csv.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { auditCsv, csvField, toCsv } from './csv';
import type { AuditLog } from '../types';

describe('csvField', () => {
  it.each([
    ['plain', '"plain"'],
    ['a "quoted" word', '"a ""quoted"" word"'],
    ['one, two', '"one, two"'],
    ['line1\nline2', '"line1\nline2"'],
    [null, '""'],
    [undefined, '""'],
    [42, '"42"'],
    [{ votes: 5 }, '"{""votes"":5}"'],
    ['=HYPERLINK("http://x")', '"\'=HYPERLINK(""http://x"")"'],
    ['+91 98765', '"\'+91 98765"'],
    ['@sum', '"\'@sum"'],
    ['-12', '"-12"'],
  ])('%j → %s', (value, expected) => expect(csvField(value)).toBe(expected));
});

describe('toCsv and auditCsv', () => {
  it('joins with commas and CRLF line ends', () => {
    expect(toCsv(['A', 'B'], [[1, 'x,y']])).toBe('"A","B"\r\n"1","x,y"\r\n');
  });

  it('one row per entry with the admin, IST and UTC time, labels and the before/after JSON', () => {
    const logs: AuditLog[] = [{
      id: 'l1', user_id: null, users: null, action: 'RESULT_OVERRIDE', entity_type: 'result', entity_id: 'r1',
      old_value: { votes: 60000, status: 'TRAILING' }, new_value: { votes: 61204, status: 'LEADING' }, timestamp: '2026-10-01T08:00:00.000Z',
    }];
    const [header, row] = auditCsv(logs).split('\r\n');
    expect(header).toBe('"Time (IST)","Time (UTC)","Admin","Admin email","Action","Entity type","Entity ID","Before","After"');
    expect(row).toBe('"01 Oct 2026, 13:30","2026-10-01T08:00:00.000Z","Deleted user","","Result override","Result","r1",'
      + '"{""votes"":60000,""status"":""TRAILING""}","{""votes"":61204,""status"":""LEADING""}"');
  });
});
```

- [ ] **Step 3: Write the failing page test** `admin/src/pages/AuditLogs.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AuditLog } from '../types';

const svc = vi.hoisted(() => ({ getAuditLogs: vi.fn() }));
vi.mock('../services/audit.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/audit.service')>()),
  getAuditLogs: svc.getAuditLogs,
}));
import AuditLogs, { RANGE_ERROR } from './AuditLogs';
import { renderEntityPage } from '../test-utils/entity-harness';
import { ApiError } from '../services/api-client';

const LOGS: AuditLog[] = [
  {
    id: 'l1', user_id: 'u1', users: { id: 'u1', email: 'priya@x.in', name: 'Priya S', role: 'EDITOR' },
    action: 'SEAT_LOCK_TAKEOVER', entity_type: 'constituency', entity_id: 'k145', old_value: { user_name: 'Rahul M' }, new_value: { user_name: 'Priya S' },
    timestamp: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 'l2', user_id: null, users: null, action: 'RESULT_BULK_OVERRIDE', entity_type: 'election', entity_id: 'e1',
    old_value: null, new_value: { results_updated: 3, constituencies_with_rounds: 1 }, timestamp: '2026-10-01T07:00:00.000Z',
  },
  {
    id: 'l3', user_id: 'u2', users: { id: 'u2', email: 'mannu@x.in', name: 'Mannu K', role: 'SUPER_ADMIN' },
    action: 'RESULT_OVERRIDE', entity_type: 'result', entity_id: 'r1',
    old_value: { votes: 60000, status: 'TRAILING', margin: 0 }, new_value: { votes: 61204, status: 'LEADING', margin: 12214 },
    timestamp: '2026-10-01T06:00:00.000Z',
  },
];

beforeEach(() => { svc.getAuditLogs.mockImplementation(async () => LOGS); });
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/logs') => renderEntityPage('/logs', <AuditLogs />, at);
const table = () => screen.getByRole('table', { name: 'Audit log' });
const rowOf = (text: string) => within(table()).getByText(text).closest('tr')!;

describe('Audit logs page', () => {
  it('shows the admin from the users relation, readable action labels and IST times', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    expect(within(rowOf('Priya S')).getByText('Seat lock take-over')).toBeTruthy();
    expect(within(rowOf('Priya S')).getByText('01 Oct 2026, 13:30')).toBeTruthy();
    expect(within(rowOf('Deleted user')).getByText('Seat save (bulk)')).toBeTruthy();
    expect(within(rowOf('Mannu K')).getByText('Result override')).toBeTruthy();
    expect(within(rowOf('Mannu K')).getByText('Before → after')).toBeTruthy();
    expect(screen.getByText('3 entries')).toBeTruthy();
  });

  it('filter options are the real actions and entities plus "Any"', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    const options = (label: string) => within(screen.getByLabelText(label)).getAllByRole('option').map((o) => o.textContent);
    expect(options('Action')).toEqual(['Any action', 'Result override', 'Seat save (bulk)', 'Seat lock take-over']);
    expect(options('Entity')).toEqual(['Any entity', 'Result', 'Election', 'Seat']);
    fireEvent.change(screen.getByLabelText('Action'), { target: { value: 'SEAT_LOCK_TAKEOVER' } });
    await waitFor(() => expect(svc.getAuditLogs).toHaveBeenLastCalledWith({ action: 'SEAT_LOCK_TAKEOVER', entity_type: '', from: '', to: '' }));
  });

  it('a stale stored filter (old fake actions) is reset to Any (Review Focus 3)', async () => {
    localStorage.setItem('audit_logs_filters', JSON.stringify({ action: 'MANIFEST_PUBLISH', entity_type: 'manifest', from: 'yesterday', to: '' }));
    renderAt();
    await within(table()).findByText('Priya S');
    expect(svc.getAuditLogs).toHaveBeenCalledWith({ action: '', entity_type: '', from: '', to: '' });
    expect((screen.getByLabelText('Action') as HTMLSelectElement).value).toBe('');
  });

  it('From = To passes that day; From after To says so and sends no request (Review Focus 3)', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    fireEvent.change(screen.getByLabelText('From (IST)'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To (IST)'), { target: { value: '2026-10-01' } });
    await waitFor(() => expect(svc.getAuditLogs).toHaveBeenLastCalledWith({ action: '', entity_type: '', from: '2026-10-01', to: '2026-10-01' }));
    const calls = svc.getAuditLogs.mock.calls.length;
    fireEvent.change(screen.getByLabelText('From (IST)'), { target: { value: '2026-10-05' } });
    expect(await screen.findByText(RANGE_ERROR)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 0));
    expect(svc.getAuditLogs.mock.calls.length).toBe(calls);
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(svc.getAuditLogs).toHaveBeenLastCalledWith({ action: '', entity_type: '', from: '', to: '' }));
  });

  it('Refresh keeps the rows on screen while it reloads', async () => {
    renderAt();
    await within(table()).findByText('Priya S');
    svc.getAuditLogs.mockImplementationOnce(() => new Promise(() => {}));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(within(table()).getByText('Priya S')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('a failed load shows the error with Try again', async () => {
    svc.getAuditLogs.mockRejectedValueOnce(new ApiError('Internal server error', 500));
    renderAt();
    expect(await screen.findByText('Could not load audit logs')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await within(table()).findByText('Priya S')).toBeTruthy();
  });

  it('Download CSV quotes every field and includes the change JSON', async () => {
    let blob: Blob | undefined;
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((b: Blob) => { blob = b; return 'blob:audit'; }) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderAt();
    await within(table()).findByText('Priya S');
    fireEvent.click(screen.getByRole('button', { name: 'Download CSV' }));
    expect(click).toHaveBeenCalledTimes(1);
    // jsdom's Blob has no text(); FileReader decodes UTF-8 (and drops the BOM).
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(blob!);
    });
    expect(text.replace(/^\ufeff/, '').startsWith('"Time (IST)","Time (UTC)","Admin"')).toBe(true);
    expect(text).toContain('"Deleted user"');
    expect(text).toContain('"{""votes"":61204,""status"":""LEADING"",""margin"":12214}"');
  });

  it('a row opens the panel with the full before/after JSON', async () => {
    renderAt();
    fireEvent.click(await within(table()).findByText('Mannu K'));
    expect(screen.getByTestId('where').textContent).toBe('/logs/l3');
    const panel = await screen.findByRole('dialog', { name: 'Result override' });
    expect(within(within(panel).getByRole('region', { name: 'Before' })).getByText(/"votes": 60000/)).toBeTruthy();
    expect(within(within(panel).getByRole('region', { name: 'After' })).getByText(/"margin": 12214/)).toBeTruthy();
    expect(within(panel).getByText('mannu@x.in', { exact: false })).toBeTruthy();
  });

  it('a deep link to an unknown entry says not found', async () => {
    renderAt('/logs/nope');
    await within(table()).findByText('Priya S');
    expect(await within(screen.getByRole('dialog')).findByText('Audit entry not found')).toBeTruthy();
  });

  it('says "Showing latest 200" when the cap is reached', async () => {
    svc.getAuditLogs.mockImplementation(async () => Array.from({ length: 200 }, (_, i) => ({ ...LOGS[2], id: `x${i}` })));
    renderAt();
    expect(await screen.findByText('Showing latest 200')).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run the three to confirm they fail**

Run: `cd admin && npx vitest run src/services/audit.service.test.ts src/utils/csv.test.ts src/pages/AuditLogs.test.tsx`
Expected: FAIL:
- service: `from` is `2026-10-01`, not `…+05:30`
- csv: "Failed to resolve import './csv'"
- page: the old `RANGE_ERROR` export is missing, and there is no table named "Audit log"

- [ ] **Step 5: Rewrite `admin/src/services/audit.service.ts`**

```ts
import { apiFetch } from './api-client';
import { istDayEnd, istDayStart } from '../utils/time';
import type { AuditLog } from '../types';

/** GET /admin/audit-logs returns at most this many entries, newest first. */
export const AUDIT_LIMIT = 200;

export interface AuditFilters {
  user_id?: string;
  action?: string;
  entity_type?: string;
  /** IST calendar day, YYYY-MM-DD (a date input's value); included from 00:00 IST. */
  from?: string;
  /** IST calendar day, YYYY-MM-DD; included until 23:59:59.999 IST. */
  to?: string;
}

export async function getAuditLogs(filters: AuditFilters = {}) {
  const params = new URLSearchParams();
  if (filters.user_id) params.set('user_id', filters.user_id);
  if (filters.action) params.set('action', filters.action);
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  const from = filters.from ? istDayStart(filters.from) : '';
  const to = filters.to ? istDayEnd(filters.to) : '';
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return (await apiFetch<AuditLog[]>(`/admin/audit-logs${qs ? `?${qs}` : ''}`)) || [];
}
```

- [ ] **Step 6: Create `admin/src/utils/csv.ts`**

```ts
import type { AuditLog } from '../types';
import { actionLabel, auditActor, entityLabel } from './audit';
import { formatIst } from './time';

/**
 * One RFC 4180 field: always quoted, inner quotes doubled; objects become JSON. A leading = + @ tab or CR
 * gets a ' so a spreadsheet does not run it as a formula ('-' is left alone: negative numbers).
 */
export function csvField(value: unknown): string {
  let s = value === null || value === undefined ? '' : typeof value === 'string' ? value : typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/^[=+@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return `${[header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n')}\r\n`;
}

export function auditCsv(logs: AuditLog[]): string {
  return toCsv(
    ['Time (IST)', 'Time (UTC)', 'Admin', 'Admin email', 'Action', 'Entity type', 'Entity ID', 'Before', 'After'],
    logs.map((l) => [
      formatIst(l.timestamp), l.timestamp, auditActor(l), l.users?.email ?? '', actionLabel(l.action), entityLabel(l.entity_type),
      l.entity_id, l.old_value ?? '', l.new_value ?? '',
    ]),
  );
}

/** Hands `text` to the browser as a download. The BOM makes Excel read it as UTF-8. */
export function downloadCsv(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 7: Create `admin/src/components/entity/audit/AuditPanel.tsx`**

```tsx
import { Sheet } from '../../ui/Sheet';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { actionLabel, actionTone, auditActor, describeAudit, entityLabel } from '../../../utils/audit';
import { formatIst } from '../../../utils/time';
import type { AuditLog } from '../../../types';

interface AuditPanelProps {
  /** From the loaded list (there is no GET-by-id). */
  log: AuditLog | null;
  listLoading: boolean;
  listError: string | null;
  onRetry: () => void;
  onClose: () => void;
}

function JsonBlock({ title, value }: { title: string; value: unknown }) {
  return (
    <section aria-label={title} className="space-y-1.5">
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      {value === null || value === undefined
        ? <p className="text-xs text-muted">None</p>
        : <pre className="max-h-72 overflow-auto rounded-control border border-line bg-subtle p-3 font-mono text-xs text-ink">{JSON.stringify(value, null, 2)}</pre>}
    </section>
  );
}

/** One audit entry, read-only, with the full before/after values. The page keys it by id. */
export function AuditPanel({ log, listLoading, listError, onRetry, onClose }: AuditPanelProps) {
  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={log ? actionLabel(log.action) : 'Audit entry'}
      description={log ? `${formatIst(log.timestamp)} (IST)` : undefined}
    >
      {!log ? (
        listLoading ? <p className="py-10 text-center text-sm text-muted">Loading entry…</p>
          : listError
            ? <EmptyState title="Could not load audit logs" description={listError} action={<Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>} />
            : <EmptyState title="Audit entry not found" description="It may be older than the latest 200 or outside the filters. Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5 text-sm">
          <p className="text-ink">{describeAudit(log)}</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-xs text-muted">Admin</dt>
            <dd className="text-ink">{auditActor(log)}{log.users?.email && <span className="ml-1 text-muted">({log.users.email})</span>}</dd>
            <dt className="text-xs text-muted">Action</dt>
            <dd><Badge tone={actionTone(log.action)}>{actionLabel(log.action)}</Badge></dd>
            <dt className="text-xs text-muted">Entity</dt>
            <dd className="text-ink">{entityLabel(log.entity_type)}</dd>
            <dt className="text-xs text-muted">Entity ID</dt>
            <dd className="break-all font-mono text-xs text-ink-2">{log.entity_id}</dd>
            <dt className="text-xs text-muted">Time (UTC)</dt>
            <dd className="font-mono text-xs text-ink-2">{log.timestamp}</dd>
          </dl>
          <JsonBlock title="Before" value={log.old_value} />
          <JsonBlock title="After" value={log.new_value} />
        </div>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 8: Rewrite `admin/src/pages/AuditLogs.tsx`**

```tsx
import { Download, RefreshCw } from 'lucide-react';
import { AUDIT_LIMIT, getAuditLogs } from '../services/audit.service';
import { useResourceList } from '../hooks/useResourceList';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { EntityPage } from '../components/entity/EntityPage';
import { AuditPanel } from '../components/entity/audit/AuditPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { Toolbar } from '../components/ui/Toolbar';
import { Input, Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { AUDIT_ACTIONS, AUDIT_ENTITIES, actionLabel, actionTone, auditActor, entityLabel, isAuditAction, isAuditEntity } from '../utils/audit';
import { auditCsv, downloadCsv } from '../utils/csv';
import { formatIst, isIsoDay } from '../utils/time';
import type { AuditLog } from '../types';

type Filters = { action: string; entity_type: string; from: string; to: string };
const NO_FILTERS: Filters = { action: '', entity_type: '', from: '', to: '' };

export const RANGE_ERROR = 'The From date is after the To date. Pick a From date on or before the To date.';
const rangeError = (f: Filters) => (f.from && f.to && f.from > f.to ? RANGE_ERROR : null);

const COLUMNS: Column<AuditLog>[] = [
  { key: 'time', header: 'Time (IST)', className: 'whitespace-nowrap text-xs text-ink-2', cell: (l) => formatIst(l.timestamp) },
  {
    key: 'admin', header: 'Admin',
    cell: (l) => (
      <div className="min-w-0">
        <div className="truncate font-medium text-ink">{auditActor(l)}</div>
        {l.users?.email && <div className="truncate text-xs text-muted">{l.users.email}</div>}
      </div>
    ),
  },
  { key: 'action', header: 'Action', cell: (l) => <Badge tone={actionTone(l.action)}>{actionLabel(l.action)}</Badge> },
  { key: 'entity', header: 'Entity', className: 'text-ink-2', cell: (l) => entityLabel(l.entity_type) },
  { key: 'id', header: 'Entity ID', className: 'max-w-[180px] truncate font-mono text-[11px] text-muted', cell: (l) => <span title={l.entity_id}>{l.entity_id}</span> },
  {
    key: 'change', header: 'Change', className: 'whitespace-nowrap text-xs text-ink-2',
    cell: (l) => {
      const parts = [l.old_value != null ? 'Before' : null, l.new_value != null ? (l.old_value != null ? 'after' : 'After') : null].filter(Boolean);
      return parts.length ? parts.join(' → ') : <span className="text-muted">—</span>;
    },
  },
];

/** PAGE: Audit logs (SUPER_ADMIN) — the latest 200 entries, filterable; panel at /logs/:id. */
export default function AuditLogs() {
  const route = useEntityRoute('/logs');
  const list = useResourceList<Filters>({
    key: 'audit_logs',
    initialFilters: NO_FILTERS,
    // Older builds stored actions the backend never writes; an unknown value would silently return nothing.
    sanitizeFilters: (f) => ({
      action: isAuditAction(f.action) ? f.action : '',
      entity_type: isAuditEntity(f.entity_type) ? f.entity_type : '',
      from: isIsoDay(f.from) ? f.from : '',
      to: isIsoDay(f.to) ? f.to : '',
    }),
    onLoad: async (_page, _search, f) => {
      if (rangeError(f)) return { data: [], total: 0 };
      const data = await getAuditLogs(f);
      return { data, total: data.length };
    },
  });
  const logs = list.items as AuditLog[];
  const f = list.filters;
  const invalidRange = rangeError(f);
  const hasFilters = !!(f.action || f.entity_type || f.from || f.to);
  const selected = route.id ? logs.find((l) => l.id === route.id) ?? null : null;
  const exportCsv = () => downloadCsv(`audit-logs-${new Date().toISOString().slice(0, 10)}.csv`, auditCsv(logs));

  return (
    <EntityPage
      header={
        <PageHeader
          title="Audit logs"
          subtitle="Result overrides, seat saves and lock take-overs · times in IST"
          actions={
            <>
              <Button variant="outline" disabled={logs.length === 0} onClick={exportCsv}><Download size={14} aria-hidden />Download CSV</Button>
              <Button variant="outline" disabled={list.loading} onClick={() => { void list.refresh(); }}><RefreshCw size={14} aria-hidden />Refresh</Button>
            </>
          }
        />
      }
      toolbar={
        <Toolbar>
          <Select aria-label="Action" className="w-52" value={f.action} onChange={(e) => list.updateFilters({ action: e.target.value })}>
            <option value="">Any action</option>
            {AUDIT_ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
          </Select>
          <Select aria-label="Entity" className="w-40" value={f.entity_type} onChange={(e) => list.updateFilters({ entity_type: e.target.value })}>
            <option value="">Any entity</option>
            {AUDIT_ENTITIES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            From (IST)
            <Input type="date" className="w-40" value={f.from} max={f.to || undefined} onChange={(e) => list.updateFilters({ from: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink-2">
            To (IST)
            <Input type="date" className="w-40" value={f.to} min={f.from || undefined} onChange={(e) => list.updateFilters({ to: e.target.value })} />
          </label>
          {hasFilters && <Button size="sm" variant="ghost" onClick={() => list.updateFilters(NO_FILTERS)}>Clear filters</Button>}
          <span className="ml-auto text-xs text-muted">
            {logs.length >= AUDIT_LIMIT ? `Showing latest ${AUDIT_LIMIT}` : `${logs.length.toLocaleString('en-IN')} ${logs.length === 1 ? 'entry' : 'entries'}`}
          </span>
        </Toolbar>
      }
      table={
        <>
          {invalidRange && <div role="alert" className="rounded-card border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn-text">{invalidRange}</div>}
          {list.error && logs.length > 0 && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/30 bg-bad-soft px-4 py-2.5 text-sm text-bad-text">
              {list.error}
              <Button size="sm" variant="outline" onClick={() => { void list.refresh(); }}>Try again</Button>
            </div>
          )}
          <DataTable
            label="Audit log"
            columns={COLUMNS}
            rows={logs}
            rowKey={(l) => l.id}
            selectedKey={route.id}
            onRowClick={(l) => route.open(l.id)}
            loading={list.loading}
            empty={list.error
              ? <EmptyState title="Could not load audit logs" description={list.error} action={<Button variant="outline" size="sm" onClick={() => { void list.refresh(); }}>Try again</Button>} />
              : invalidRange
                ? <EmptyState title="Fix the dates" description="No entries can match this range." />
                : hasFilters
                  ? <EmptyState title="No entries match" description="Try other filters, or clear them." />
                  : <EmptyState title="No audit entries yet" description="Result overrides, seat saves and lock take-overs appear here." />}
          />
        </>
      }
      panel={route.id ? (
        <AuditPanel
          key={route.id}
          log={selected}
          listLoading={list.loading}
          listError={list.error}
          onRetry={() => { void list.refresh(); }}
          onClose={() => route.close()}
        />
      ) : null}
    />
  );
}
```

- [ ] **Step 9: Route, bare path, `@source`.**

  a. In `admin/src/App.tsx`, replace the `logs` route line with:

```tsx
                <Route path="logs/*" element={<ProtectedRoute roles={['SUPER_ADMIN']}><AuditLogs /></ProtectedRoute>} />
```

  b. In `admin/src/components/Layout.tsx`, append `'/logs'` to `BARE_PATHS`.

  c. In `admin/src/theme/tailwind.css`, add `@source "../pages/AuditLogs.tsx";` after `@source "../pages/Users.tsx";`.

- [ ] **Step 10: Run the three test files**

Run: `cd admin && npx vitest run src/services/audit.service.test.ts src/utils/csv.test.ts src/pages/AuditLogs.test.tsx`
Expected: PASS (2 + 14 + 10 tests).

- [ ] **Step 11: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. Task 6's Dashboard calls `getAuditLogs()` with no argument, which the new default `filters = {}` accepts.

- [ ] **Step 12: Commit**

```bash
git add admin/src/services/audit.service.ts admin/src/services/audit.service.test.ts admin/src/utils/csv.ts admin/src/utils/csv.test.ts admin/src/components/entity/audit admin/src/pages/AuditLogs.tsx admin/src/pages/AuditLogs.test.tsx admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: audit logs with real filters, inclusive IST days, readable rows, safe CSV and a JSON panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: System status in Tailwind (manual refresh state, stale-data note)

This task covers decisions §7. The page keeps the same data, cards and 10 s polling: `useSystemStatus` is **unchanged** and the `SystemStatusView` export stays. What changes:
- **Look:** Tailwind cards and a Tailwind slowest-routes table, with sentence-case copy.
- **Refresh button:** it reads "Refresh" / "Refreshing…" for a **manual** refresh only. Background polls never flip it. The page tracks the manual refresh itself and passes that as `loading`.
- **Failed poll:** when a poll fails after data was shown, a note says "Could not refresh: <error>. Showing data from hh:mm:ss (IST)." and the last good data stays.
- **Scrolling:** the page root has its own scroll.

**Files:**
- Rewrite: `admin/src/pages/SystemStatus.tsx`
- Modify:
  - `admin/src/pages/SystemStatus.test.tsx`
  - `admin/src/components/Layout.tsx` (append `'/status'`)
  - `admin/src/theme/tailwind.css` (`@source "../pages/SystemStatus.tsx"`)

**Interfaces:**
- Consumes:
  - `useSystemStatus(fetcher?, intervalMs?)` → `{ status, error, loading, refresh }` (unchanged)
  - `SystemStatus` type (`services/status.service`)
  - `clockIst` (Task 5)
  - `PageHeader`, `Button`
- Produces: `SystemStatusView({ status, error, loading, onRefresh }: { status: Status | null; error: string | null; loading: boolean; onRefresh: () => void })`, where `loading` now means "a manual refresh is running".

- [ ] **Step 1: Update the tests** in `admin/src/pages/SystemStatus.test.tsx`.

  a. Below the existing `import { useSystemStatus } from '../hooks/useSystemStatus';` line, add:

```tsx
import SystemStatusPage from './SystemStatus';
```

  b. Directly above `afterEach(() => { cleanup(); vi.useRealTimers(); });`, add a mock of the service. Only the page wrapper uses it; the hook tests pass their own fetcher.

```tsx
const statusSvc = vi.hoisted(() => ({ getSystemStatus: vi.fn() }));
vi.mock('../services/status.service', () => statusSvc);
```

  c. Replace the test `it('manual refresh calls onRefresh and errors show an alert', …)` with:

```tsx
  it('manual refresh calls onRefresh; the button is sentence case; a first-load error is an alert', () => {
    const onRefresh = vi.fn();
    render(<SystemStatusView status={null} error="boom" loading={false} onRefresh={onRefresh} />);
    expect(screen.getByRole('alert').textContent).toContain('Could not load status: boom');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('REFRESH')).toBeNull();
  });

  it('while a manual refresh runs the button reads "Refreshing…" and is disabled', () => {
    render(<SystemStatusView status={fixture} error={null} loading onRefresh={() => {}} />);
    const button = screen.getByRole('button', { name: 'Refreshing…' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('a failed poll keeps the last data and says how old it is', () => {
    render(<SystemStatusView status={fixture} error="Network error — check your connection" loading={false} onRefresh={() => {}} />);
    expect(screen.getByRole('alert').textContent).toBe('Could not refresh: Network error — check your connection. Showing data from 15:30:00 (IST).');
    expect(screen.getByText('2h 1m')).toBeTruthy();
  });

  it('renders the cards as labelled sections with sentence-case titles', () => {
    render(<SystemStatusView status={fixture} error={null} loading={false} onRefresh={() => {}} />);
    for (const name of ['Uptime and version', 'Traffic', 'Cache', 'Redis', 'Live', 'Database', 'Slowest routes']) {
      expect(screen.getByRole('region', { name })).toBeTruthy();
    }
    expect(screen.getByRole('table', { name: 'Slowest routes' })).toBeTruthy();
  });
```

  d. Append a new `describe` at the end of the file:

```tsx
describe('SystemStatus page', () => {
  it('a background load does not flip the button; a manual refresh does', async () => {
    let release!: (s: SystemStatus) => void;
    statusSvc.getSystemStatus.mockImplementationOnce(() => new Promise<SystemStatus>((r) => { release = r; }));
    render(<SystemStatusPage />);
    expect((screen.getByRole('button', { name: 'Refresh' }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { release(fixture); });
    expect(screen.getByText('2h 1m')).toBeTruthy();
    let releaseManual!: (s: SystemStatus) => void;
    statusSvc.getSystemStatus.mockImplementationOnce(() => new Promise<SystemStatus>((r) => { releaseManual = r; }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(screen.getByRole('button', { name: 'Refreshing…' })).toBeTruthy();
    await act(async () => { releaseManual(fixture); });
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
  });
});
```

The first test, "renders every card from the fixture", stays as it is. Its strings are unchanged: "2h 1m", "0.1.0 (abc123def456)", "75%", the route, "842 ms", "down", "none yet", "4 ms", /Since restart/ and "Origin shield 403".

- [ ] **Step 2: Run them to confirm they fail**

Run: `cd admin && npx vitest run src/pages/SystemStatus.test.tsx`
Expected: FAIL:
- no button named "Refresh" (it says "REFRESH")
- no "Refreshing…"
- no stale-data note
- no regions, because the cards are `aria-label`led `section`s titled "Uptime & version"
- the page test sees "REFRESHING" during the background load

- [ ] **Step 3: Rewrite `admin/src/pages/SystemStatus.tsx`**

```tsx
import { useState, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSystemStatus } from '../hooks/useSystemStatus';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import { clockIst } from '../utils/time';
import type { SystemStatus as Status } from '../services/status.service';

function formatUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}
const pct = (r: number | null) => (r === null ? 'n/a' : `${Math.round(r * 100)}%`);
const num = (n: number) => n.toLocaleString('en-IN');

/** PAGE: System status — in-memory counters since the last backend restart. Polls every 10 s (useSystemStatus). */
export default function SystemStatus() {
  const { status, error, refresh } = useSystemStatus();
  // Only a click shows "Refreshing…": the 10 s background polls must not make the button flicker.
  const [manual, setManual] = useState(false);
  const onRefresh = async () => {
    setManual(true);
    try { await refresh(); } finally { setManual(false); }
  };
  return <SystemStatusView status={status} error={error} loading={manual} onRefresh={() => { void onRefresh(); }} />;
}

export function SystemStatusView({ status, error, loading, onRefresh }: {
  status: Status | null; error: string | null; loading: boolean; onRefresh: () => void;
}) {
  return (
    <div className="tw-ui h-full overflow-y-auto bg-page font-sans text-ink">
      <div className="space-y-4 p-6">
        <PageHeader
          title="System status"
          subtitle="Counters are kept in memory and reset when the backend restarts"
          actions={
            <Button variant="primary" disabled={loading} onClick={onRefresh}>
              <RefreshCw size={14} aria-hidden className={cn(loading && 'animate-spin')} />
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />
        {error && (status ? (
          <div role="alert" className="rounded-card border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn-text">
            Could not refresh: {error}. Showing data from {clockIst(status.generatedAt)} (IST).
          </div>
        ) : (
          <div role="alert" className="rounded-card border border-bad/30 bg-bad-soft px-4 py-2.5 text-sm text-bad-text">
            Could not load status: {error}
          </div>
        ))}
        {!status && !error && <p className="text-sm text-muted">Loading…</p>}
        {status && <Cards s={status} />}
        <p className="text-xs text-muted">
          Since restart{status ? ` (${new Date(status.process.startedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })})` : ''}. Auto-refreshes every 10 s while this tab is visible.
        </p>
      </div>
    </div>
  );
}

function Cards({ s }: { s: Status }) {
  const { http, cache, redis, live, db, process: p } = s;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
      <Card title="Uptime and version">
        <Row k="Uptime" v={formatUptime(p.uptimeSeconds)} />
        <Row k="Version" v={`${p.appVersion}${p.gitSha ? ` (${p.gitSha})` : ''}`} />
        <Row k="Node" v={p.nodeVersion} />
        <Row k="Memory" v={`${p.memory.rssMb} MB rss / ${p.memory.heapUsedMb} MB heap`} />
      </Card>
      <Card title="Traffic">
        <Row k="Total requests" v={num(http.total)} />
        <Row k="Last 5 min" v={`${http.last5m.requestsPerMin}/min, 5xx ${http.last5m.errors5xxPerMin}/min`} />
        <Row k="Last 60 min" v={`${http.last60m.requestsPerMin}/min, 5xx ${http.last60m.errors5xxPerMin}/min`} />
        <Row k="2xx / 3xx" v={`${num(http.byClass['2xx'])} / ${num(http.byClass['3xx'])}`} />
        <Row k="4xx" v={num(http.byClass['4xx'])} />
        <Row k="5xx" v={num(http.byClass['5xx'])} bad={http.byClass['5xx'] > 0} />
        <Row k="429 throttled" v={num(http.throttled429)} />
        <Row k="Origin shield 403" v={num(http.shieldRejected403 ?? 0)} />
      </Card>
      <Card title="Cache">
        <Row k="Hit rate" v={pct(cache.hitRate)} />
        <Row k="Hits / misses" v={`${num(cache.hits)} / ${num(cache.misses)}`} />
        <Row k="Redis fallbacks" v={num(cache.fallbacks)} bad={cache.fallbacks > 0} />
      </Card>
      <Card title="Redis">
        <Row k="Publisher" v={redis.pubReady ? 'ready' : 'down'} bad={!redis.pubReady} />
        <Row k="Subscriber" v={redis.subReady ? 'ready' : 'down'} bad={!redis.subReady} />
        <Row k="Publishes" v={num(redis.publishes)} />
        <Row k="Publish errors" v={num(redis.publishErrors)} bad={redis.publishErrors > 0} />
      </Card>
      <Card title="Live">
        <Row k="SSE connections" v={num(live.sseConnections)} />
        <Row k="Events published" v={num(live.eventsPublished)} />
        <Row k="Overrides applied" v={num(live.overridesApplied)} />
        <Row k="Overrides / min (5 min)" v={String(live.overridesPerMin)} />
        <Row k="Last override" v={live.lastOverrideAt ? new Date(live.lastOverrideAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'none yet'} />
      </Card>
      <Card title="Database">
        <Row k="SELECT 1" v={db.ok ? `${db.latencyMs} ms` : 'failed'} bad={!db.ok} />
        <Row k="Pool connection limit" v={db.pool.connectionLimit === null ? 'default' : String(db.pool.connectionLimit)} />
      </Card>
      <Card title="Slowest routes" note="p95 of the last ≤200 requests within 60 min" className="col-span-full">
        <table aria-label="Slowest routes" className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-2">
              <th scope="col" className="py-2 pr-3 font-medium">Route</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">p95</th>
              <th scope="col" className="py-2 pl-3 text-right font-medium">Samples</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line border-t border-line">
            {http.slowestRoutes.map((r) => (
              <tr key={r.route}>
                <td className="py-2 pr-3 font-mono text-xs text-ink">{r.route}</td>
                <td className="px-3 py-2 text-right tabular-nums text-ink">{r.p95Ms} ms</td>
                <td className="py-2 pl-3 text-right tabular-nums text-ink-2">{r.samples}</td>
              </tr>
            ))}
            {http.slowestRoutes.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-xs text-muted">No traffic recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function Card({ title, note, className, children }: { title: string; note?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className={cn('rounded-card border border-line bg-card p-4 shadow-sm', className)}>
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      <div className="mt-3 space-y-1">{children}</div>
    </section>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5 text-sm">
      <span className="text-ink-2">{k}</span>
      <span className={cn('font-semibold tabular-nums', bad ? 'text-bad-text' : 'text-ink')}>{v}</span>
    </div>
  );
}
```

- [ ] **Step 4: Bare path and `@source`.**
  - In `admin/src/components/Layout.tsx`, append `'/status'` to `BARE_PATHS`.
  - In `admin/src/theme/tailwind.css`, add `@source "../pages/SystemStatus.tsx";` after `@source "../pages/AuditLogs.tsx";`.

- [ ] **Step 5: Run the test file**

Run: `cd admin && npx vitest run src/pages/SystemStatus.test.tsx`
Expected: PASS (5 view tests + 2 hook tests + 1 page test). The hook tests, "loads, polls every interval…" and "surfaces a failed load as an error", are unchanged and still pass. They pass their own `fetcher`, so the `status.service` mock does not affect them.

- [ ] **Step 6: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. `grep -n "AdminPageHeader\|admin-table\|card-elevated\|var(--" admin/src/pages/SystemStatus.tsx` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add admin/src/pages/SystemStatus.tsx admin/src/pages/SystemStatus.test.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: system status in Tailwind; Refreshing only on manual refresh; stale-data note

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Manifest editor (1/2) — always-open sections and Tailwind controls; Alliances and Tracked

This task covers decisions §8 and the user's "no click-to-expand" rule. It changes four files:
- **`ManifestSection`** becomes a plain `<section>`, labelled by its title. It shows the count badge, an optional badge and the description, and its body is **always** rendered. There is no toggle, no `aria-expanded` and no `defaultOpen`; no caller passes `defaultOpen`, and Step 1 checks this.
- **`SharedControls`** is rebuilt with `components/ui` (`Input`, `Button`):
  - Export names and props are kept, because the editors import them. The local `EmptyState` keeps its name; editors import it from `./SharedControls`, not `ui/EmptyState`.
  - The comboboxes get `role="combobox"`, a listbox, options and a label, and Esc closes the list.
  - New exports: `ColorDot`, `Chip`, `RemoveButton` and `DraftInput`. `DraftInput` is a text field that keeps typed text that does not parse yet; Task 12 uses it.
  - The clickable `<span className="mf-chip-x">` becomes a labelled button.
- **`AllianceEditor`** and **`TrackedEditor`** are rebuilt on these. Their props, data and `onUpdate` payloads are unchanged, and their copy becomes sentence case.

Watchlists and the misc editors follow in Task 12. Until then they keep their legacy classes but sit inside the new always-open sections.

**Files:**
- Rewrite: `admin/src/components/manifest/ManifestSection.tsx`, `SharedControls.tsx`, `AllianceEditor.tsx`, `TrackedEditor.tsx`
- Modify:
  - `admin/src/theme/tailwind.css` (`@source "../components/manifest"`)
  - `admin/src/pages/Manifests.test.tsx` (two assertions that read legacy classes)
- Test: `admin/src/components/manifest/manifest.test.tsx`

**Interfaces:**
- Consumes: `Input`, `InputProps` (`components/ui/Input`), `Button`, `Badge`, `cn`; `Alliance`, `Party` (`types`).
- Produces:
  - **`ManifestSection`:** `ManifestSection({ title, description?, count?, badge?, children })`, rendering `<section aria-labelledby>`.
  - **`SharedControls`, unchanged signatures:**
    - `updateAt`, `removeAt`, `moveItem`
    - `EmptyState({ text, action? })`
    - `ItemRow({ index, onRemove, onMoveUp?, onMoveDown?, showOrder?, children })`
    - `AddButton({ label, onClick })`
    - `SearchableSelect<T>({ value?, options, onSelect, placeholder?, getLabel, getValue, filter, renderItem, maxWidth?, label? })`. `label` is new and optional; it falls back to `placeholder`.
    - `PartySearch({ parties, onSelect, placeholder?, label? })`
    - `ChipSelect({ selected, options, onAdd, onRemove, renderChip?, label? })`
  - **`SharedControls`, new:**
    - `ColorDot({ color?: string | null })`
    - `Chip({ label: string; color?: string | null; onRemove(): void; removeLabel?: string })`
    - `RemoveButton({ label: string; onClick(): void })`
    - `DraftInput(props: Omit<InputProps, 'value' | 'onChange'> & { value: string; onCommit(text: string): string | null })`. `onCommit` returns the canonical text it saved, or `null` when the text was not committed.
  - **Accessible names the tests and Task 12 rely on:**
    - "Move item N up" / "Move item N down" / "Remove item N"
    - "Alliance N colour" / "Alliance N ID" / "Alliance N name" / "Remove alliance <name>"
    - "Remove <party> from <alliance>"
    - the combobox "Add party"
    - the combobox "Add to the tally" (Tracked)

- [ ] **Step 1: Check that no caller passes `defaultOpen`**

```bash
grep -rn "defaultOpen" admin/src
```

Expected: only `admin/src/components/manifest/ManifestSection.tsx` prints (the prop's own declaration). If anything else prints, remove that prop at the call site in this task.

- [ ] **Step 2: Write the failing component test** `admin/src/components/manifest/manifest.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ManifestSection } from './ManifestSection';
import { ChipSelect, DraftInput, ItemRow, SearchableSelect, moveItem } from './SharedControls';
import { AllianceEditor } from './AllianceEditor';
import { TrackedEditor } from './TrackedEditor';
import type { Alliance, Party } from '../../types';

const party = (id: string, color: string | null = '#f97316'): Party => ({
  id, name: `${id} party`, color, symbol_url: null, eci_symbol_url: null, abbreviation: id,
  leader_name: null, founded_year: null, headquarters: null, website: null, wikipedia_url: null, description: null,
});
const PARTIES = [party('BJP'), party('JDU', '#22c55e'), party('INC', '#0ea5e9')];
const partyMap = new Map(PARTIES.map((p) => [p.id, p]));
const NDA: Alliance = { id: 'NDA', name: 'NDA', color: '#f97316', parties: ['BJP', 'JDU'] };
/** Any legacy admin.css class left in the markup. */
const LEGACY = '[class*="mf-"],[class*="form-input"],[class*="form-select"],.btn,.spinner,.admin-table,.striped';

afterEach(cleanup);

describe('ManifestSection', () => {
  it('is an always-open, labelled section: no toggle, the body always rendered', () => {
    render(<ManifestSection title="Milestones" description="Lines on the tally" count={2}><p>Body</p></ManifestSection>);
    const section = screen.getByRole('region', { name: 'Milestones' });
    expect(within(section).getByText('Body')).toBeTruthy();
    expect(within(section).getByText('2')).toBeTruthy();
    expect(within(section).getByText('Lines on the tally')).toBeTruthy();
    expect(within(section).queryByRole('button')).toBeNull();
    expect(section.querySelector('[aria-expanded]')).toBeNull();
    expect(section.querySelector(LEGACY)).toBeNull();
  });

  it('hides a zero count', () => {
    render(<ManifestSection title="Tracked" count={0}><p>Body</p></ManifestSection>);
    expect(within(screen.getByRole('region', { name: 'Tracked' })).queryByText('0')).toBeNull();
  });
});

describe('SharedControls', () => {
  it('ItemRow has labelled move and remove buttons', () => {
    const onUp = vi.fn();
    const onDown = vi.fn();
    const onRemove = vi.fn();
    render(<ItemRow index={1} showOrder onMoveUp={onUp} onMoveDown={onDown} onRemove={onRemove}><span>Row</span></ItemRow>);
    fireEvent.click(screen.getByRole('button', { name: 'Move item 2 up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move item 2 down' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect([onUp.mock.calls.length, onDown.mock.calls.length, onRemove.mock.calls.length]).toEqual([1, 1, 1]);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('moveItem ignores a move past either end', () => {
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 3)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });

  it('SearchableSelect shows the selected label, filters, picks on mouse down and closes on Esc', () => {
    const onSelect = vi.fn();
    render(
      <SearchableSelect
        label="Party" value="JDU" options={PARTIES} onSelect={onSelect} placeholder="Party…"
        getLabel={(p) => p.abbreviation || p.name} getValue={(p) => p.id}
        filter={(p, q) => p.name.toLowerCase().includes(q)} renderItem={(p) => <span>{p.name}</span>}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Party' }) as HTMLInputElement;
    expect(input.value).toBe('JDU');
    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.change(input, { target: { value: 'inc' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'INC party' }));
    expect(onSelect).toHaveBeenCalledWith('INC');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('ChipSelect lists unselected matches while typing, adds on pick, and removes with the chip button', () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    const options = [{ value: 'BJP', label: 'BJP party' }, { value: 'JDU', label: 'JDU party' }];
    render(<ChipSelect label="Add party" selected={['BJP']} options={options} onAdd={onAdd} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove BJP party' }));
    expect(onRemove).toHaveBeenCalledWith('BJP');
    const input = screen.getByRole('combobox', { name: 'Add party' });
    fireEvent.focus(input);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(input, { target: { value: 'party' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['JDU partyJDU']);
    fireEvent.mouseDown(screen.getByRole('option'));
    expect(onAdd).toHaveBeenCalledWith('JDU');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('DraftInput keeps text that does not parse yet, and follows changes made elsewhere', () => {
    function Harness() {
      const [nums, setNums] = useState<number[]>([1]);
      return (
        <>
          <DraftInput
            aria-label="Seats"
            value={nums.join(', ')}
            onCommit={(t) => {
              const next = t.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
              setNums(next);
              return next.join(', ');
            }}
          />
          <button type="button" onClick={() => setNums([9])}>reset</button>
          <output>{nums.join('|')}</output>
        </>
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText('Seats') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1,' } });
    expect(input.value).toBe('1,');
    fireEvent.change(input, { target: { value: '1, 2' } });
    expect(screen.getByRole('status').textContent).toBe('1|2');
    fireEvent.click(screen.getByText('reset'));
    expect(input.value).toBe('9');
  });
});

describe('AllianceEditor', () => {
  it('edits fields, adds a party from the search, removes a party chip and the alliance', () => {
    const onUpdate = vi.fn();
    const { container } = render(<AllianceEditor alliances={[NDA]} contestingParties={PARTIES} partyMap={partyMap} onUpdate={onUpdate} />);
    expect(screen.getByRole('region', { name: 'Alliances' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Alliance 1 name'), { target: { value: 'NDA+' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...NDA, name: 'NDA+' }]);
    fireEvent.change(screen.getByLabelText('Alliance 1 colour'), { target: { value: '#111111' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...NDA, color: '#111111' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove JDU from NDA' }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...NDA, parties: ['BJP'] }]);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Add party' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: /INC party/ }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...NDA, parties: ['BJP', 'JDU', 'INC'] }]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove alliance NDA' }));
    expect(onUpdate).toHaveBeenLastCalledWith([]);
    expect(container.querySelector(LEGACY)).toBeNull();
  });

  it('Add alliance appends an empty one; with none, a plain note shows', () => {
    const onUpdate = vi.fn();
    render(<AllianceEditor alliances={[]} contestingParties={PARTIES} partyMap={partyMap} onUpdate={onUpdate} />);
    expect(screen.getByText('No alliances configured')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add alliance' }));
    expect(onUpdate).toHaveBeenCalledWith([{ id: '', name: '', color: '#666666', parties: [] }]);
  });
});

describe('TrackedEditor', () => {
  it('shows alliance or party labels, removes with the chip button and adds from the search', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TrackedEditor
        tracked={['NDA', 'INC']}
        trackedOptions={[{ id: 'NDA', name: 'NDA' }, { id: 'INC', name: 'INC party' }, { id: 'JDU', name: 'JDU party' }]}
        alliances={[NDA]} partyMap={partyMap} onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove INC' }));
    expect(onUpdate).toHaveBeenLastCalledWith(['NDA']);
    const input = screen.getByRole('combobox', { name: 'Add to the tally' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'jd' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /JDU party/ }));
    expect(onUpdate).toHaveBeenLastCalledWith(['NDA', 'INC', 'JDU']);
    expect(container.querySelector(LEGACY)).toBeNull();
  });
});
```

- [ ] **Step 3: Update the two Manifests page tests that read legacy classes** in `admin/src/pages/Manifests.test.tsx`.

  a. Replace `it('Edit shows the existing editors with their legacy styles; an EDITOR has no Publish button', …)` with:

```tsx
  it('Edit shows the editors; an EDITOR has no Publish button', async () => {
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    expect(within(panel).queryByRole('button', { name: 'Publish' })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    expect(within(panel).getByRole('region', { name: 'Milestones' })).toBeTruthy();
    expect(within(panel).getByRole('region', { name: 'Alliances' })).toBeTruthy();
  });
```

  b. Replace `it('Edit renders every editor section expanded', …)` with:

```tsx
  it('Edit renders every editor section open, with no expand toggle', async () => {
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    expect(within(panel).getAllByRole('region').length).toBeGreaterThanOrEqual(8);
    expect(panel.querySelector('button[aria-expanded]')).toBeNull();
  });
```

- [ ] **Step 4: Run them to confirm they fail**

Run: `cd admin && npx vitest run src/components/manifest/manifest.test.tsx src/pages/Manifests.test.tsx`
Expected: FAIL:
- "Unable to find role="region"": `ManifestSection` is still a `div.mf-section`.
- `DraftInput` is not exported.
- "Unable to find a label with the text of: Alliance 1 name".

- [ ] **Step 5: Rewrite `admin/src/components/manifest/ManifestSection.tsx`**

```tsx
import { useId, type ReactNode } from 'react';
import { Badge } from '../ui/Badge';

/**
 * One manifest editor section. Always open (no collapse toggle — core content is never hidden behind a click):
 * title, count, optional badge and a one-line description, then the body.
 */
export function ManifestSection({
  title,
  description,
  count,
  badge,
  children,
}: {
  title: string;
  description?: string;
  count?: number;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="rounded-card border border-line bg-card shadow-sm">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-4 py-3">
        <h3 id={headingId} className="text-sm font-semibold text-ink">{title}</h3>
        {count !== undefined && count > 0 && <Badge tone="accent" className="tabular-nums">{count.toLocaleString('en-IN')}</Badge>}
        {badge}
        {description && <p className="w-full text-xs text-ink-2">{description}</p>}
      </header>
      <div className="space-y-2 p-4">{children}</div>
    </section>
  );
}
```

- [ ] **Step 6: Rewrite `admin/src/components/manifest/SharedControls.tsx`**

```tsx
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Input, type InputProps } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Party } from '../../types';

// ── Helpers ──

export function updateAt<T>(arr: T[], idx: number, patch: Partial<T>): T[] {
  return arr.map((item, i) => i === idx ? { ...item, ...patch } : item);
}

export function removeAt<T>(arr: T[], idx: number): T[] {
  return arr.filter((_, i) => i !== idx);
}

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const copy = [...arr];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

// ── Shared UI Components ──

/** Party / alliance colour swatch; a missing colour shows the strong border colour. */
export function ColorDot({ color }: { color?: string | null }) {
  return <span aria-hidden className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: color || 'var(--color-line-strong)' }} />;
}

/** "Nothing here yet" note inside a section (not ui/EmptyState, which is a page-level block). */
export function EmptyState({ text, action }: { text: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-dashed border-line-strong bg-subtle px-3 py-2.5 text-xs text-muted">
      <span>{text}</span>
      {action}
    </div>
  );
}

export function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="shrink-0 rounded-control p-1 text-muted hover:bg-bad-soft hover:text-bad-text"
    >
      <X size={14} aria-hidden />
    </button>
  );
}

export function ItemRow({ index, onRemove, onMoveUp, onMoveDown, showOrder, children }: {
  index: number; onRemove: () => void; onMoveUp?: () => void; onMoveDown?: () => void; showOrder?: boolean; children: ReactNode;
}) {
  const n = index + 1;
  return (
    <div className="flex items-center gap-2 rounded-control border border-line bg-card px-2.5 py-2">
      {showOrder && (
        <div className="flex shrink-0 flex-col items-center">
          <button type="button" aria-label={`Move item ${n} up`} onClick={onMoveUp} className="rounded-control p-0.5 text-muted hover:bg-subtle hover:text-ink">
            <ChevronUp size={14} aria-hidden />
          </button>
          <span className="text-[11px] tabular-nums text-muted">{n}</span>
          <button type="button" aria-label={`Move item ${n} down`} onClick={onMoveDown} className="rounded-control p-0.5 text-muted hover:bg-subtle hover:text-ink">
            <ChevronDown size={14} aria-hidden />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      <RemoveButton label={`Remove item ${n}`} onClick={onRemove} />
    </div>
  );
}

export function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" className="text-accent hover:text-accent-hover" onClick={onClick}>
      <Plus size={14} aria-hidden />{label}
    </Button>
  );
}

/** A party or alliance chip with a labelled remove button. */
export function Chip({ label, color, onRemove, removeLabel }: { label: string; color?: string | null; onRemove: () => void; removeLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-card py-0.5 pl-2 pr-1 text-xs text-ink" style={color ? { borderColor: color } : undefined}>
      {color && <ColorDot color={color} />}
      {label}
      <button type="button" aria-label={removeLabel ?? `Remove ${label}`} onClick={onRemove} className="rounded-full p-0.5 text-muted hover:bg-subtle hover:text-ink">
        <X size={12} aria-hidden />
      </button>
    </span>
  );
}

/**
 * A text field for values that are parsed as you type (seat lists, map centre). The typed text is kept while it
 * does not parse yet ("1," on the way to "1, 2"); a change from elsewhere (JSON tab, Cancel) replaces it.
 * `onCommit` saves what it can and returns the canonical text it saved, or null when nothing was saved.
 */
export function DraftInput({ value, onCommit, ...props }: Omit<InputProps, 'value' | 'onChange'> & { value: string; onCommit: (text: string) => string | null }) {
  const [text, setText] = useState(value);
  const expected = useRef(value);
  useEffect(() => {
    if (value !== expected.current) {
      expected.current = value;
      setText(value);
    }
  }, [value]);
  return (
    <Input
      {...props}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const saved = onCommit(e.target.value);
        if (saved !== null) expected.current = saved;
      }}
    />
  );
}

// ── Searchable Select Components ──

export function SearchableSelect<T>({
  value,
  options,
  onSelect,
  placeholder,
  getLabel,
  getValue,
  filter,
  renderItem,
  maxWidth,
  label,
}: {
  value?: string;
  options: T[];
  onSelect: (val: string) => void;
  placeholder?: string;
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  filter: (item: T, query: string) => boolean;
  renderItem: (item: T) => ReactNode;
  maxWidth?: number | string;
  /** Accessible name; defaults to the placeholder. */
  label?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [show, setShow] = useState(false);
  const name = label ?? placeholder ?? 'Search';

  const selectedItem = useMemo(() => {
    if (!value || !options) return null;
    return options.find(o => o && getValue(o) === value) ?? null;
  }, [options, value, getValue]);

  const filtered = useMemo(() => {
    const q = (query || '').toLowerCase().trim();
    const opts = options || [];
    if (!q) return opts.filter(o => o != null).slice(0, 50);
    return opts.filter(o => o && filter(o, q)).slice(0, 50);
  }, [options, query, filter]);

  const close = () => { setShow(false); setQuery(''); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape' && show) { e.preventDefault(); close(); }
  };

  return (
    <div className="relative w-full" style={maxWidth !== undefined ? { maxWidth } : undefined}>
      <Input
        role="combobox"
        aria-label={name}
        aria-expanded={show}
        aria-controls={listId}
        aria-autocomplete="list"
        className="h-8 text-xs"
        placeholder={placeholder}
        value={show ? query : (selectedItem ? getLabel(selectedItem) : '')}
        onFocus={() => { setShow(true); setQuery(''); }}
        onBlur={close}
        onChange={e => setQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />
      {show && (
        <ul id={listId} role="listbox" aria-label={name} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 list-none overflow-y-auto rounded-card border border-line bg-card p-1 shadow-lg">
          {filtered.map(item => (
            <li
              key={getValue(item)}
              role="option"
              aria-selected={getValue(item) === value}
              // mousedown (not click) runs before the input's blur closes the list
              onMouseDown={(e) => { e.preventDefault(); onSelect(getValue(item)); close(); }}
              className="cursor-pointer rounded-control px-2.5 py-1.5 text-xs text-ink hover:bg-accent-soft"
            >
              {renderItem(item)}
            </li>
          ))}
          {filtered.length === 0 && <li className="px-2.5 py-1.5 text-xs text-muted">No results found</li>}
        </ul>
      )}
    </div>
  );
}

export function PartySearch({ parties, onSelect, placeholder = 'Add party…', label = 'Add party' }: {
  parties: Party[];
  onSelect: (p: Party) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <SearchableSelect
      options={parties ?? []}
      onSelect={val => {
        const p = (parties ?? []).find(x => x && x.id === val);
        if (p) onSelect(p);
      }}
      placeholder={placeholder}
      label={label}
      getLabel={() => ''}
      getValue={p => p?.id || ''}
      filter={(p, q) =>
        p && (
          (p.name || '').toLowerCase().includes(q) ||
          (p.abbreviation || '').toLowerCase().includes(q) ||
          (p.id || '').toLowerCase().includes(q)
        )
      }
      renderItem={p => p && (
        <span className="flex items-center gap-1.5">
          {p.color && <ColorDot color={p.color} />}
          <span className="font-medium">{p.abbreviation || p.id}</span>
          <span className="truncate text-muted">{p.name}</span>
        </span>
      )}
      maxWidth={240}
    />
  );
}

// ── Chip Select ──

export function ChipSelect({ selected, options, onAdd, onRemove, renderChip, label = 'Search to add' }: {
  selected: string[];
  options: { value: string; label: string; color?: string }[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  renderChip?: (id: string) => ReactNode;
  /** Accessible name of the search field. */
  label?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState('');
  const [show, setShow] = useState(false);

  const opts = options ?? [];
  const sel = selected ?? [];
  const q = (query || '').toLowerCase();
  const filtered = opts.filter(o =>
    o && !sel.includes(o.value) &&
    ((o.label || '').toLowerCase().includes(q) || (o.value || '').toLowerCase().includes(q))
  ).slice(0, 10);
  const open = show && !!query;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {sel.map(id => renderChip ? renderChip(id) : (
          <Chip key={id} label={opts.find(o => o && o.value === id)?.label || id} onRemove={() => onRemove(id)} />
        ))}
      </div>
      <div className="relative max-w-[200px]">
        <Input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          className="h-8 text-xs"
          placeholder="Search to add…"
          value={query}
          onFocus={() => setShow(true)}
          onBlur={() => setShow(false)}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); setQuery(''); } }}
        />
        {open && (
          <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 top-full z-30 mt-1 max-h-64 w-64 list-none overflow-y-auto rounded-card border border-line bg-card p-1 shadow-lg">
            {filtered.map(o => (
              <li
                key={o.value}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); onAdd(o.value); setQuery(''); }}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-1.5 text-xs text-ink hover:bg-accent-soft"
              >
                <span className="flex items-center gap-1.5">{o.color && <ColorDot color={o.color} />}{o.label}</span>
                <span className="text-muted">{o.value}</span>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2.5 py-1.5 text-xs text-muted">No matches</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Rewrite `admin/src/components/manifest/AllianceEditor.tsx`**

```tsx
import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, Chip, PartySearch, RemoveButton, updateAt, removeAt } from './SharedControls';
import { Input } from '../ui/Input';
import type { Alliance, Party } from '../../types';

export function AllianceEditor({
  alliances,
  contestingParties,
  partyMap,
  onUpdate
}: {
  alliances: Alliance[];
  contestingParties: Party[];
  partyMap: Map<string, Party>;
  onUpdate: (alliances: Alliance[]) => void;
}) {
  const items = alliances || [];

  return (
    <ManifestSection title="Alliances" description="Coalition groupings shown on the map and tally" count={items.length}>
      {items.length === 0 && <EmptyState text="No alliances configured" />}
      {items.map((a, i) => {
        if (!a) return null;
        const n = i + 1;
        return (
          <div
            key={i}
            className="space-y-2 rounded-control border border-l-4 border-line bg-card p-3"
            style={a.color ? { borderLeftColor: a.color } : undefined}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Alliance ${n} colour`}
                value={a.color || '#666666'}
                onChange={e => onUpdate(updateAt(items, i, { color: e.target.value }))}
                className="h-8 w-9 shrink-0 cursor-pointer rounded-control border border-line bg-card p-0.5"
              />
              <Input aria-label={`Alliance ${n} ID`} className="h-8 w-24 text-xs" placeholder="ID (e.g. NDA)" value={a.id || ''}
                onChange={e => onUpdate(updateAt(items, i, { id: e.target.value }))} />
              <Input aria-label={`Alliance ${n} name`} className="h-8 flex-1 text-xs" placeholder="Alliance name" value={a.name || ''}
                onChange={e => onUpdate(updateAt(items, i, { name: e.target.value }))} />
              <RemoveButton label={`Remove alliance ${a.name || n}`} onClick={() => onUpdate(removeAt(items, i))} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 flex-wrap gap-1">
                {(a.parties || []).map((pid: string) => {
                  const p = partyMap.get(pid);
                  const label = p?.abbreviation || p?.name || pid;
                  return (
                    <Chip
                      key={pid}
                      label={label}
                      color={p?.color}
                      removeLabel={`Remove ${label} from ${a.name || 'alliance'}`}
                      onRemove={() => onUpdate(updateAt(items, i, { parties: (a.parties || []).filter((x: string) => x !== pid) }))}
                    />
                  );
                })}
              </div>
              <PartySearch
                parties={contestingParties || []}
                onSelect={(p) => {
                  if (p && !(a.parties || []).includes(p.id)) {
                    onUpdate(updateAt(items, i, { parties: [...(a.parties || []), p.id] }));
                  }
                }}
              />
            </div>
          </div>
        );
      })}
      <AddButton label="Add alliance" onClick={() =>
        onUpdate([...items, { id: '', name: '', color: '#666666', parties: [] }])} />
    </ManifestSection>
  );
}
```

- [ ] **Step 8: Rewrite `admin/src/components/manifest/TrackedEditor.tsx`**

```tsx
import { ManifestSection } from './ManifestSection';
import { Chip, ChipSelect } from './SharedControls';
import type { Alliance, Party } from '../../types';

export function TrackedEditor({
  tracked,
  trackedOptions,
  alliances,
  partyMap,
  onUpdate
}: {
  tracked: string[];
  trackedOptions: { id: string; name: string }[];
  alliances: Alliance[];
  partyMap: Map<string, Party>;
  onUpdate: (tracked: string[]) => void;
}) {
  const items = tracked || [];

  return (
    <ManifestSection title="Tracked" description="Alliances and parties shown in the main tally bar" count={items.length}>
      <ChipSelect
        label="Add to the tally"
        selected={items}
        options={(trackedOptions || []).map(o => ({ value: o.id, label: o.name }))}
        onAdd={id => onUpdate([...items, id])}
        onRemove={id => onUpdate(items.filter(x => x !== id))}
        renderChip={id => {
          const alliance = (alliances || []).find(a => a && a.id === id);
          const party = partyMap.get(id);
          const label = alliance ? alliance.name : (party?.abbreviation || party?.name || id);
          return (
            <Chip
              key={id}
              label={label}
              color={alliance?.color || party?.color}
              onRemove={() => onUpdate(items.filter(x => x !== id))}
            />
          );
        }}
      />
    </ManifestSection>
  );
}
```

- [ ] **Step 9: `@source`.** In `admin/src/theme/tailwind.css`, add `@source "../components/manifest";` after `@source "../components/feedback";`.

- [ ] **Step 10: Run the two test files**

Run: `cd admin && npx vitest run src/components/manifest/manifest.test.tsx src/pages/Manifests.test.tsx`
Expected: PASS (10 component tests, 10 Manifests tests).

- [ ] **Step 11: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. `WatchlistEditor.tsx` and `MiscEditors.tsx` still import `EmptyState`, `AddButton`, `ItemRow`, `SearchableSelect`, `updateAt`, `removeAt` and `moveItem` from `./SharedControls` under the same names, so they compile unchanged.

- [ ] **Step 12: Commit**

```bash
git add admin/src/components/manifest/ManifestSection.tsx admin/src/components/manifest/SharedControls.tsx admin/src/components/manifest/AllianceEditor.tsx admin/src/components/manifest/TrackedEditor.tsx admin/src/components/manifest/manifest.test.tsx admin/src/pages/Manifests.test.tsx admin/src/theme/tailwind.css
git commit -m "admin: manifest editor sections always open; Tailwind shared controls, alliances and tracked

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Manifest editor (2/2) — Watchlists and misc editors in Tailwind; the panel drops `legacyBody`

This task covers decisions §8: no legacy `.mf-*`, `.form-*`, `.admin-table` or `spinner` classes, and no legacy `var(--…)`. It rebuilds:
- `WatchlistEditor` and `WatchlistRow`
- the misc editors: Milestones, Compare and history, Vote splits, Geo config, Live tabs and Electoral roll revision

Each keeps its props, data and payloads, with sentence-case titles and buttons. Inputs, selects and the remove/move buttons get accessible names.

Two inputs were unusable before: the controlled value was re-derived from the parsed data on every key, so a comma vanished as soon as it was typed. They now use `DraftInput` (Task 11), which keeps the typed text until it parses:
- the map **centre** ("22.5, 82.5")
- the **live-tab seat list** ("1, 2, 3")

The watchlist candidate search drops a slower, older answer. The preset names (`Leaders`, `Key Battles`, …) are **data**: they become the watchlist's public name. They are kept as they are, not sentence-cased.

With nothing legacy left inside the editor:
- `ManifestPanel` stops passing `legacyBody`, and its `tw-ui` wrappers go, because the `Sheet` carries `tw-ui` itself until Task 13.
- `Sheet` loses the `legacyBody` prop.

**Files:**
- Rewrite: `admin/src/components/manifest/WatchlistEditor.tsx`, `admin/src/components/manifest/MiscEditors.tsx`
- Modify: `admin/src/components/entity/manifests/ManifestPanel.tsx`, `admin/src/components/ui/Sheet.tsx`
- Test: `admin/src/components/manifest/manifest.test.tsx` (append), `admin/src/components/ui/Sheet.test.tsx`, `admin/src/pages/Manifests.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 11: `ManifestSection`, `EmptyState`, `AddButton`, `ItemRow`, `RemoveButton`, `ColorDot`, `SearchableSelect`, `DraftInput`, `updateAt`, `removeAt`, `moveItem`
  - from Task 1: `Spinner`
  - `Input`, `Select`, `Field`, `Button`
- Produces:
  - Unchanged exports: `WATCHLIST_PRESETS`, `WatchlistRow`, `WatchlistEditor`, `MilestonesEditor`, `CompareHistoryEditor`, `VoteSplitsEditor`, `GeoConfigEditor`, `LiveTabsEditor`, `RevisionEditor`.
  - `Sheet({ open, onRequestClose, title, description?, width?, footer?, children })`, with no `legacyBody`.
  - Accessible names:
    - "Entry N candidate" / "Entry N role" / "Entry N party" / "Entry N constituency" / "Remove entry N"
    - "Watchlist N name" / "Remove watchlist <name>"
    - "Milestone N label" / "Milestone N seats"
    - "Comparison N election" / "History N election" / "History N year"
    - "Vote split N spoiler" / "Vote split N alliance" / "Vote split N reason"
    - "Map URL" / "Centre (lat, lng)" / "Zoom"
    - "Tab N label" / "Tab N seats"
    - table "Revision by seat"

- [ ] **Step 1: Append the failing editor tests** to `admin/src/components/manifest/manifest.test.tsx`.

  a. Change the testing-library import to:

```tsx
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
```

  b. Below `import { TrackedEditor } from './TrackedEditor';`, add:

```tsx
import { WatchlistEditor } from './WatchlistEditor';
import { CompareHistoryEditor, GeoConfigEditor, LiveTabsEditor, MilestonesEditor, RevisionEditor, VoteSplitsEditor } from './MiscEditors';
import type { Candidate, Constituency, Election, ManifestData, LiveTab } from '../../types';
```

  c. Append at the end of the file:

```tsx
const seat = (id: string, no: number, name: string): Constituency => ({
  id, election_id: 'e1', name, const_no: no, type: 'GEN', state_id: 1, district_id: null, region_id: null, voter_turnout: null, metadata: {},
});
const SEATS = [seat('k1', 1, 'Valmiki Nagar'), seat('k2', 2, 'Ramnagar'), seat('k142', 142, 'Patna Sahib')];
const cand = (id: string, name: string, party: string, constId: string): Candidate => ({
  id, name, party_id: party, const_id: constId, person_id: null, election_id: 'e1', party: null, is_incumbent: false,
});
const election = (id: string, name: string, year: number): Election => ({
  id, name, type: 'VS', state_id: 1, year, status: 'Finalized', tentative_next_date: null, manifest_url: null,
});
const ELECTIONS = [election('e1', 'Bihar 2020', 2020), election('e2', 'Bihar 2015', 2015)];
const electionMap = new Map(ELECTIONS.map((e) => [e.id, e]));

describe('WatchlistEditor', () => {
  it('preset buttons add a named watchlist; a custom one starts unnamed', () => {
    const onUpdate = vi.fn();
    render(<WatchlistEditor watchlists={[]} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn()} onUpdate={onUpdate} />);
    expect(screen.getByText('No watchlists configured.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leaders' }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ id: 'leaders', name: 'Leaders', entries: [] }]);
    fireEvent.click(screen.getByRole('button', { name: 'Custom watchlist' }));
    expect(onUpdate.mock.lastCall![0][0]).toMatchObject({ name: '', entries: [] });
  });

  it('an entry searches from two letters, ignores a stale answer, and fills party and seat on pick', async () => {
    let releaseOld!: (c: Candidate[]) => void;
    const search = vi.fn((q: string) => (q === 'ra'
      ? new Promise<Candidate[]>((r) => { releaseOld = r; })
      : Promise.resolve([cand('c1', 'Ravi Prasad', 'BJP', 'k142')])));
    const onUpdate = vi.fn();
    const WL = [{ id: 'leaders', name: 'Leaders', entries: [{ name: '', party_id: '', const_id: '' }] }];
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={search} onUpdate={onUpdate} />);
    const input = screen.getByRole('combobox', { name: 'Entry 1 candidate' });
    fireEvent.change(input, { target: { value: 'r' } });
    expect(search).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'ra' } });
    fireEvent.change(input, { target: { value: 'rav' } });
    expect(await screen.findByRole('option', { name: /Ravi Prasad/ })).toBeTruthy();
    await act(async () => { releaseOld([cand('c2', 'Old Result', 'INC', 'k1')]); });
    expect(screen.queryByRole('option', { name: /Old Result/ })).toBeNull();
    fireEvent.mouseDown(screen.getByRole('option', { name: /Ravi Prasad/ }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...WL[0], entries: [{ name: 'Ravi Prasad', party_id: 'BJP', const_id: 'k142' }] }]);
  });

  it('the role field and remove button act on their own entry', () => {
    const onUpdate = vi.fn();
    const WL = [{ id: 'leaders', name: 'Leaders', entries: [{ name: 'A', party_id: 'BJP', const_id: 'k1' }, { name: 'B', party_id: 'INC', const_id: 'k2' }] }];
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Entry 2 role'), { target: { value: 'CM' } });
    expect(onUpdate.mock.lastCall![0][0].entries[1]).toEqual({ name: 'B', party_id: 'INC', const_id: 'k2', role: 'CM' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove entry 1' }));
    expect(onUpdate.mock.lastCall![0][0].entries).toEqual([WL[0].entries[1]]);
    expect((screen.getByRole('combobox', { name: 'Entry 2 constituency' }) as HTMLInputElement).value).toBe('Ramnagar (#2)');
  });
});

describe('MiscEditors', () => {
  it('milestones edit the label and seats; Add milestone appends', () => {
    const onUpdate = vi.fn();
    render(<MilestonesEditor milestones={[{ label: 'Majority', value: 122 }]} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Milestone 1 seats'), { target: { value: '123' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ label: 'Majority', value: 123 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ label: 'Majority', value: 122 }, { label: '', value: 0 }]);
  });

  it('history reorders with labelled buttons and keeps the years in step', () => {
    const onHistory = vi.fn();
    const onYears = vi.fn();
    render(
      <CompareHistoryEditor
        compareWith={[]} history={['e1', 'e2']} historyYears={[2020, 2015]} elections={ELECTIONS} electionMap={electionMap}
        onUpdateCompare={vi.fn()} onUpdateHistory={onHistory} onUpdateHistoryYears={onYears}
      />,
    );
    expect(screen.getByRole('region', { name: 'Compare and history' })).toBeTruthy();
    expect(screen.getByText('No comparison election set')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move item 2 up' }));
    expect(onHistory).toHaveBeenLastCalledWith(['e2', 'e1']);
    expect(onYears).toHaveBeenLastCalledWith([2015, 2020]);
    fireEvent.change(screen.getByLabelText('History 1 year'), { target: { value: '2021' } });
    expect(onYears).toHaveBeenLastCalledWith([2021, 2015]);
  });

  it('vote splits pick the spoiler and the alliance it hurts', () => {
    const onUpdate = vi.fn();
    render(<VoteSplitsEditor voteSplits={[{ spoiler: '', hurts: '', label: '' }]} contestingParties={PARTIES} alliances={[NDA]} partyMap={partyMap} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Vote split 1 spoiler'), { target: { value: 'INC' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ spoiler: 'INC', hurts: '', label: '' }]);
    fireEvent.change(screen.getByLabelText('Vote split 1 alliance'), { target: { value: 'NDA' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ spoiler: '', hurts: 'NDA', label: '' }]);
  });

  it('the map centre keeps a half-typed value, saves a complete one, and clearing it removes it', () => {
    function Geo() {
      const [geo, setGeo] = useState<ManifestData['geo']>({ map_url: '/geo/x.geojson' });
      return <><GeoConfigEditor geo={geo} onUpdate={setGeo} /><output>{JSON.stringify(geo)}</output></>;
    }
    render(<Geo />);
    const centre = screen.getByLabelText('Centre (lat, lng)') as HTMLInputElement;
    fireEvent.change(centre, { target: { value: '22.5,' } });
    expect(centre.value).toBe('22.5,');
    fireEvent.change(centre, { target: { value: '22.5, 82.5' } });
    expect(screen.getByRole('status').textContent).toBe('{"map_url":"/geo/x.geojson","center":[22.5,82.5]}');
    fireEvent.change(centre, { target: { value: '' } });
    expect(screen.getByRole('status').textContent).toBe('{"map_url":"/geo/x.geojson"}');
  });

  it('a live-tab seat list can be typed with commas', () => {
    function Tabs() {
      const [tabs, setTabs] = useState<LiveTab[]>([{ label: 'Patna', const_nos: [] }]);
      return <><LiveTabsEditor liveTabs={tabs} onUpdate={setTabs} /><output>{JSON.stringify(tabs)}</output></>;
    }
    render(<Tabs />);
    const seats = screen.getByLabelText('Tab 1 seats') as HTMLInputElement;
    fireEvent.change(seats, { target: { value: '1,' } });
    expect(seats.value).toBe('1,');
    fireEvent.change(seats, { target: { value: '1, 2' } });
    expect(screen.getByRole('status').textContent).toBe('[{"label":"Patna","const_nos":[1,2]}]');
    expect(screen.getByText('2 seats')).toBeTruthy();
  });

  it('the electoral roll revision totals and per-seat changes', () => {
    render(<RevisionEditor revision={{ label: 'SIR 2025', data: { 1: [1000, 900], 2: { pre: 500, post: 550 } } }} constituencies={SEATS} />);
    const section = screen.getByRole('region', { name: 'Electoral roll revision' });
    expect(within(section).getByText('SIR 2025')).toBeTruthy();
    expect(within(section).getByText('1,500')).toBeTruthy();
    expect(within(section).getByText('1,450')).toBeTruthy();
    const table = within(section).getByRole('table', { name: 'Revision by seat' });
    expect(within(table).getByText('Valmiki Nagar')).toBeTruthy();
    expect(within(table).getByText('-100 (-10.0%)')).toBeTruthy();
    expect(within(table).getByText('+50 (+10.0%)')).toBeTruthy();
  });

  it('no editor renders a legacy class', () => {
    const { container } = render(
      <>
        <WatchlistEditor watchlists={[{ id: 'leaders', name: 'Leaders', entries: [{ name: 'A', party_id: 'BJP', const_id: 'k1' }] }]} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn()} onUpdate={vi.fn()} />
        <MilestonesEditor milestones={[{ label: 'Majority', value: 122 }]} onUpdate={vi.fn()} />
        <CompareHistoryEditor compareWith={['e1']} history={['e2']} historyYears={[2015]} elections={ELECTIONS} electionMap={electionMap} onUpdateCompare={vi.fn()} onUpdateHistory={vi.fn()} onUpdateHistoryYears={vi.fn()} />
        <VoteSplitsEditor voteSplits={[{ spoiler: 'INC', hurts: 'NDA', label: 'Splitter' }]} contestingParties={PARTIES} alliances={[NDA]} partyMap={partyMap} onUpdate={vi.fn()} />
        <GeoConfigEditor geo={{ map_url: '/geo/x.geojson', center: [22.5, 82.5], zoom: 6 }} onUpdate={vi.fn()} />
        <LiveTabsEditor liveTabs={[{ label: 'Patna', const_nos: [1, 2] }]} onUpdate={vi.fn()} />
        <RevisionEditor revision={{ data: { 1: [1000, 900] } }} constituencies={SEATS} />
      </>,
    );
    expect(container.querySelector(LEGACY)).toBeNull();
    expect(container.innerHTML).not.toMatch(/var\(--(bg-|text-|border|space-|danger|success|radius)/);
  });
});
```

- [ ] **Step 2: Update the Sheet test** `admin/src/components/ui/Sheet.test.tsx`. Replace `it('renders nothing when closed; legacyBody keeps tw-ui off the body', …)` with:

```tsx
  it('renders nothing when closed; the full width covers the page body', () => {
    const { rerender } = render(<Page onRequestClose={vi.fn()} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<Sheet open onRequestClose={vi.fn()} title="Manifest" width="full"><button type="button">Inside</button></Sheet>);
    expect(screen.getByRole('dialog', { name: 'Manifest' }).className).toContain('inset-0');
  });
```

- [ ] **Step 3: Extend the Manifests "every editor section open" test** in `admin/src/pages/Manifests.test.tsx`. Inside `it('Edit renders every editor section open, with no expand toggle', …)`, add after the `button[aria-expanded]` line:

```tsx
    for (const name of ['Alliances', 'Tracked', 'Watchlists', 'Milestones', 'Compare and history', 'Vote splits', 'Geo config', 'Live tabs']) {
      expect(within(panel).getByRole('region', { name })).toBeTruthy();
    }
    expect(panel.querySelector('[class*="mf-"],.btn,.form-input,.form-select,.admin-table')).toBeNull();
```

- [ ] **Step 4: Run them to confirm they fail**

Run: `cd admin && npx vitest run src/components/manifest/manifest.test.tsx src/components/ui/Sheet.test.tsx src/pages/Manifests.test.tsx`
Expected: FAIL:
- "Unable to find role="combobox" and name "Entry 1 candidate"" and "Unable to find a label with the text of: Milestone 1 seats"
- the half-typed centre value is lost
- region "Compare and history" is not found (the title is "Compare & History")
- `Sheet` still accepts `legacyBody`; the TypeScript build fails later because no caller is left

- [ ] **Step 5: Rewrite `admin/src/components/manifest/WatchlistEditor.tsx`**

```tsx
import { useEffect, useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, ColorDot, RemoveButton, SearchableSelect, updateAt, removeAt } from './SharedControls';
import Spinner from '../atoms/Spinner';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Watchlist, WatchlistEntry, Party, Constituency, Candidate } from '../../types';

/** Preset watchlists. The names are data: they become the watchlist's public name, so they are not re-cased. */
export const WATCHLIST_PRESETS = [
  { id: 'leaders', name: 'Leaders' },
  { id: 'cabinet', name: 'Cabinet' },
  { id: 'celebrities', name: 'Celebrities' },
  { id: 'rebels', name: 'Rebels' },
  { id: 'key_battles', name: 'Key Battles' },
  { id: 'first_timers', name: 'First-Timers' },
];

export function WatchlistRow({
  entry,
  eIdx,
  onUpdate,
  onRemove,
  parties,
  constituencies,
  partyMap,
  onSearchCandidates
}: {
  entry: WatchlistEntry;
  eIdx: number;
  onUpdate: (patch: Partial<WatchlistEntry>) => void;
  onRemove: () => void;
  parties: Party[];
  constituencies: Constituency[];
  partyMap: Map<string, Party>;
  onSearchCandidates: (query: string) => Promise<Candidate[]>;
}) {
  const listId = useId();
  const [searchTerm, setSearchTerm] = useState(entry.name);
  const [results, setResults] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const latest = useRef(0);
  const n = eIdx + 1;

  // Keep state in sync with external data changes
  useEffect(() => {
    setSearchTerm(entry.name || '');
  }, [entry.name]);

  const handleSearch = async (query: string) => {
    setSearchTerm(query);
    onUpdate({ name: query });
    const request = ++latest.current;
    if (query.length < 2) {
      setResults([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await onSearchCandidates(query);
      if (request !== latest.current) return; // a newer query is on its way
      setResults(res || []);
      setShowDropdown(true);
    } catch {
      // Suggestions are optional: the typed name is kept.
    } finally {
      if (request === latest.current) setLoading(false);
    }
  };

  const handleSelect = (c: Candidate) => {
    onUpdate({
      name: c.name,
      party_id: c.party_id || '',
      const_id: c.const_id
    });
    setSearchTerm(c.name);
    setShowDropdown(false);
  };

  const p = partyMap.get(entry.party_id);
  const open = showDropdown && results.length > 0;

  return (
    <tr>
      <td className="relative px-1.5 py-1 align-top">
        <div className="flex items-center gap-1.5">
          <Input
            role="combobox"
            aria-label={`Entry ${n} candidate`}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="h-8 text-xs"
            placeholder="Search candidate…"
            value={searchTerm || ''}
            onChange={e => { void handleSearch(e.target.value); }}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
            onBlur={() => setShowDropdown(false)}
            onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); setShowDropdown(false); } }}
          />
          {loading && <Spinner size={12} />}
        </div>
        {open && (
          <ul id={listId} role="listbox" aria-label={`Entry ${n} candidates`} className="absolute left-1.5 right-1.5 top-full z-30 mt-1 min-w-[280px] list-none rounded-card border border-line bg-card p-1 shadow-lg">
            {results.map(r => (
              <li
                key={r.id}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                className="cursor-pointer rounded-control px-2.5 py-1.5 text-xs hover:bg-accent-soft"
              >
                <div className="font-semibold text-ink">{r.name}</div>
                <div className="text-[10px] text-muted">{r.party_id} · {r.const_id}</div>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-1.5 py-1 align-top">
        <Input aria-label={`Entry ${n} role`} className="h-8 text-xs" placeholder="Role (e.g. CM, rebel)" value={entry.role || ''}
          onChange={e => onUpdate({ role: e.target.value || undefined })} />
      </td>
      <td className="px-1.5 py-1 align-top">
        <div className="flex items-center gap-1.5">
          <SearchableSelect
            label={`Entry ${n} party`}
            value={entry.party_id}
            options={parties}
            onSelect={val => onUpdate({ party_id: val })}
            placeholder="Party…"
            getLabel={pp => pp.abbreviation || pp.name}
            getValue={pp => pp.id}
            filter={(pp, q) =>
              pp.name.toLowerCase().includes(q) ||
              (pp.abbreviation || '').toLowerCase().includes(q) ||
              pp.id.toLowerCase().includes(q)
            }
            renderItem={pp => (
              <span className="flex items-center gap-1.5">
                {pp.color && <ColorDot color={pp.color} />}
                <span className="font-medium">{pp.abbreviation || pp.id}</span>
                <span className="truncate text-muted">{pp.name}</span>
              </span>
            )}
          />
          {p?.color && <ColorDot color={p.color} />}
        </div>
      </td>
      <td className="px-1.5 py-1 align-top">
        <SearchableSelect
          label={`Entry ${n} constituency`}
          value={entry.const_id}
          options={constituencies}
          onSelect={val => onUpdate({ const_id: val })}
          placeholder="Constituency…"
          getLabel={c => `${c.name} (#${c.const_no})`}
          getValue={c => c.id}
          filter={(c, q) =>
            c.name.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q) ||
            String(c.const_no).includes(q)
          }
          renderItem={c => <span><span className="font-semibold">#{c.const_no}</span> {c.name}</span>}
        />
      </td>
      <td className="px-1.5 py-1 align-top">
        <RemoveButton label={`Remove entry ${n}`} onClick={onRemove} />
      </td>
    </tr>
  );
}

export function WatchlistEditor({
  watchlists,
  contestingParties,
  constituencies,
  partyMap,
  onSearchCandidates,
  onUpdate
}: {
  watchlists: Watchlist[];
  contestingParties: Party[];
  constituencies: Constituency[];
  partyMap: Map<string, Party>;
  onSearchCandidates: (query: string) => Promise<Candidate[]>;
  onUpdate: (watchlists: Watchlist[]) => void;
}) {
  const items = watchlists || [];
  const unusedPresets = WATCHLIST_PRESETS.filter(p => !items.some(w => w && w.id === p.id));

  const updateWatchlist = (wIdx: number, patch: Partial<Watchlist>) => {
    onUpdate(updateAt(items, wIdx, patch));
  };

  const updateWatchlistEntry = (wIdx: number, eIdx: number, patch: Partial<WatchlistEntry>) => {
    const w = items[wIdx];
    if (w) updateWatchlist(wIdx, { entries: updateAt(w.entries || [], eIdx, patch) });
  };

  const removeWatchlistEntry = (wIdx: number, eIdx: number) => {
    const w = items[wIdx];
    if (w) updateWatchlist(wIdx, { entries: removeAt(w.entries || [], eIdx) });
  };

  const addWatchlist = (id: string, name: string) => {
    if (items.some(w => w && w.id === id)) return;
    onUpdate([...items, { id, name, entries: [] }]);
  };

  const removeWatchlist = (wIdx: number) => {
    onUpdate(removeAt(items, wIdx));
  };

  return (
    <ManifestSection title="Watchlists" description="Track key candidates on the live results dashboard" count={items.length}>
      {items.length === 0 && <EmptyState text="No watchlists configured." />}

      {items.map((w, wIdx) => {
        if (!w) return null;
        const entries = w.entries || [];
        return (
          <div key={w.id || wIdx} className="rounded-control border border-line bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-3 py-1.5">
              <Input
                aria-label={`Watchlist ${wIdx + 1} name`}
                className="h-8 border-transparent bg-transparent text-sm font-semibold"
                value={w.name || ''}
                placeholder="Watchlist name (e.g. VIP seats)"
                onChange={e => updateWatchlist(wIdx, { name: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-xs text-muted">{entries.length} entries</span>
                <RemoveButton label={`Remove watchlist ${w.name || wIdx + 1}`} onClick={() => removeWatchlist(wIdx)} />
              </div>
            </div>

            <table className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="text-left text-[11px] text-ink-2">
                  <th scope="col" className="w-[35%] px-1.5 py-1.5 font-medium">Candidate</th>
                  <th scope="col" className="w-[20%] px-1.5 py-1.5 font-medium">Role</th>
                  <th scope="col" className="w-[20%] px-1.5 py-1.5 font-medium">Party</th>
                  <th scope="col" className="w-[20%] px-1.5 py-1.5 font-medium">Constituency</th>
                  <th scope="col" className="w-[5%] px-1.5 py-1.5"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, eIdx) => (
                  <WatchlistRow
                    key={eIdx}
                    entry={entry}
                    eIdx={eIdx}
                    onUpdate={(patch) => updateWatchlistEntry(wIdx, eIdx, patch)}
                    onRemove={() => removeWatchlistEntry(wIdx, eIdx)}
                    parties={contestingParties || []}
                    constituencies={constituencies || []}
                    partyMap={partyMap}
                    onSearchCandidates={onSearchCandidates}
                  />
                ))}
              </tbody>
            </table>
            {entries.length === 0 && <p className="px-3 py-5 text-center text-xs text-muted">No entries added to this watchlist.</p>}

            <div className="border-t border-line px-2 py-1.5">
              <AddButton label="Add entry" onClick={() =>
                updateWatchlist(wIdx, { entries: [...entries, { name: '', party_id: '', const_id: '' }] })} />
            </div>
          </div>
        );
      })}

      <div className="space-y-2">
        {unusedPresets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {unusedPresets.map(p => (
              <Button key={p.id} size="sm" variant="outline" onClick={() => addWatchlist(p.id, p.name)}>
                <Plus size={12} aria-hidden />{p.name}
              </Button>
            ))}
          </div>
        )}
        <AddButton label="Custom watchlist" onClick={() => {
          const id = `custom_${Date.now()}`;
          addWatchlist(id, '');
        }} />
      </div>
    </ManifestSection>
  );
}
```

- [ ] **Step 6: Rewrite `admin/src/components/manifest/MiscEditors.tsx`**

```tsx
import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, ColorDot, DraftInput, ItemRow, updateAt, removeAt, moveItem } from './SharedControls';
import { Input, Select } from '../ui/Input';
import { Field } from '../ui/Field';
import { cn } from '../ui/cn';
import type { Election, Alliance, Party, Milestone, VoteSplit, LiveTab, Constituency, ManifestData } from '../../types';

const fmt = (n: number) => n.toLocaleString('en-IN');

// ── Milestones Editor ──

export function MilestonesEditor({
  milestones,
  onUpdate
}: {
  milestones: Milestone[];
  onUpdate: (milestones: Milestone[]) => void;
}) {
  const items = milestones || [];
  return (
    <ManifestSection title="Milestones" description="Horizontal marker lines on the seat tally (e.g. majority)" count={items.length}>
      {items.map((m, i) => (
        <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
          <Input aria-label={`Milestone ${i + 1} label`} className="h-8 flex-1 text-xs" placeholder="Label (e.g. Majority)" value={m.label || ''}
            onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
          <Input aria-label={`Milestone ${i + 1} seats`} type="number" className="h-8 w-24 text-xs" placeholder="Seats" value={m.value ?? ''}
            onChange={e => onUpdate(updateAt(items, i, { value: Number(e.target.value) }))} />
        </ItemRow>
      ))}
      <AddButton label="Add milestone" onClick={() =>
        onUpdate([...items, { label: '', value: 0 }])} />
    </ManifestSection>
  );
}

// ── Compare & History Editor ──

export function CompareHistoryEditor({
  compareWith,
  history,
  historyYears,
  elections,
  electionMap,
  onUpdateCompare,
  onUpdateHistory,
  onUpdateHistoryYears
}: {
  compareWith: string[];
  history: string[];
  historyYears: number[];
  elections: Election[];
  electionMap: Map<string, Election>;
  onUpdateCompare: (val: string[]) => void;
  onUpdateHistory: (val: string[]) => void;
  onUpdateHistoryYears: (val: number[]) => void;
}) {
  const cw = compareWith || [];
  const h = history || [];
  const hy = historyYears || [];
  const options = (elections || []).map(el => el && <option key={el.id} value={el.id}>{el.name} ({el.year})</option>);

  return (
    <ManifestSection title="Compare and history" description="Link to previous elections for swing analysis" count={cw.length + h.length}>
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-ink-2">Swing comparison</h4>
        {cw.length === 0 && <EmptyState text="No comparison election set" />}
        {cw.map((id, i) => {
          const el = electionMap.get(id);
          return (
            <ItemRow key={i} index={i} showOrder onRemove={() => onUpdateCompare(removeAt(cw, i))}
              onMoveUp={() => onUpdateCompare(moveItem(cw, i, i - 1))}
              onMoveDown={() => onUpdateCompare(moveItem(cw, i, i + 1))}>
              <Select aria-label={`Comparison ${i + 1} election`} className="h-8 flex-1 text-xs" value={id || ''}
                onChange={e => { const a = [...cw]; a[i] = e.target.value; onUpdateCompare(a); }}>
                <option value="">Select election…</option>
                {options}
              </Select>
              {el && <span className="text-[11px] text-muted">{el.type} {el.year}</span>}
            </ItemRow>
          );
        })}
        <AddButton label="Add comparison" onClick={() => onUpdateCompare([...cw, ''])} />
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <h4 className="text-xs font-medium text-ink-2">Historical elections</h4>
        {h.length === 0 && <EmptyState text="No history elections linked" />}
        {h.map((id, i) => {
          const el = electionMap.get(id);
          return (
            <ItemRow key={i} index={i} showOrder onRemove={() => {
              onUpdateHistory(removeAt(h, i));
              onUpdateHistoryYears(removeAt(hy, i));
            }}
              onMoveUp={() => { onUpdateHistory(moveItem(h, i, i - 1)); onUpdateHistoryYears(moveItem(hy, i, i - 1)); }}
              onMoveDown={() => { onUpdateHistory(moveItem(h, i, i + 1)); onUpdateHistoryYears(moveItem(hy, i, i + 1)); }}>
              <Select aria-label={`History ${i + 1} election`} className="h-8 flex-1 text-xs" value={id || ''}
                onChange={e => { const a = [...h]; a[i] = e.target.value; onUpdateHistory(a); }}>
                <option value="">Select election…</option>
                {options}
              </Select>
              <Input aria-label={`History ${i + 1} year`} type="number" placeholder="Year" className="h-8 w-20 text-xs"
                value={hy[i] ?? ''} onChange={e => { const a = [...hy]; a[i] = Number(e.target.value); onUpdateHistoryYears(a); }} />
              {el && <span className="text-[11px] text-muted">{el.type}</span>}
            </ItemRow>
          );
        })}
        <AddButton label="Add history election" onClick={() => {
          onUpdateHistory([...h, '']);
          onUpdateHistoryYears([...hy, 0]);
        }} />
      </div>
    </ManifestSection>
  );
}

// ── Vote Splits Editor ──

export function VoteSplitsEditor({
  voteSplits,
  contestingParties,
  alliances,
  partyMap,
  onUpdate
}: {
  voteSplits: VoteSplit[];
  contestingParties: Party[];
  alliances: Alliance[];
  partyMap: Map<string, Party>;
  onUpdate: (vs: VoteSplit[]) => void;
}) {
  const items = voteSplits || [];
  return (
    <ManifestSection title="Vote splits" description="Parties that split votes from an alliance" count={items.length}>
      {items.length === 0 && <EmptyState text="No vote split rules configured" />}
      {items.map((vs, i) => {
        if (!vs) return null;
        const sp = partyMap.get(vs.spoiler);
        const ha = (alliances || []).find(a => a && a.id === vs.hurts);
        return (
          <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
            <div className="flex items-center gap-1.5">
              <Select aria-label={`Vote split ${i + 1} spoiler`} className="h-8 w-40 text-xs" value={vs.spoiler || ''}
                onChange={e => onUpdate(updateAt(items, i, { spoiler: e.target.value }))}>
                <option value="">Spoiler party…</option>
                {(contestingParties ?? []).map(p => p && <option key={p.id} value={p.id}>{p.abbreviation || p.name}</option>)}
              </Select>
              {sp?.color && <ColorDot color={sp.color} />}
            </div>
            <span className="text-[11px] text-muted">hurts</span>
            <div className="flex items-center gap-1.5">
              <Select aria-label={`Vote split ${i + 1} alliance`} className="h-8 w-40 text-xs" value={vs.hurts || ''}
                onChange={e => onUpdate(updateAt(items, i, { hurts: e.target.value }))}>
                <option value="">Alliance…</option>
                {(alliances ?? []).map(a => a && <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              {ha && <ColorDot color={ha.color} />}
            </div>
            <Input aria-label={`Vote split ${i + 1} reason`} className="h-8 w-36 text-xs" placeholder="Reason (e.g. Splitter)" value={vs.label || ''}
              onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
          </ItemRow>
        );
      })}
      <AddButton label="Add vote split" onClick={() =>
        onUpdate([...items, { spoiler: '', hurts: '', label: '' }])} />
    </ManifestSection>
  );
}

// ── Geo Config Editor ──

export function GeoConfigEditor({
  geo,
  onUpdate
}: {
  geo: ManifestData['geo'];
  onUpdate: (geo: ManifestData['geo']) => void;
}) {
  const g = geo || {};
  return (
    <ManifestSection title="Geo config" description="Map GeoJSON source and projection settings">
      <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
        <Field label="Map URL">
          <Input placeholder="/geo/india_pc.geojson" value={g.map_url || ''}
            onChange={e => onUpdate({ ...g, map_url: e.target.value || undefined })} />
        </Field>
        <Field label="Centre (lat, lng)" hint="Two numbers, e.g. 22.5, 82.5">
          <DraftInput
            placeholder="22.5, 82.5"
            value={Array.isArray(g.center) ? g.center.join(', ') : ''}
            onCommit={text => {
              const parts = text.split(',').map(s => parseFloat(s.trim()));
              if (parts.length === 2 && parts.every(n => !Number.isNaN(n))) {
                onUpdate({ ...g, center: parts as [number, number] });
                return parts.join(', ');
              }
              if (!text.trim()) {
                const { center: _, ...rest } = g;
                onUpdate(rest);
                return '';
              }
              return null; // not a complete pair yet: keep typing
            }}
          />
        </Field>
        <Field label="Zoom">
          <Input type="number" placeholder="4" className="w-20" value={g.zoom ?? ''}
            onChange={e => onUpdate({ ...g, zoom: e.target.value ? Number(e.target.value) : undefined })} />
        </Field>
      </div>
    </ManifestSection>
  );
}

// ── Live Tabs Editor ──

export function LiveTabsEditor({
  liveTabs,
  onUpdate
}: {
  liveTabs: LiveTab[];
  onUpdate: (tabs: LiveTab[]) => void;
}) {
  const items = liveTabs || [];
  return (
    <ManifestSection title="Live tabs" description="Custom filtered tabs on the results page" count={items.length}>
      {items.length === 0 && <EmptyState text="No custom tabs configured" />}
      {items.map((tab, i) => (
        <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
          <Input aria-label={`Tab ${i + 1} label`} className="h-8 w-40 text-xs" placeholder="Tab label" value={tab.label || ''}
            onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
          <DraftInput
            aria-label={`Tab ${i + 1} seats`}
            className="h-8 flex-1 text-xs"
            placeholder="Constituency numbers (1, 2, 3…)"
            value={(tab.const_nos || []).join(', ')}
            onCommit={text => {
              const nums = text.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !Number.isNaN(n));
              onUpdate(updateAt(items, i, { const_nos: nums }));
              return nums.join(', ');
            }}
          />
          <span className="whitespace-nowrap text-[11px] text-muted">{(tab.const_nos || []).length} seats</span>
        </ItemRow>
      ))}
      <AddButton label="Add tab" onClick={() =>
        onUpdate([...items, { label: '', const_nos: [] }])} />
    </ManifestSection>
  );
}

// ── Revision Editor ──

export function RevisionEditor({
  revision,
  constituencies
}: {
  revision: ManifestData['revision'];
  constituencies: Constituency[];
}) {
  const rev = revision;
  if (!rev) return null;

  let label = '';
  let entries: [string, number, number][] = [];
  if (rev && typeof rev === 'object') {
    if ('data' in rev && typeof rev.data === 'object') {
      label = rev.label || (rev as any).revision_label || '';
      const data = rev.data as Record<string, number[] | { pre: number; post: number }>;
      for (const [k, v] of Object.entries(data || {})) {
        if (Array.isArray(v)) entries.push([k, v[0] || 0, v[1] || 0]);
        else if (v && typeof v === 'object') entries.push([k, v.pre || 0, v.post || 0]);
      }
    }
  }

  entries.sort((a, b) => Number(a[0]) - Number(b[0]));

  const totalPre = entries.reduce((s, e) => s + (e[1] || 0), 0);
  const totalPost = entries.reduce((s, e) => s + (e[2] || 0), 0);
  const totalNet = totalPost - totalPre;
  const signed = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`;
  const signedPct = (p: number) => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;

  return (
    <ManifestSection
      title="Electoral roll revision"
      description="Voter list cleanup — dead or duplicate voters removed"
      count={entries.length}
      badge={label ? <span className="text-xs text-muted">{label}</span> : undefined}
    >
      {entries.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-ink-2">
            <span>Pre: <strong className="font-semibold text-ink">{fmt(totalPre)}</strong></span>
            <span>Post: <strong className="font-semibold text-ink">{fmt(totalPost)}</strong></span>
            <span className={totalNet >= 0 ? 'text-ok-text' : 'text-bad-text'}>
              Net: <strong className="font-semibold">{signed(totalNet)}</strong>
              {totalPre > 0 && <span> ({((totalNet / totalPre) * 100).toFixed(1)}%)</span>}
            </span>
          </div>
          <table aria-label="Revision by seat" className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-[11px] text-ink-2">
                <th scope="col" className="w-12 py-1.5 pr-2 font-medium">#</th>
                <th scope="col" className="py-1.5 pr-2 font-medium">Constituency</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Pre</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Post</th>
                <th scope="col" className="py-1.5 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {entries.map(([id, pre, post]) => {
                const constNo = id;
                const c = (constituencies || []).find(cc => cc && String(cc.const_no) === constNo);
                const net = (post || 0) - (pre || 0);
                const pct = pre > 0 ? ((net / pre) * 100) : 0;
                return (
                  <tr key={id}>
                    <td className="py-1.5 pr-2 font-mono text-muted">{constNo}</td>
                    <td className="py-1.5 pr-2 text-ink">{c?.name?.replace(/_/g, ' ') || `Seat #${constNo}`}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(pre || 0)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(post || 0)}</td>
                    <td className={cn('py-1.5 text-right font-medium tabular-nums', net > 0 ? 'text-ok-text' : net < 0 ? 'text-bad-text' : 'text-ink-2')}>
                      {signed(net)} ({signedPct(pct)})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <EmptyState text="No revision data. Add it in the JSON tab." />
      )}
    </ManifestSection>
  );
}
```

  In the change cell, `{signed(net)} ({signedPct(pct)})` gives "-100 (-10.0%)" and "+50 (+10.0%)". Both are text nodes of one `<td>`, which is what the test's `getByText` reads.

- [ ] **Step 7: Drop `legacyBody` from `admin/src/components/ui/Sheet.tsx`.** Replace the whole file with:

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';

export type SheetWidth = 'md' | 'full';

interface SheetProps {
  open: boolean;
  /** Close button or Esc. The page applies the unsaved-changes guard, then closes by navigating. */
  onRequestClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  width?: SheetWidth;
  footer?: ReactNode;
  children: ReactNode;
}

const WIDTH: Record<SheetWidth, string> = {
  md: 'w-[400px] shrink-0',
  full: 'absolute inset-0 z-20',
};

/**
 * Record panel: a NON-modal Radix Dialog rendered in place (no portal), as the right column of the page body
 * (`full` covers the body, which must be `relative`). No overlay, no focus trap; outside clicks never close it.
 */
export function Sheet({ open, onRequestClose, title, description, width = 'md', footer, children }: SheetProps) {
  const onEscape = (e: KeyboardEvent) => {
    e.preventDefault();
    // Esc inside an open combobox list closes that list only.
    if ((document.activeElement as HTMLElement | null)?.closest('[role="combobox"][aria-expanded="true"]')) return;
    onRequestClose();
  };
  return (
    <Dialog.Root open={open} modal={false} onOpenChange={(o) => { if (!o) onRequestClose(); }}>
      <Dialog.Content
        onEscapeKeyDown={onEscape}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn('tw-ui flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-sm', WIDTH[width])}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <Dialog.Title className="truncate text-lg font-semibold tracking-tight text-ink">{title}</Dialog.Title>
            <Dialog.Description className={cn('text-xs text-ink-2', !description && 'sr-only')}>{description ?? 'Record details'}</Dialog.Description>
          </div>
          <button type="button" aria-label="Close panel" onClick={onRequestClose} className="rounded-control p-1.5 text-muted hover:bg-subtle hover:text-ink">
            <X size={16} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-between gap-2 border-t border-line bg-subtle/60 px-4 py-3">{footer}</div>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

- [ ] **Step 8: Update `admin/src/components/entity/manifests/ManifestPanel.tsx`.**

  a. Replace the doc comment above `export function ManifestPanel` with:

```tsx
/**
 * Full-width manifest sheet: Summary (overview), Edit (the always-open editor sections) and JSON (the raw manifest).
 */
```

  b. In the `<Sheet …>` element, delete the `legacyBody` line.

  c. Remove the `tw-ui` token from the five wrappers inside the Sheet body. The `Sheet` carries it until Task 13. The edits are:
  - `<div className="tw-ui mb-4">` → `<div className="mb-4">`
  - `<p className="tw-ui py-16 text-center text-sm text-muted">` → `<p className="py-16 text-center text-sm text-muted">`
  - the two `<div className="tw-ui">` wrappers (the load-error block and the Summary tab) → `<div>`
  - `<div className="tw-ui flex min-h-[480px] flex-col overflow-hidden rounded-card border border-line">` → `<div className="flex min-h-[480px] flex-col overflow-hidden rounded-card border border-line">`

  Check:

```bash
grep -n "tw-ui\|legacyBody" admin/src/components/entity/manifests/ManifestPanel.tsx admin/src/components/ui/Sheet.tsx
grep -rn "legacyBody" admin/src
```

Expected: the first grep prints only the `cn('tw-ui flex flex-col …` line of `Sheet.tsx`. The second prints nothing.

- [ ] **Step 9: Run the three test files**

Run: `cd admin && npx vitest run src/components/manifest/manifest.test.tsx src/components/ui/Sheet.test.tsx src/pages/Manifests.test.tsx`
Expected: PASS (10 + 10 = 20 component tests, 7 Sheet tests, 10 Manifests tests).

- [ ] **Step 10: Confirm no legacy class or variable is left in the manifest editor**

```bash
grep -rnE "mf-|form-input|form-select|admin-table|spinner|striped|var\(--(bg-|text-|border|space-|danger|success|radius)" admin/src/components/manifest admin/src/components/entity/manifests
```

Expected: no output. The test file's `LEGACY` selector string matches `mf-` and `form-input`. If the grep prints `manifest.test.tsx`, run it again with `--exclude='*.test.tsx'` and expect no output.

- [ ] **Step 11: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. `tsc` finds no `legacyBody` prop left anywhere.

- [ ] **Step 12: Commit**

```bash
git add admin/src/components/manifest admin/src/components/entity/manifests/ManifestPanel.tsx admin/src/components/ui/Sheet.tsx admin/src/components/ui/Sheet.test.tsx admin/src/pages/Manifests.test.tsx
git commit -m "admin: manifest watchlists and misc editors in Tailwind; typeable centre and seat lists; drop Sheet legacyBody

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Remove the legacy CSS and turn on Tailwind preflight

This task covers decisions §10 and spec §6 ("`admin.css` … is deleted together with the inline `style={{}}` objects"). Tasks 1–12 left nothing that needs `admin.css`, and this task proves it.

It deletes:
- `admin/src/theme/admin.css` and `admin/src/theme/legacy.css`
- `AdminPageHeader`
- `FieldError` and its test
- `BARE_PATHS` / `isBare` / `.admin-content`: every route now renders straight into an `overflow-hidden` `<main>`, and each page scrolls itself

It also:
- moves the two global rules `admin.css` still provided into `tailwind.css`: the `*` reset (preflight covers it) and the `body` font, background, colour and line-height
- imports Tailwind **preflight** into the `base` layer
- deletes the `tw-ui` scoped reset and strips every `tw-ui` token. Preflight does the same job globally. One rule is kept on purpose, and is a deliberate choice: `button:not(:disabled) { cursor: pointer }`, because v4 preflight leaves buttons on the default cursor and every admin button has shown a pointer until now.
- replaces the per-file `@source` list with the four directories that hold classes

A source-scan test pins the result. jsdom cannot see CSS, so the test reads the sources as text. The task ends with a grep pass and a browser pass over every route at 1440×900.

**Files:**
- Delete:
  - `admin/src/theme/admin.css`, `admin/src/theme/legacy.css`
  - `admin/src/components/common/AdminPageHeader.tsx`
  - `admin/src/components/common/FieldError.tsx`, `admin/src/components/common/FieldError.test.tsx`
  - `admin/src/components/Layout.test.tsx` (it tested `isBare`)
- Rewrite: `admin/src/theme/tailwind.css`, `admin/src/main.tsx`, `admin/src/components/Layout.tsx`, `admin/src/components/entity/EntityPage.tsx`
- Modify: every file that carries `tw-ui` (mechanical, Step 6), `admin/src/components/entity/entity.test.tsx`, `admin/src/components/ui/Sheet.test.tsx`
- Create: `admin/src/theme/legacy-free.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–12. They leave `tw-ui` tokens only as whole words in class strings, which Step 6's `perl` removes. No new code may write `'tw-ui'` as a lone `cn()` argument.
- Produces:
  - `Layout()` renders `<main className="min-h-0 flex-1 overflow-hidden">` for every route.
  - `EntityPage({ header, toolbar?, table, panel? })` keeps its props; only the markup changes (no `tw-ui`).
  - `tailwind.css` has the layer order `theme, base, components, utilities` (no `legacy`). It imports `tailwindcss/preflight.css` into `base` and has `@source` on `../components`, `../pages`, `../context` and `../App.tsx`.

- [ ] **Step 1: Capture the "before" screenshots** (for the comparison in Step 13). Start the stack and sign in as described in Step 13a. Then save a 1440×900 screenshot of every route in the Step 13b checklist to the scratchpad directory (not the repo). Use the Playwright MCP browser if it is available (`browser_resize` 1440×900, `browser_navigate`, `browser_take_screenshot`); otherwise take them by hand. Stop the dev servers afterwards.

- [ ] **Step 2: Write the failing source-scan test** `admin/src/theme/legacy-free.test.ts`

```ts
import { describe, it, expect } from 'vitest';

/** Every non-test source file under src/, as text (Vite ?raw). Keys look like '../components/ui/Button.tsx'. */
const sources = import.meta.glob(['../**/*.{ts,tsx}', '!../**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Class names only the deleted legacy stylesheet defined (plus the deleted scoped reset). */
const LEGACY_CLASS = /^(btn(-[a-z]+)?|form-(input|select|label|group|grid(-2)?|actions)|spinner(-xs)?|admin-[a-z-]+|mf-[a-z-]+|card-(elevated|plain|title-tiny)|stat-[a-z-]+|badge-[a-z]+|alert-[a-z]+|dialog-overlay|login-[a-z]+|toast-[a-z]+|page-header|page-title|fade-in|row-hover|striped|tw-ui)$/;
/** The legacy :root variables (Tailwind's are var(--color-*), var(--font-sans), var(--tw-*)). */
const LEGACY_VAR = /var\(--(bg-|text-(primary|secondary|muted|on-accent)|accent|border|success|warning|danger|space-|weight-|font-(main|mono)|radius\)|radius-lg|shadow\))/;
/** Must match the @source lines in tailwind.css. */
const SCANNED = ['../components/', '../pages/', '../context/', '../App.tsx'];

/** Every whitespace-separated token inside a quoted string literal on one line. */
function stringTokens(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)) out.push(...m[2].split(/\s+/).filter(Boolean));
  return out;
}

describe('legacy CSS is gone (Review Focus 5)', () => {
  it('found the sources', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    expect(Object.keys(sources)).toContain('../App.tsx');
  });

  it('no source uses a legacy class name or tw-ui', () => {
    const hits = Object.entries(sources).flatMap(([file, src]) => stringTokens(src).filter((t) => LEGACY_CLASS.test(t)).map((t) => `${file}: ${t}`));
    expect(hits).toEqual([]);
  });

  it('no source reads a legacy CSS variable', () => {
    expect(Object.entries(sources).filter(([, src]) => LEGACY_VAR.test(src)).map(([file]) => file)).toEqual([]);
  });

  it('every file with Tailwind classes sits under an @source path (or its classes would silently vanish)', () => {
    const outside = Object.entries(sources)
      .filter(([file, src]) => /className=/.test(src) && !SCANNED.some((p) => file.startsWith(p)))
      .map(([file]) => file);
    expect(outside).toEqual([]);
  });

  it('the old legacy components are deleted', () => {
    expect(Object.keys(sources).filter((f) => /AdminPageHeader|common\/FieldError|useDashboardManager|pages\/UserManager/.test(f))).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd admin && npx vitest run src/theme/legacy-free.test.ts`
Expected: FAIL.
- "no source uses a legacy class name" lists every `tw-ui` token (Sidebar, TopBar, Sheet, ConfirmDialog, the pages…) and `AdminPageHeader.tsx`'s `btn` / `btn-sm` / `btn-outline`.
- "legacy CSS variable" lists `AdminPageHeader.tsx` and `FieldError.tsx`.
- "deleted" lists `../components/common/AdminPageHeader.tsx` and `../components/common/FieldError.tsx`.
- "found the sources" and "@source" pass.

- [ ] **Step 4: Check that nothing imports the files to delete, then delete them**

```bash
grep -rnE "AdminPageHeader|common/FieldError|FormErrorsContext|theme/legacy\.css|admin\.css|isBare|BARE_PATHS" admin/src --exclude='*.css' | grep -vE "components/common/(AdminPageHeader|FieldError)|components/Layout(\.test)?\.tsx"
```

Expected: only `admin/src/main.tsx: import './theme/legacy.css';` prints. Any other line is a leftover from Tasks 7–10: fix it there (switch to `PageHeader`, or to the `Field` error prop) before you continue.

```bash
git rm admin/src/theme/admin.css admin/src/theme/legacy.css admin/src/components/common/AdminPageHeader.tsx admin/src/components/common/FieldError.tsx admin/src/components/common/FieldError.test.tsx admin/src/components/Layout.test.tsx
```

- [ ] **Step 5: Rewrite `admin/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './theme/tailwind.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Strip every `tw-ui` token** (mechanical). Run this from the repo root:

```bash
grep -rl "tw-ui" admin/src --include='*.tsx' | xargs perl -pi -e 's/\btw-ui\s+//g; s/\s+tw-ui\b//g; s/ className="tw-ui"//g'
grep -rn "tw-ui" admin/src
```

The three substitutions cover:
- `"tw-ui flex …"` → `"flex …"`
- `"… shadow-lg tw-ui"` → `"… shadow-lg"`
- a lone `className="tw-ui"` → removed

Expected from the second grep: only these lines, which Steps 7–9 replace by hand:
- `admin/src/components/entity/EntityPage.tsx` (its doc comment)
- `admin/src/components/entity/entity.test.tsx` (four `tw-ui` assertions)
- `admin/src/components/ui/Sheet.test.tsx` (`expect(dialog.className).toContain('tw-ui');`)
- `admin/src/theme/tailwind.css` (the reset, which Step 10 replaces)
- `admin/src/theme/legacy-free.test.ts` (its own `LEGACY_CLASS` regex; it stays)

- [ ] **Step 7: Rewrite `admin/src/components/entity/EntityPage.tsx`**

```tsx
import type { ReactNode } from 'react';

interface EntityPageProps {
  header: ReactNode;
  toolbar?: ReactNode;
  table: ReactNode;
  /** The record Sheet (or null). A `full` Sheet covers the body, which is `relative`. */
  panel?: ReactNode;
}

/**
 * Entity page layout: header, then a body with the list column (toolbar + table) and the panel column.
 * The list column is a bounded flex column (min-h-0) so the DataTable's sticky header and inner scroll work.
 */
export function EntityPage({ header, toolbar, table, panel }: EntityPageProps) {
  return (
    <div className="flex h-full flex-col gap-4 bg-page p-6 font-sans text-ink">
      <div>{header}</div>
      <div className="relative flex min-h-0 flex-1 gap-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          {toolbar}
          {table}
        </div>
        {panel}
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Update `admin/src/components/entity/entity.test.tsx`.** Replace `it('EntityPage puts tw-ui on the header and list column, not on the root', …)` with:

```tsx
  it('EntityPage lays out the header, then the list column (toolbar + table) beside the panel', () => {
    render(<EntityPage header={<h1>Parties</h1>} toolbar={<div>tools</div>} table={<div>table</div>} panel={<aside>panel</aside>} />);
    expect(screen.getByRole('heading', { name: 'Parties' })).toBeTruthy();
    const listColumn = screen.getByText('table').parentElement!;
    expect(listColumn.contains(screen.getByText('tools'))).toBe(true);
    expect(listColumn.nextElementSibling).toBe(screen.getByText('panel'));
  });
```

- [ ] **Step 9: Update `admin/src/components/ui/Sheet.test.tsx`.** In `it('renders in place as a named, non-modal dialog; the table beside it stays usable', …)`, delete the line `expect(dialog.className).toContain('tw-ui');`.

- [ ] **Step 10: Rewrite `admin/src/theme/tailwind.css`**

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/preflight.css" layer(base);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
/* Tailwind only scans these paths. Every file that uses classes must sit under one (src/theme/legacy-free.test.ts checks). */
@source "../components";
@source "../pages";
@source "../context";
@source "../App.tsx";

@layer base {
  body {
    font-family: var(--font-sans);
    background-color: var(--color-page);
    color: var(--color-ink);
    line-height: var(--leading-normal);
  }
  /* v4 preflight leaves buttons on the default cursor; every admin button has always shown a pointer. */
  button:not(:disabled),
  [role="button"]:not(:disabled) {
    cursor: pointer;
  }
}

@theme {
  /* Scale values kept from the original admin theme so sizes do not shift. */
  --radius-sm: 6px;
  --radius-lg: 16px;
  --radius-full: 9999px;
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --leading-normal: 1.5;
  --leading-tight: 1.25;

  /* Custom admin panel design tokens (spec §5). */
  --color-sidebar: #1e293b;
  --color-sidebar-ink: #cbd5e1;
  --color-page: #f8fafc;
  --color-subtle: #f1f5f9;
  --color-card: #ffffff;
  --color-ink: #0f172a;
  --color-ink-2: #475569;
  --color-muted: #94a3b8;
  --color-accent: #4f46e5;
  --color-accent-hover: #4338ca;
  --color-accent-soft: #eef2ff;
  --color-line: #e2e8f0;
  --color-line-strong: #cbd5e1;
  --color-ok: #10b981;
  --color-ok-soft: #ecfdf5;
  --color-ok-text: #065f46;
  --color-warn: #f59e0b;
  --color-warn-soft: #fffbeb;
  --color-warn-text: #92400e;
  --color-bad: #f43f5e;
  --color-bad-soft: #fff1f2;
  --color-bad-text: #9f1239;
  --radius-control: 6px;
  --radius-card: 10px;
  --radius-panel: 16px;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, system-ui, sans-serif;
}
```

- [ ] **Step 11: Rewrite `admin/src/components/Layout.tsx`** (no bare paths: every page manages its own padding and scrolling)

```tsx
import { Outlet } from 'react-router-dom';
import { ElectionProvider } from '../context/ElectionContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { Sidebar } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';

/** VIEW: admin shell — grouped sidebar, top bar with global election picker, page outlet. Pages scroll themselves. */
export default function Layout() {
  return (
    <ElectionProvider>
      <ShellStatusProvider>
        <div className="flex h-screen bg-page font-sans text-ink">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-h-0 flex-1 overflow-hidden">
              <Outlet />
            </main>
          </div>
        </div>
      </ShellStatusProvider>
    </ElectionProvider>
  );
}
```

- [ ] **Step 12: Tests, greps and build**

Run: `cd admin && npx vitest run src/theme/legacy-free.test.ts`
Expected: PASS (5 tests).

Run: `cd admin && npm test && npm run build`
Expected:
- All test files pass. `FieldError.test.tsx` and `Layout.test.tsx` are gone, and `legacy-free.test.ts` is new.
- `vite build` writes one CSS file, with no `legacy` layer and no "Could not resolve './admin.css'".

Run each grep below from `admin/`. Each must print nothing.

```bash
cd admin
grep -rnE "\b(btn|btn-[a-z]+|form-(input|select|label|group|grid)|spinner|admin-[a-z-]+|mf-[a-z-]+|card-elevated|stat-[a-z]+|badge-[a-z]+|alert-[a-z]+|dialog-overlay|login-[a-z]+|toast-[a-z]+|page-header|page-title|fade-in|row-hover|striped)\b" src --include='*.tsx' --include='*.ts' --exclude='*.test.*'
grep -rnE "var\(--(bg-|text-(primary|secondary|muted|on-accent)|accent|border|success|warning|danger|space-|weight-|font-(main|mono)|radius\)|radius-lg|shadow\))" src
grep -rn "tw-ui\|legacyBody\|BARE_PATHS\|isBare\|admin-content\|AdminPageHeader\|common/FieldError\|legacy\.css\|admin\.css" src --exclude=legacy-free.test.ts
grep -rn "style={{" src --include='*.tsx' | grep -viE "color|background|width|border"
```

Then check what is left:

```bash
ls src/theme
ls src/components/common 2>&1
grep -nE "@layer|preflight|legacy" src/theme/tailwind.css
```

Expected:
- `ls src/theme` prints `legacy-free.test.ts  tailwind.css`.
- `ls src/components/common` prints "No such file or directory".
- The last grep prints exactly:
  - `1:@layer theme, base, components, utilities;`
  - `3:@import "tailwindcss/preflight.css" layer(base);`
  - the `legacy-free.test.ts` mention in the `@source` comment
  - the `@layer base {` line

The third grep skips `legacy-free.test.ts`, because that test names these tokens in its own regexes. The remaining `style={{` uses are all dynamic values: party colours, progress widths, the spinner size and the alliance border colour. That is why the fourth grep filters them out.

- [ ] **Step 13: Browser check at 1440×900** (preflight regressions, Review Focus 5)

  a. **Start everything:**
  - `docker compose up -d` (Postgres, Redis)
  - `cd backend && npm run start:dev` (port 3082)
  - `cd admin && npm run dev` (port 3081)
  - Sign in as a SUPER_ADMIN, created with `cd backend && npm run create-admin` if none exists.
  - On `/users/new`, create one EDITOR and one VIEWER account for the role rows.
  - Set the browser to 1440×900 (Playwright MCP: `browser_resize`).

  b. **Visit every route and compare it with the Step 1 screenshot.** On each one, look for the preflight-sensitive changes:
  - headings that lost their size
  - links that turned body-coloured or lost their hover state
  - icons or images that broke onto their own line (`svg` / `img` are now `display: block`)
  - inputs, selects, date pickers and colour pickers without a border or background
  - buttons without a pointer cursor
  - list bullets or extra padding
  - text that is no longer Inter

  The routes:
  - `/login`, signed out: centred card, logo, eye button, error banner after a wrong password
  - `/` as SUPER_ADMIN, EDITOR and VIEWER (three sign-ins): the right cards per role, and the page scrolls to its bottom
  - `/overrides`: seat list, editor, Declare won dialog, lock banner, live pill
  - `/elections`, `/elections/new`, `/elections/<id>`
  - `/manifests` and `/manifests/<id>`: the Summary, Edit and JSON tabs. In Edit, check every section is open, the chips, the comboboxes, the watchlist table, and the colour pickers.
  - `/parties`, `/parties/new`, `/parties/<id>` (logo and ECI symbol previews)
  - `/candidates`, `/candidates/new`, `/candidates/<id>` (link suggestions)
  - `/persons`, `/persons/<id>` (merge duplicates)
  - `/constituencies`, `/constituencies/<id>` (row checkboxes, bulk tag)
  - `/feedback`, `/feedback/<id>`: mailto link colour, page path in monospace
  - `/users`, `/users/new`, `/users/<id>`: the delete dialog, your own row disabled
  - `/logs`, `/logs/<id>`: date inputs, JSON blocks, Download CSV
  - `/status`: cards, slowest-routes table, the Refresh button
  - **Shell pieces on any page:**
    - ⌘K palette
    - "?" shortcuts dialog
    - the user menu with Log out
    - the election picker
    - one success and one error toast (save and break a party name)
    - the HealthDot link
  - `/users` signed in as EDITOR: the "Access denied" state

  c. **Fix any regression in the file that renders it** (a missing size, colour or `inline-flex` class). Then re-run Step 12 before you commit.

- [ ] **Step 14: Commit**

```bash
git add -A admin/src
git commit -m "admin: delete admin.css and the legacy layer; Tailwind preflight on; no tw-ui, AdminPageHeader, FieldError or bare paths

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Docs (FEATURES.md, CLAUDE.md, design notes)

decisions §11. Per the CLAUDE.md rule, every feature is documented in `docs/FEATURES.md`. CLAUDE.md drops the legacy-layer notes. NOTES.md marks what Phase 3 closed and keeps what stays open.

**Files:**
- Modify: `docs/FEATURES.md`, `CLAUDE.md`, `docs/design/admin/NOTES.md`

- [ ] **Step 1: Fix the stale Manifests line in `docs/FEATURES.md`.** In the `### Admin redesign: entity pages + ⌘K (2026-10)` entry, replace

```
Edit (all ten editors, every section expanded by default, collapsible by hand)
```

with

```
Edit (all ten editors, every section always open)
```

- [ ] **Step 2: Add the Phase 3 entry to `docs/FEATURES.md`.** Put it directly after the `### Admin redesign: entity pages + ⌘K (2026-10)` entry, before `### Party Symbols`:

```markdown
### Admin redesign: dashboard, login, admin pages, legacy CSS removed (2026-10)
- Dashboard (`/`), cards gated by role, refreshed every 30 s while the tab is visible:
  - SUPER_ADMIN and EDITOR, for the top-bar election:
    - KPIs: seats declared N / M, leading (with the party ahead in most seats), pending, last update (IST, "N min ago · Round R"), all from the admin live results
    - a Live console card: % of seats reporting, and who is editing which seat from the seat locks
    - System health: `/admin/status` for SUPER_ADMIN, the public `/health/ready` for EDITOR
    - Feedback: "N new", with three previews (kind badge, first line, page path as plain text, relative time)
  - SUPER_ADMIN only: Recent activity, the last 10 audit entries in readable sentences
  - VIEWER: only an elections overview (Live / Upcoming / Finalized). It never calls an admin endpoint.
  - Each card has its own loading, error ("Try again") and empty state.
- Login:
  - centred card with the real logo and show/hide password
  - errors by status: 401 and 400 → "Invalid email or password"; 429 → "Too many attempts — wait a minute and try again"; network → "Network error — check your connection"
  - a signed-in visit to `/login` redirects; after sign-in you return to the page you asked for (`ProtectedRoute` keeps it in the route state)
- Feedback (`/feedback`, panel at `/feedback/:id`):
  - status chips and paging (50) on the server
  - Mark read / Resolve / Mark new per row and in the panel, busy per row
  - the panel shows the full message, a mailto email and the page path as plain text
  - the page steps back when an action empties the last page
- Users (`/users`, panel at `/users/:id`, create at `/users/new`):
  - search over the list (max 200, "Showing first 200")
  - edit name, email, role and an optional new password, saved together (an empty password is not sent)
  - one confirm dialog to delete
  - your own role and delete are disabled
  - shown inline in the panel, not as toasts: the last-super-admin refusal (403), a duplicate email (409) and field errors
- Audit logs (`/logs`, panel at `/logs/:id`):
  - action and entity filters list what the backend actually writes (result override, bulk seat save, seat-lock take-over)
  - From / To are IST days and both are included
  - From after To is refused
  - stale saved filters are reset
  - the admin name comes from the `users` relation ("Deleted user" when the account is gone)
  - rows stay on screen while refreshing
  - "Showing latest 200"
  - CSV fields are all quoted, include the before/after JSON and are guarded against spreadsheet formulas
  - the panel shows the full before/after JSON
- System status: Tailwind cards; "Refreshing…" only for a manual refresh; after a failed poll the last data stays with "Showing data from hh:mm:ss (IST)".
- Live Console and shell:
  - Declare won asks first
  - Save seat is disabled on a clean seat
  - the live pill turns rose "Live updates offline" after 3 failed reconnects in a row
  - Log out and the health dot link ask before discarding unsaved edits
  - list searches wait 300 ms and ignore stale answers
- Manifest editor: every section is always open (no collapse); all editors use the shared Tailwind controls; the map centre and the live-tab seat list can be typed normally.
- Legacy CSS removed:
  - `admin.css` and the `legacy` cascade layer are deleted; Tailwind preflight is on
  - `tw-ui`, `AdminPageHeader`, `FieldError` and the padded legacy `<main>` are gone
  - `src/theme/legacy-free.test.ts` fails if a legacy class or variable comes back, or a file with classes sits outside the `@source` paths
```

- [ ] **Step 3: Replace the Admin line in `CLAUDE.md`.** Replace the line that starts `- **Admin:** React + TypeScript (Vite) panel for managing elections, candidates, results, manifests, live overrides. Being redesigned` with:

```markdown
- **Admin:** React + TypeScript (Vite) panel for managing elections, candidates, results, manifests, live overrides (design spec `docs/superpowers/specs/2026-10-01-admin-redesign-design.md`). Tailwind v4 **with preflight** + Radix; there is no legacy CSS (`src/theme/legacy-free.test.ts` guards it). Tailwind scans `src/components`, `src/pages`, `src/context` and `src/App.tsx` (`@source` in `admin/src/theme/tailwind.css`) — files with classes go there. Global election selection via `ElectionContext`. Entity pages = `components/entity/EntityPage` + `components/ui/{DataTable,Sheet}`; records open at `/x/:id` via `useEntityRoute`, and every editor calls `useUnsavedGuard(dirty)`. Dates are shown in IST (`utils/time.ts`). Every page scrolls itself (`h-full overflow-y-auto` or `EntityPage`).
```

- [ ] **Step 4: Update `docs/design/admin/NOTES.md`.**

  a. Under `### Dashboard (`dashboard.*`)`, append this as the last bullet:

```markdown
- Built in Phase 3. "Leading" shows the number of undeclared seats with a leader, with "<party> ahead in N seats" (the party leading the most of them). "Round R" is the highest current round of any seat. The header phase reads "counting in progress", "upcoming" or "final results". EDITOR has no Recent activity card (its API is SUPER_ADMIN-only); VIEWER sees an elections overview instead of the counting cards.
```

  b. Under `### Login (`login.*`)`, append:

```markdown
- Built in Phase 3, with status-specific errors (401/400, 429, network) and a return to the requested page after sign-in.
```

  c. Replace both sections `## Phase 1 follow-ups (carry into Phase 2)` and `## Phase 2 follow-ups (carry into Phase 3)`, including all their bullets, with:

```markdown
## Closed in Phase 3
- Live pill "offline" state; Declare won confirmation; Save seat disabled on a clean seat; HealthDot and Log out use the unsaved guard.
- Manifest editor rebuilt in Tailwind with always-open sections; `useResourceList` search debounce (300 ms) and stale-response guard.
- `admin.css` deleted, Tailwind preflight on.

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
```

- [ ] **Step 5: Final verification**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

Run: `grep -n "preflight off\|legacy \`admin.css\`\|tw-ui" CLAUDE.md`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add docs/FEATURES.md CLAUDE.md docs/design/admin/NOTES.md
git commit -m "docs: admin redesign phase 3 (dashboard, login, admin pages, legacy CSS removed)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Out of scope (stays open after this plan)

These are from decisions.md "Out of scope", and NOTES.md lists them after Task 14:
- the Save / Discard / Cancel 3-way dialog
- a data router / Back-button guard
- the cross-seat candidate table
- the ⌘K 50-row server cap
- the seat-lock edge cases
- backend hardening
- a responsive sidebar
- bundle splitting

The spec's top-bar feedback bell (§3) is also not built here, because decisions.md does not list it for Phase 3.
