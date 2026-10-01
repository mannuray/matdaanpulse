# Admin Redesign Phase 2 — Entity Pages + ⌘K Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Parties, Elections, Persons, Candidates, Constituencies and Manifests as one "header + toolbar + table + right-hand panel" pattern at `/x` and `/x/:id`, fix the seven known data bugs on those pages, and add the ⌘K command palette.

**Architecture:**
- Shared primitives go in `admin/src/components/ui/`: form controls, the table, the pager, and a non-modal Radix Dialog `Sheet` rendered in place next to the table.
- Two hooks hold the page plumbing:
  - `useEntityRoute(base, dirty)` reads `/x/:id`, and opens or closes records while keeping the query string.
  - `useUnsavedGuard(dirty)` reports unsaved edits to `ShellStatusContext` and arms `beforeunload`.
- Each entity gets a page (`admin/src/pages/<Entity>.tsx`) plus a panel under `admin/src/components/entity/<entity>/`. The panels reuse the existing hooks, changing them only where a page needs it:
  - a `dirty` snapshot
  - the global election from `useElection()`
  - the bug fixes
- Old `*Manager/*Detail/*Edit` pages are deleted in the task that replaces them, because their hooks change shape there.

**Tech Stack:** React 18, React Router 6 (`BrowserRouter`), Vite 5, Tailwind CSS v4 (utilities only, preflight off), Radix (`dialog`), `lucide-react`, `clsx` + `tailwind-merge`, Vitest + Testing Library (`fireEvent`, no user-event). No new npm dependencies. No backend change.

**Spec:** `docs/superpowers/specs/2026-10-01-admin-redesign-design.md` (§1 Shell, §4 Entity pages, §5 Visual rules, §6 Architecture, Delivery phases → Phase 2).
- Binding controller decisions: `docs/superpowers/plans/phase2-input/decisions.md`.
- Behaviour inventory that must not be lost: `docs/superpowers/plans/phase2-input/entity-map.md`.
- Reference screen: `docs/design/admin/candidates.png` + `.html`.

## Global Constraints

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

## Review Focus

1. **Leaving a dirty panel:**
   - Clicking another row, the close button, Esc, the current section's sidebar link, a ⌘K result or the election picker asks `Discard unsaved changes?`. Cancel keeps the record and the edits.
   - A pointer-down outside the panel does nothing.
   - Clicking rows quickly shows the last clicked record.
   - Actions that reload the record (candidate linking, person merge) are disabled while the form is dirty.
   - The in-panel "Open person" link asks first.
   
   Pinned in Task 6 (Sheet), Task 7 (Sidebar), Task 9 (Parties: row switch, Esc, outside click, rapid switch), Tasks 11–12 (reload-causing actions, "Open person") and Task 15 (palette).
2. **Deep-linking `/x/:id` for a record outside the current page, filter, seat or election:**
   - The panel loads it by id.
   - Elections resolve the record from the context list, not the filtered table.
   - Candidates switch the Seat select to the candidate's seat.
   - A record from another election shows "Switch election".
   - An unknown id shows "not found" in the panel.
   
   Pinned in Tasks 9 (unknown id), 10 (hidden by filter) and 12 (other seat, other election).
3. **The merge direction and the legacy gender value:**
   - Merging duplicate D while viewing person P keeps P: `mergePersons(D, P)`.
   - A person stored as `'M'` shows "Male", and saving an unrelated field keeps `gender: 'Male'` instead of writing `''`.
   
   Pinned in Task 2 and Task 11.
4. **Paging + filters:**
   - "Next" really changes page (Parties, Persons, Constituencies).
   - A new search goes back to page 1.
   - With a district or tag filter on, "select all" and bulk tag touch only the visible rows.
   - The selection clears when the page or filter changes.
   
   Pinned in Tasks 1 and 13.
5. **Role-gated actions:** an EDITOR never sees Finalize, Merge duplicates or Publish; a SUPER_ADMIN does. Pinned in Tasks 10, 11 and 14.

## File map

**Shared (Tasks 1–8)**
- Modify `admin/src/hooks/useResourceList.ts` (pager fix, `initialSearch`) and add `useResourceList.test.ts`.
- Create `admin/src/utils/person-format.ts` (+ `.test.ts`). Modify `admin/src/services/person.service.ts` and `admin/src/hooks/usePersonEdit.ts` (merge direction), and add `usePersonEdit.test.tsx`.
- Create `admin/src/utils/numbers.ts` (+ `.test.ts`). Modify `admin/src/hooks/useConstituencyEditor.ts` and `admin/src/hooks/useCandidateEdit.ts` (+ tests). Make a minimal compile fix in `admin/src/pages/CandidateEdit.tsx` and `CandidateDetail.tsx`.
- Create in `admin/src/components/ui/`:
  - `Input.tsx` (Input, Select, Textarea), `Field.tsx` (Field, FormSection), `Combobox.tsx`, `form.test.tsx`
  - `PageHeader.tsx`, `Toolbar.tsx` (Toolbar, SearchInput, ChipGroup), `DataTable.tsx`, `Pager.tsx`, `EmptyState.tsx`, `list.test.tsx`
  - `Sheet.tsx`, `ConfirmDialog.tsx`, `Sheet.test.tsx`
- Create `admin/src/hooks/useUnsavedGuard.ts` (+ `.test.tsx`). Modify `admin/src/context/ShellStatusContext.tsx` (prompt copy), `admin/src/pages/LiveConsole.tsx`, `admin/src/components/shell/Sidebar.tsx`, `shell.test.tsx` and `admin/src/pages/LiveConsole.test.tsx`.
- Create `admin/src/hooks/useEntityRoute.ts` (+ `.test.tsx`), `admin/src/components/routing/EditRedirect.tsx`, `admin/src/components/entity/{EntityPage.tsx,PanelFooter.tsx,NoElection.tsx,entity.test.tsx}` and `admin/src/test-utils/entity-harness.tsx`. Modify `admin/src/components/Layout.tsx` (`BARE_PATHS`) and `admin/src/theme/tailwind.css` (`@source "../components/entity"`).

**Pages (Tasks 9–14)**, each one adding its route to `admin/src/App.tsx`, its path to `BARE_PATHS` and its `@source` line:
- Parties:
  - create `admin/src/pages/Parties.tsx` (+ test) and `components/entity/parties/{PartyPanel,PartyCreatePanel,SymbolField,ColourField}.tsx`
  - modify `usePartyEdit.ts` (+ test) and `usePartyManager.ts`
  - delete `PartyManager/PartyDetail/PartyEdit.tsx`
- Elections:
  - create `Elections.tsx` (+ test) and `components/entity/elections/ElectionPanel.tsx`
  - modify `useElectionManager.ts` (+ test) and `context/ElectionContext.tsx` (`reload`, + test)
  - delete `ElectionManager.tsx`
- Persons:
  - create `Persons.tsx` (+ test) and `components/entity/persons/PersonPanel.tsx`
  - modify `usePersonEdit.ts` (+ test)
  - delete `PersonManager/PersonDetail/PersonEdit.tsx`
- Candidates:
  - create `Candidates.tsx` (+ test), `components/entity/candidates/CandidatePanel.tsx` and `components/entity/ElectionMismatch.tsx`
  - modify `useCandidateManager.ts` (+ test) and `useCandidateEdit.ts`
  - delete `CandidateManager/CandidateDetail/CandidateEdit.tsx`
- Constituencies:
  - create `Constituencies.tsx` (+ test) and `components/entity/constituencies/{ConstituencyPanel.tsx,tags.ts}`
  - modify `useConstituencyManager.ts` (+ test)
  - delete `ConstituencyManager/ConstituencyDetail/ConstituencyEdit.tsx`
- Manifests:
  - create `Manifests.tsx` (+ test) and `components/entity/manifests/{ManifestPanel,ManifestSummary}.tsx`
  - modify `useManifestEditor.ts`
  - delete `ManifestDetail/ManifestEditor.tsx`

**⌘K (Task 15):** create `admin/src/services/search.service.ts`, `admin/src/hooks/useCommandSearch.ts` and `admin/src/components/shell/{CommandPalette.tsx,palette.test.tsx}`. Modify `TopBar.tsx` and `ShortcutsDialog.tsx`.

**Removal (Task 16):** delete `admin/src/components/common/AdminLandingCard.tsx` and `admin/src/components/ElectionPicker.tsx`. `AdminPageHeader` stays, because Phase 3 pages (Audit logs, Feedback, Users, System status) still use it.

**Docs (Task 17):** `docs/FEATURES.md`, `CLAUDE.md`, `docs/design/admin/NOTES.md`.

---

### Task 1: Bug fix — list paging and `?q=` initial search (`useResourceList`)

Fixes decisions.md bug 2 (`loadPage` never moves the page, so Party/Person paging is broken) and adds the hook half of bug 5 (`initialSearch`, used by Persons in Task 11).

**Files:**
- Modify: `admin/src/hooks/useResourceList.ts`
- Test: `admin/src/hooks/useResourceList.test.ts`

**Interfaces:**
- Produces:
  - `useResourceList<F>({ key, pageSize?, initialFilters, initialSearch?, onLoad })`
  - `initialSearch?: string | null`, which wins over the remembered `${key}_search` when non-empty
  - `loadPage(p: number): void`, which now sets the page (the load effect fetches it)
  - Every other return field is unchanged: `items, total, page, setPage, error, totalPages, loading, search, filters, handleSearch, updateFilters, loadPage, navigateWithScroll, refresh`.

- [ ] **Step 1: Write the failing test** `admin/src/hooks/useResourceList.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useResourceList } from './useResourceList';

afterEach(() => localStorage.clear());

describe('useResourceList', () => {
  it('loadPage moves to that page and loads it', async () => {
    const onLoad = vi.fn(async (p: number) => ({ data: [{ id: `p${p}` }], total: 60 }));
    const { result } = renderHook(() => useResourceList({ key: 't1', pageSize: 25, initialFilters: {}, onLoad }));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p1' }]));
    act(() => result.current.loadPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));
    await waitFor(() => expect(result.current.items).toEqual([{ id: 'p2' }]));
    expect(result.current.totalPages).toBe(3);
  });

  it('a new search goes back to page 1', async () => {
    const onLoad = vi.fn(async () => ({ data: [], total: 60 }));
    const { result } = renderHook(() => useResourceList({ key: 't2', initialFilters: {}, onLoad }));
    act(() => result.current.loadPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));
    act(() => result.current.handleSearch('pat'));
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(onLoad).toHaveBeenLastCalledWith(1, 'pat', {}));
  });

  it('initialSearch wins over the remembered search and is sent to onLoad', async () => {
    localStorage.setItem('t3_search', 'old');
    const onLoad = vi.fn(async () => ({ data: [], total: 0 }));
    const { result } = renderHook(() => useResourceList({ key: 't3', initialFilters: {}, initialSearch: 'Nitish', onLoad }));
    expect(result.current.search).toBe('Nitish');
    await waitFor(() => expect(onLoad).toHaveBeenCalledWith(1, 'Nitish', {}));
  });

  it('without initialSearch it falls back to the remembered search', () => {
    localStorage.setItem('t4_search', 'old');
    const onLoad = vi.fn(async () => ({ data: [], total: 0 }));
    const { result } = renderHook(() => useResourceList({ key: 't4', initialFilters: {}, initialSearch: null, onLoad }));
    expect(result.current.search).toBe('old');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/hooks/useResourceList.test.ts`
Expected: FAIL. "loadPage moves to that page" times out on `expected 1 to be 2`, and "initialSearch wins" fails with `expected 'old' to be 'Nitish'`.

- [ ] **Step 3: Implement.** In `admin/src/hooks/useResourceList.ts`, replace the `ListOptions` interface and the function signature with:

```ts
interface ListOptions<F> {
  key: string;
  pageSize?: number;
  initialFilters: F;
  /** Search to start with (e.g. from `?q=`); wins over the remembered search when non-empty. */
  initialSearch?: string | null;
  onLoad: (page: number, search: string, filters: F) => Promise<{ data: any[], total: number }>;
}

/**
 * HOOK: useResourceList (SOLID: SRP/OCP)
 * Standardizes paging, searching, and filter persistence for Admin lists.
 */
export function useResourceList<F>({ key, pageSize = 25, initialFilters, initialSearch, onLoad }: ListOptions<F>) {
```

Replace the `search` state line with:

```ts
  const [search, setSearch] = useState(() => initialSearch || localStorage.getItem(searchKey) || '');
```

In the returned object, replace `loadPage: (p: number) => load(p, search, filters),` with:

```ts
    /** Go to page `p`; the effect above loads it (calling load directly left `page` behind). */
    loadPage: (p: number) => setPage(Math.max(1, p)),
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/hooks/useResourceList.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Run the full suite and the build**

Run: `cd admin && npm test && npm run build`
Expected: all tests PASS, and the build succeeds. `AuditLogs`, `Feedback` and `useUserManager` also use this hook, but none of them calls `loadPage`. `grep -rn "loadPage(" admin/src` shows only the ±1 pagers of `PartyManager` and `PersonManager`, so no caller relied on `loadPage(page)` as a reload.

- [ ] **Step 6: Commit**

```bash
git add admin/src/hooks/useResourceList.ts admin/src/hooks/useResourceList.test.ts
git commit -m "admin: fix list paging (loadPage sets the page) and add initialSearch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Bug fix — person merge direction and legacy gender values

Fixes decisions.md bug 1 and bug 3:
- **Bug 1:** `handleMerge` calls `mergePersons(id, sourceId)`, but the signature is `(sourceId, targetId)` and the backend deletes the source. The viewed person is deleted.
- **Bug 3:** The list shows `'M'`/`'F'`, while the form has no such options, so saving any field on a legacy person writes `gender: ''`.

**Files:**
- Create: `admin/src/utils/person-format.ts`, `admin/src/utils/person-format.test.ts`
- Modify: `admin/src/services/person.service.ts`, `admin/src/hooks/usePersonEdit.ts:108`
- Test: `admin/src/hooks/usePersonEdit.test.tsx`

**Interfaces:**
- Produces:
  - `normalizeGender(g: string | null | undefined): string`: `'M'|'m'|'male' → 'Male'`, `'F'… → 'Female'`, `'O'… → 'Other'`, `null/'' → ''`, and any other value passes through trimmed
  - `genderLabel(g): string`: `normalizeGender(g) || 'Not specified'`
  - `PersonService.prepareFormState(p).gender` is now normalised
  - `usePersonEdit(id).handleMerge(duplicateId, duplicateName)` merges the duplicate **into** `id`

- [ ] **Step 1: Write the failing tests.** `admin/src/utils/person-format.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { genderLabel, normalizeGender } from './person-format';
import { PersonService } from '../services/person.service';

describe('person gender', () => {
  it('maps legacy single letters and keeps full words', () => {
    expect(normalizeGender('M')).toBe('Male');
    expect(normalizeGender('f')).toBe('Female');
    expect(normalizeGender('O')).toBe('Other');
    expect(normalizeGender('Male')).toBe('Male');
    expect(normalizeGender(' female ')).toBe('Female');
    expect(normalizeGender('Transgender')).toBe('Transgender');
    expect(normalizeGender(null)).toBe('');
  });

  it('labels empty as "Not specified"', () => {
    expect(genderLabel(undefined)).toBe('Not specified');
    expect(genderLabel('M')).toBe('Male');
  });

  it('prepareFormState loads a legacy "M" as Male so the select matches', () => {
    const form = PersonService.prepareFormState({ id: 'p1', name: 'A', photo_url: null, gender: 'M', education: null, date_of_birth: null });
    expect(form.gender).toBe('Male');
  });
});
```

`admin/src/hooks/usePersonEdit.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/person.api', () => ({
  getPerson: vi.fn(async () => ({
    id: 'p1', name: 'Nitish Kumar', gender: 'M', education: null, photo_url: null, date_of_birth: null, bio: null, metadata: {}, candidates: [],
  })),
  updatePerson: vi.fn(async () => ({})),
  mergePersons: vi.fn(async () => ({ merged: true, target_id: 'p1' })),
  getPersons: vi.fn(async () => ({ success: true, data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } })),
}));
import { usePersonEdit } from './usePersonEdit';
import { mergePersons, updatePerson } from '../services/person.api';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => { vi.clearAllMocks(); vi.restoreAllMocks(); });

describe('usePersonEdit', () => {
  it('merging keeps the person being viewed: the duplicate is the source', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    await waitFor(() => expect(result.current.person?.id).toBe('p1'));
    await act(() => result.current.handleMerge('dup', 'Nitish Kr'));
    expect(mergePersons).toHaveBeenCalledWith('dup', 'p1');
  });

  it('a legacy "M" loads as Male, so saving another field keeps the gender', async () => {
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    await waitFor(() => expect(result.current.form.gender).toBe('Male'));
    act(() => result.current.setForm({ ...result.current.form, education: 'BA' }));
    await act(() => result.current.handleSave());
    expect(updatePerson).toHaveBeenCalledWith('p1', expect.objectContaining({ gender: 'Male', education: 'BA' }));
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/utils/person-format.test.ts src/hooks/usePersonEdit.test.tsx`
Expected: FAIL.
- `person-format.test.ts`: "Failed to resolve import './person-format'".
- `usePersonEdit.test.tsx`: `expected "spy" to be called with arguments: [ 'dup', 'p1' ]` (it received `['p1', 'dup']`), and `expected 'M' to be 'Male'`.

- [ ] **Step 3: Create `admin/src/utils/person-format.ts`**

```ts
const GENDERS: Record<string, string> = {
  m: 'Male', male: 'Male',
  f: 'Female', female: 'Female',
  o: 'Other', other: 'Other',
};

/** Form value for a stored gender: legacy 'M'/'F'/'O' become 'Male'/'Female'/'Other'; unknown values pass through. */
export function normalizeGender(g: string | null | undefined): string {
  const v = (g ?? '').trim();
  return GENDERS[v.toLowerCase()] ?? v;
}

/** Display label for tables and the panel header. */
export function genderLabel(g: string | null | undefined): string {
  return normalizeGender(g) || 'Not specified';
}
```

- [ ] **Step 4: Normalise in `admin/src/services/person.service.ts`.** Add the import at the top:

```ts
import { normalizeGender } from '../utils/person-format';
```

In `prepareFormState`, replace `gender: person.gender || '',` with:

```ts
      gender: normalizeGender(person.gender),
```

- [ ] **Step 5: Fix the merge direction in `admin/src/hooks/usePersonEdit.ts`.** Replace the whole `handleMerge` function with:

```ts
  /** Merge a duplicate record INTO the person being viewed: the duplicate's contests move here and it is deleted. */
  const handleMerge = async (duplicateId: string, duplicateName: string) => {
    if (!id) return;
    if (!window.confirm(`Merge "${duplicateName}" into "${person?.name}"? This action is permanent.`)) return;

    setMerging(true);
    try {
      // mergePersons(sourceId, targetId): the backend deletes the source.
      await mergePersons(duplicateId, id);
      toast('Records merged successfully');
      setMergeSearch('');
      loadPerson();
    } catch (err) {
      toastError(err, 'Merge failed');
    } finally {
      setMerging(false);
    }
  };
```

- [ ] **Step 6: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/utils/person-format.test.ts src/hooks/usePersonEdit.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 7: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add admin/src/utils/person-format.ts admin/src/utils/person-format.test.ts admin/src/services/person.service.ts admin/src/hooks/usePersonEdit.ts admin/src/hooks/usePersonEdit.test.tsx
git commit -m "admin: merge duplicates into the viewed person; normalise legacy M/F gender

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Bug fix — numeric fields (0 kept, seat number guarded) and the dead candidate photo field

This task fixes three bugs from decisions.md:
- **Bug 7.** `Number(x) || null` turns 0 into null, and an unguarded `const_no` sends NaN. Loading had the same bug: `String(meta.population || '')` showed a stored 0 as empty.
- **Bug 4.** `photo_url` belongs to the person, so the candidate form drops it.
- **Age.** Candidate age had a related problem (`Number('') → 0`), fixed here in the same way. Saving also no longer wipes metadata keys the form doesn't edit.

**Files:**
- Create: `admin/src/utils/numbers.ts`, `admin/src/utils/numbers.test.ts`
- Modify: `admin/src/hooks/useConstituencyEditor.ts`, `admin/src/hooks/useCandidateEdit.ts`
- Modify (compile only, deleted in Task 12): `admin/src/pages/CandidateEdit.tsx`, `admin/src/pages/CandidateDetail.tsx`
- Test: `admin/src/hooks/useConstituencyEditor.test.tsx`, `admin/src/hooks/useCandidateEdit.test.tsx`

**Interfaces:**
- Produces:
  - `toOptionalNumber(v: string | number | null | undefined): number | null`. An empty value, whitespace or `null` gives `null`. `'0'` gives `0`. `'1,234'` gives `1234`. Anything non-numeric gives `null`.
  - `parseSeatNumber(v: string | number): number | null`. Returns a whole number ≥ 1, otherwise `null`.
  - `useConstituencyEditor(id)` also returns `fieldErrors: Record<string, string>`. When the seat number is invalid, it returns `{ const_no: 'Enter a whole number, 1 or more' }` and saves nothing.
  - The `useCandidateEdit(id).form` keys are now `name, party_id, age, gender, education, criminal_cases, assets`. `photo_url` is gone.

- [ ] **Step 1: Write the failing tests.** `admin/src/utils/numbers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseSeatNumber, toOptionalNumber } from './numbers';

describe('toOptionalNumber', () => {
  it('keeps 0 and parses grouped numbers', () => {
    expect(toOptionalNumber('0')).toBe(0);
    expect(toOptionalNumber(0)).toBe(0);
    expect(toOptionalNumber('1,234')).toBe(1234);
    expect(toOptionalNumber(' 61.5 ')).toBe(61.5);
  });
  it('empty or junk → null', () => {
    expect(toOptionalNumber('')).toBeNull();
    expect(toOptionalNumber('  ')).toBeNull();
    expect(toOptionalNumber(null)).toBeNull();
    expect(toOptionalNumber('abc')).toBeNull();
    expect(toOptionalNumber(Number.NaN)).toBeNull();
  });
});

describe('parseSeatNumber', () => {
  it('accepts whole numbers from 1', () => {
    expect(parseSeatNumber('142')).toBe(142);
    expect(parseSeatNumber(7)).toBe(7);
  });
  it('rejects 0, negatives, decimals and junk', () => {
    for (const v of ['0', '-3', '1.5', 'abc', '']) expect(parseSeatNumber(v)).toBeNull();
  });
});
```

`admin/src/hooks/useConstituencyEditor.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/constituency.service', () => ({
  getAdminConstituencyDetail: vi.fn(async () => ({
    id: 'BR_VS2025_PATNA', election_id: 'e1', name: 'Patna Sahib', const_no: 142, type: 'GEN', state_id: 1,
    district_id: null, region_id: null, voter_turnout: null,
    metadata: { population: 0, literacy_pct: 61.2, tags: ['urban'], phase: 2, source: 'census' },
  })),
  updateConstituency: vi.fn(async () => ({})),
}));
vi.mock('../services/geo.service', () => ({ getDistricts: vi.fn(async () => []), getRegions: vi.fn(async () => []) }));
import { useConstituencyEditor } from './useConstituencyEditor';
import { updateConstituency } from '../services/constituency.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('useConstituencyEditor numbers', () => {
  it('shows a stored 0 as "0"', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    expect(result.current.editDemographics.population).toBe('0');
    expect(result.current.adminInfo.phase).toBe('2');
  });

  it('saves 0 as 0, empty as null, and keeps other metadata', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setEditDemographics({ ...result.current.editDemographics, literacy_pct: '0', urban_pct: '' }));
    await act(() => result.current.handleSave());
    expect(updateConstituency).toHaveBeenCalledWith('BR_VS2025_PATNA', expect.objectContaining({
      const_no: 142,
      metadata: expect.objectContaining({ population: 0, literacy_pct: 0, urban_pct: null, source: 'census', tags: ['urban'] }),
    }));
  });

  it('an invalid seat number is reported on the field and nothing is sent', async () => {
    const { result } = renderHook(() => useConstituencyEditor('BR_VS2025_PATNA'), { wrapper });
    await waitFor(() => expect(result.current.constituency).not.toBeNull());
    act(() => result.current.setAdminInfo({ ...result.current.adminInfo, const_no: 'abc' }));
    let ok = true;
    await act(async () => { ok = await result.current.handleSave(); });
    expect(ok).toBe(false);
    expect(result.current.fieldErrors.const_no).toBe('Enter a whole number, 1 or more');
    expect(updateConstituency).not.toHaveBeenCalled();
  });
});
```

`admin/src/hooks/useCandidateEdit.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/candidate.service', () => ({
  getCandidate: vi.fn(async () => ({
    id: 'c1', person_id: null, person: null, election_id: 'e1', const_id: 's1', party_id: 'BJP', party: null,
    name: 'Ravi Prasad', is_incumbent: false, metadata: { age: 58, criminal_cases: 0, affidavit_url: 'https://x/a.pdf' },
  })),
  updateCandidate: vi.fn(async () => ({})),
  linkCandidatePerson: vi.fn(async () => ({})),
  unlinkCandidatePerson: vi.fn(async () => ({})),
}));
vi.mock('../services/person.api', () => ({
  getPersons: vi.fn(async () => ({ success: true, data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
  createPerson: vi.fn(async () => ({ id: 'p9' })),
}));
vi.mock('../services/geo.service', () => ({ getParties: vi.fn(async () => []) }));
import { useCandidateEdit } from './useCandidateEdit';
import { updateCandidate } from '../services/candidate.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('useCandidateEdit save payload', () => {
  it('has no photo_url, keeps 0 cases, sends empty age as null, and keeps other metadata', async () => {
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    expect('photo_url' in result.current.form).toBe(false);
    expect(result.current.form.criminal_cases).toBe(0);
    act(() => result.current.setForm({ ...result.current.form, age: '' }));
    await act(() => result.current.handleSave());
    const [, payload] = vi.mocked(updateCandidate).mock.calls[0];
    expect(payload).not.toHaveProperty('photo_url');
    expect(payload.metadata).toEqual({ affidavit_url: 'https://x/a.pdf', age: null, gender: '', education: '', criminal_cases: 0, assets: '' });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/utils/numbers.test.ts src/hooks/useConstituencyEditor.test.tsx src/hooks/useCandidateEdit.test.tsx`
Expected: FAIL.
- `numbers.test.ts`: "Failed to resolve import './numbers'".
- Constituency: `expected '' to be '0'`.
- Candidate: `expected true to be false` (because `photo_url` is still in the form).

- [ ] **Step 3: Create `admin/src/utils/numbers.ts`**

```ts
/** Form text → number for optional numeric fields: '' / whitespace / null → null, '0' → 0, '1,234' → 1234, junk → null. */
export function toOptionalNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const t = v.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Seat (constituency) number: a whole number of 1 or more, otherwise null. */
export function parseSeatNumber(v: string | number): number | null {
  const n = toOptionalNumber(v);
  return n !== null && Number.isInteger(n) && n >= 1 ? n : null;
}
```

- [ ] **Step 4: Rewrite `admin/src/hooks/useConstituencyEditor.ts`.** This adds field errors, keeps 0 on load and save, and guards the seat number.

```ts
import { useState, useEffect, useCallback } from 'react';
import { getAdminConstituencyDetail, updateConstituency } from '../services/constituency.service';
import { getDistricts, getRegions } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import { parseSeatNumber, toOptionalNumber } from '../utils/numbers';
import type { Constituency } from '../types';

export const SEAT_NUMBER_ERROR = 'Enter a whole number, 1 or more';

/**
 * CONTROLLER: Constituency Editor (MVC)
 */
export function useConstituencyEditor(id?: string) {
  const { toast, toastError } = useToast();

  const [constituency, setConstituency] = useState<Constituency | null>(null);
  const [districts, setDistricts] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Modular State
  const [editDemographics, setEditDemographics] = useState({
    population: '', literacy_pct: '', urban_pct: '', sc_st_pct: '',
    dominant_castes: '', religions: ''
  });
  const [adminInfo, setAdminInfo] = useState({
    district_id: '' as string | number,
    region_id: '' as string | number,
    const_no: '' as string | number,
    phase: '' as string | number
  });

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getAdminConstituencyDetail(id);
      setConstituency(data);

      // `?? ''`, not `|| ''`: a stored 0 must show as "0".
      const meta = data.metadata || {};
      setEditDemographics({
        population: String(meta.population ?? ''),
        literacy_pct: String(meta.literacy_pct ?? ''),
        urban_pct: String(meta.urban_pct ?? ''),
        sc_st_pct: String(meta.sc_st_pct ?? ''),
        dominant_castes: String(meta.dominant_castes ?? ''),
        religions: String(meta.religions ?? '')
      });
      setAdminInfo({
        district_id: data.district_id ?? '',
        region_id: data.region_id ?? '',
        const_no: data.const_no ?? '',
        phase: String(meta.phase ?? '')
      });

      if (data.state_id) {
        const [d, r] = await Promise.all([
          getDistricts(data.state_id),
          getRegions(data.state_id)
        ]);
        setDistricts(d);
        setRegions(r);
      }
      setIsDirty(false);
      setFieldErrors({});
    } catch (err) {
      toastError(err, 'Failed to load constituency details');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markDirty = () => setIsDirty(true);

  const addTag = (tag: string) => {
    if (!tag || !constituency) return;
    const tags = (constituency.metadata?.tags as string[]) || [];
    if (tags.includes(tag)) return;
    setConstituency({
      ...constituency,
      metadata: { ...constituency.metadata, tags: [...tags, tag] }
    });
    setIsDirty(true);
  };

  const removeTag = (tag: string) => {
    if (!constituency) return;
    const tags = (constituency.metadata?.tags as string[]) || [];
    setConstituency({
      ...constituency,
      metadata: { ...constituency.metadata, tags: tags.filter(t => t !== tag) }
    });
    setIsDirty(true);
  };

  const handleSave = async (): Promise<boolean> => {
    if (!id || !constituency) return false;
    const constNo = parseSeatNumber(adminInfo.const_no);
    if (constNo === null) {
      setFieldErrors({ const_no: SEAT_NUMBER_ERROR });
      return false;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      await updateConstituency(id, {
        district_id: adminInfo.district_id ? Number(adminInfo.district_id) : null,
        region_id: adminInfo.region_id ? Number(adminInfo.region_id) : null,
        const_no: constNo,
        metadata: {
          ...constituency.metadata,
          ...editDemographics,
          phase: adminInfo.phase,
          population: toOptionalNumber(editDemographics.population),
          literacy_pct: toOptionalNumber(editDemographics.literacy_pct),
          urban_pct: toOptionalNumber(editDemographics.urban_pct),
          sc_st_pct: toOptionalNumber(editDemographics.sc_st_pct),
        },
      });
      toast('Constituency updated');
      loadData();
      return true;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Update failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    constituency, election: constituency?.election, districts, regions,
    loading, saving, isDirty, fieldErrors,
    editDemographics, setEditDemographics, adminInfo, setAdminInfo,
    handleSave, addTag, removeTag, markDirty, refresh: loadData
  };
}
```

- [ ] **Step 5: Edit `admin/src/hooks/useCandidateEdit.ts`.** First, add the import below the existing imports:

```ts
import { toOptionalNumber } from '../utils/numbers';
```

Next, replace the form state with:

```ts
  // Form State (the photo belongs to the linked person; it is shown read-only, never sent here)
  const [form, setForm] = useState({
    name: '',
    party_id: '',
    age: '' as string | number,
    gender: '',
    education: '',
    criminal_cases: '' as string | number,
    assets: ''
  });
```

In `loadData`, replace the `setForm({...})` call with:

```ts
      setForm({
        name: c.name || '',
        party_id: c.party_id || '',
        age: meta.age ?? '',
        gender: meta.gender ?? '',
        education: meta.education ?? '',
        criminal_cases: meta.criminal_cases ?? '',
        assets: meta.assets ?? ''
      });
```

In `handleSave`, replace the `metadata: { ... }` object with:

```ts
        metadata: {
          // Keep keys this form does not edit (e.g. affidavit links from the seed).
          ...(candidate?.metadata ?? {}),
          age: toOptionalNumber(form.age),
          gender: form.gender,
          education: form.education,
          criminal_cases: toOptionalNumber(form.criminal_cases),
          assets: form.assets
        }
```

- [ ] **Step 6: Keep the old candidate pages compiling. Task 12 deletes them.**

In `admin/src/pages/CandidateEdit.tsx`:
- delete the `<ErrorBoundary><MediaForm form={form} setForm={editor.setForm} /></ErrorBoundary>` block, i.e. the three lines starting `<ErrorBoundary>` / `<MediaForm` / `</ErrorBoundary>`
- delete the `MediaFormProps` interface and the `MediaForm` function

In `admin/src/pages/CandidateDetail.tsx`, replace both occurrences of `form.photo_url` with `candidate.person?.photo_url`:

```tsx
                  {candidate.person?.photo_url ? (
                    <img src={candidate.person.photo_url} alt="" style={styles.heroImg} />
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/utils/numbers.test.ts src/hooks/useConstituencyEditor.test.tsx src/hooks/useCandidateEdit.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 8: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. `tsc` reports no unused `MediaForm` and no `photo_url` on the form type.

- [ ] **Step 9: Commit**

```bash
git add admin/src/utils/numbers.ts admin/src/utils/numbers.test.ts admin/src/hooks/useConstituencyEditor.ts admin/src/hooks/useConstituencyEditor.test.tsx admin/src/hooks/useCandidateEdit.ts admin/src/hooks/useCandidateEdit.test.tsx admin/src/pages/CandidateEdit.tsx admin/src/pages/CandidateDetail.tsx
git commit -m "admin: keep 0 in numeric fields, guard seat number, drop dead candidate photo field

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Form primitives (Input, Select, Textarea, Field, FormSection, Combobox)

**Files:**
- Create: `admin/src/components/ui/Input.tsx`, `admin/src/components/ui/Field.tsx`, `admin/src/components/ui/Combobox.tsx`
- Test: `admin/src/components/ui/form.test.tsx`

`components/ui` is already in `@source`.

**Interfaces:**
- Consumes: `cn` (`components/ui/cn.ts`).
- Produces:
  - `<Input invalid? …InputHTMLAttributes>`, `<Select invalid? …SelectHTMLAttributes>` (a native `<select>`), `<Textarea invalid? rows=4 …>`. All three forward refs, set `aria-invalid` when `invalid`, and are 36px high (Textarea grows with its rows).
  - `<Field label error? hint? className?>{control}</Field>`: an implicit `<label>` around the label text and a single control, then `<p role="alert">` with the error.
  - `<FormSection title>{…}</FormSection>`: a small muted section title with a top divider (except the first).
  - `<Combobox label options value onChange placeholder? emptyText? className?>`, where `ComboOption = { value: string; label: string; hint?: string }`. Typing filters (case-insensitive, max 100 shown). ↑/↓ moves, Enter picks, Esc closes the list. The input has `role="combobox"`, `aria-expanded`, and `aria-label={label}`.

- [ ] **Step 1: Write the failing test** `admin/src/components/ui/form.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Input, Select, Textarea } from './Input';
import { Field, FormSection } from './Field';
import { Combobox } from './Combobox';

afterEach(cleanup);

describe('form primitives', () => {
  it('Field labels its control and shows the error inline', () => {
    render(<Field label="Name" error="Name is required"><Input invalid defaultValue="" /></Field>);
    const input = screen.getByLabelText('Name');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Name is required');
  });

  it('Select and Textarea are labelled by Field and fire change', () => {
    const onChange = vi.fn();
    render(
      <FormSection title="Details">
        <Field label="Gender"><Select value="" onChange={onChange}><option value="">Not specified</option><option value="Male">Male</option></Select></Field>
        <Field label="Bio"><Textarea defaultValue="x" /></Field>
      </FormSection>,
    );
    expect(screen.getByRole('heading', { name: 'Details' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Male' } });
    expect(onChange).toHaveBeenCalled();
    expect((screen.getByLabelText('Bio') as HTMLTextAreaElement).rows).toBe(4);
  });

  it('Combobox shows the selected label, filters by typing and picks with Enter', () => {
    const onChange = vi.fn();
    render(
      <Combobox label="Seat" value="a" onChange={onChange}
        options={[{ value: 'a', label: '1 Valmiki Nagar' }, { value: 'b', label: '142 Patna Sahib', hint: 'GEN' }]} />,
    );
    const input = screen.getByRole('combobox', { name: 'Seat' }) as HTMLInputElement;
    expect(input.value).toBe('1 Valmiki Nagar');
    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    fireEvent.change(input, { target: { value: 'patna' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('b');
    expect(input.getAttribute('aria-expanded')).toBe('false');
  });

  it('Combobox Esc closes the list without picking', () => {
    const onChange = vi.fn();
    render(<Combobox label="Seat" value="a" onChange={onChange} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />);
    const input = screen.getByRole('combobox', { name: 'Seat' });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input.getAttribute('aria-expanded')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/components/ui/form.test.tsx`
Expected: FAIL with "Failed to resolve import './Input'".

- [ ] **Step 3: Create `admin/src/components/ui/Input.tsx`**

```tsx
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

const CONTROL =
  'w-full rounded-control border bg-card px-3 text-sm text-ink placeholder:text-muted ' +
  'focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-subtle disabled:text-muted';
const edge = (invalid?: boolean) => (invalid ? 'border-bad' : 'border-line');

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> { invalid?: boolean }
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...props }, ref) {
  return <input ref={ref} aria-invalid={invalid || undefined} className={cn(CONTROL, 'h-9', edge(invalid), className)} {...props} />;
});

/** Native <select>: keyboard + screen-reader behaviour for free, and testable with fireEvent.change. */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> { invalid?: boolean }
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ invalid, className, children, ...props }, ref) {
  return (
    <select ref={ref} aria-invalid={invalid || undefined} className={cn(CONTROL, 'h-9 pr-8', edge(invalid), className)} {...props}>
      {children}
    </select>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { invalid?: boolean }
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} aria-invalid={invalid || undefined} className={cn(CONTROL, 'py-2 leading-relaxed', edge(invalid), className)} {...props} />;
});
```

- [ ] **Step 4: Create `admin/src/components/ui/Field.tsx`**

```tsx
import type { ReactNode } from 'react';
import { cn } from './cn';

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  /** Exactly one control: the label wraps it (implicit association). */
  children: ReactNode;
}

/** Label + one control, with the field's error underneath. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-ink-2">{label}</span>
        {children}
      </label>
      {hint && !error && <p className="text-[11px] text-muted">{hint}</p>}
      {error && <p role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
}

/** A titled group of fields inside a panel. */
export function FormSection({ title, className, children }: { title: string; className?: string; children: ReactNode }) {
  return (
    <section className={cn('space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0', className)}>
      <h3 className="text-xs font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}
```

- [ ] **Step 5: Create `admin/src/components/ui/Combobox.tsx`**

```tsx
import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from './cn';

export interface ComboOption { value: string; label: string; hint?: string }

interface ComboboxProps {
  label: string;
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

const MAX_SHOWN = 100;

/** Searchable single select (no portal): type to filter, ↑/↓ to move, Enter to pick, Esc to close the list. */
export function Combobox({ label, options, value, onChange, placeholder, emptyText = 'No matches', className }: ComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const selected = options.find((o) => o.value === value);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options).slice(0, MAX_SHOWN);
  }, [options, query]);

  const close = () => { setOpen(false); setQuery(''); };
  const pick = (o: ComboOption) => { onChange(o.value); close(); };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); pick(matches[active]); }
    else if (e.key === 'Escape' && open) { e.preventDefault(); close(); }
  };

  return (
    <div className={cn('relative', className)}>
      <input
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={open ? query : selected?.label ?? ''}
        placeholder={open ? selected?.label ?? placeholder : placeholder}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
        onBlur={close}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-control border border-line bg-card pl-3 pr-8 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
      <ChevronDown size={14} aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted" />
      {open && (
        <ul id={listId} role="listbox" aria-label={label} className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-card border border-line bg-card p-1 shadow-lg">
          {matches.length === 0 && <li className="px-2.5 py-1.5 text-xs text-muted">{emptyText}</li>}
          {matches.map((o, i) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              // mousedown (not click) runs before the input's blur closes the list
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-1.5 text-xs text-ink', i === active && 'bg-accent-soft')}
            >
              <span className="truncate">{o.label}</span>
              {o.hint && <span className="shrink-0 text-muted">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/components/ui/form.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 7: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add admin/src/components/ui/Input.tsx admin/src/components/ui/Field.tsx admin/src/components/ui/Combobox.tsx admin/src/components/ui/form.test.tsx
git commit -m "admin: form primitives (Input, Select, Textarea, Field, Combobox)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: List primitives (PageHeader, Toolbar, SearchInput, ChipGroup, DataTable, Pager, EmptyState)

**Files:**
- Create: `admin/src/components/ui/PageHeader.tsx`, `Toolbar.tsx`, `DataTable.tsx`, `Pager.tsx`, `EmptyState.tsx`
- Test: `admin/src/components/ui/list.test.tsx`

**Interfaces:**
- Consumes: `cn`, `Button` (`components/ui/Button.tsx`, with variants `primary|success|outline|ghost|danger` and sizes `sm|md`).
- Produces:
  - `<PageHeader title count? subtitle? actions?>`: an `h1`, plus a count pill formatted `en-IN`.
  - `<Toolbar>{…}</Toolbar>`, a card row that wraps.
  - `<SearchInput value onChange label placeholder? className?>`, a `type="search"` input labelled by a screen-reader-only label.
  - `<ChipGroup<V> label options value onChange>`, where `ChipOption<V> = { value: V; label: string; count?: number }`. Each chip is a button with `aria-pressed`.
  - `<DataTable<T> label columns rows rowKey selectedKey? onRowClick? loading? empty? footer?>`, where `Column<T> = { key; header; cell(row); className?; headerClassName? }`. It renders:
    - a `<table aria-label={label}>`
    - a sticky `thead`
    - row hover
    - the selected row with `aria-selected="true"`, an accent background and an accent left edge
    - Enter on a focused row, which calls `onRowClick`
    - `empty` when there are no rows and it is not loading
  - `<Pager page totalPages total pageSize noun onPage note?>`: "Showing 1–25 of 312 parties", Previous / "Page x of y" / Next.
  - `<EmptyState icon? title description? action?>`.

- [ ] **Step 1: Write the failing test** `admin/src/components/ui/list.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DataTable, type Column } from './DataTable';
import { Pager } from './Pager';
import { ChipGroup } from './Toolbar';
import { PageHeader } from './PageHeader';
import { EmptyState } from './EmptyState';

afterEach(cleanup);

type Row = { id: string; name: string };
const COLS: Column<Row>[] = [{ key: 'name', header: 'Name', cell: (r) => r.name }];

describe('DataTable', () => {
  it('renders sentence-case headers and rows, clicks and Enter open a row, the selected row is marked', () => {
    const onRowClick = vi.fn();
    render(<DataTable label="Parties" columns={COLS} rows={[{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }]} rowKey={(r) => r.id} selectedKey="b" onRowClick={onRowClick} />);
    const table = screen.getByRole('table', { name: 'Parties' });
    expect(within(table).getByRole('columnheader', { name: 'Name' })).toBeTruthy();
    fireEvent.click(screen.getByText('Alpha'));
    expect(onRowClick).toHaveBeenCalledWith({ id: 'a', name: 'Alpha' });
    const beta = screen.getByText('Beta').closest('tr')!;
    expect(beta.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(beta, { key: 'Enter' });
    expect(onRowClick).toHaveBeenLastCalledWith({ id: 'b', name: 'Beta' });
  });

  it('shows the empty state when there are no rows', () => {
    render(<DataTable label="Parties" columns={COLS} rows={[]} rowKey={(r) => r.id} empty={<EmptyState title="No parties match" />} />);
    expect(screen.getByText('No parties match')).toBeTruthy();
  });
});

describe('Pager', () => {
  it('shows the range and disables Previous on page 1', () => {
    const onPage = vi.fn();
    render(<Pager page={1} totalPages={13} total={312} pageSize={25} noun="parties" onPage={onPage} />);
    expect(screen.getByText('Showing 1–25 of 312 parties')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onPage).toHaveBeenCalledWith(2);
  });
});

describe('ChipGroup and PageHeader', () => {
  it('marks the active chip and reports changes', () => {
    const onChange = vi.fn();
    render(<ChipGroup label="Person link" value="all" onChange={onChange} options={[{ value: 'all', label: 'All', count: 3 }, { value: 'linked', label: 'Linked', count: 1 }]} />);
    expect(screen.getByRole('button', { name: /^All/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /^Linked/ }));
    expect(onChange).toHaveBeenCalledWith('linked');
  });

  it('PageHeader shows the title and an en-IN count', () => {
    render(<PageHeader title="Candidates" count={1204} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Candidates' })).toBeTruthy();
    expect(screen.getByText('1,204')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/components/ui/list.test.tsx`
Expected: FAIL with "Failed to resolve import './DataTable'".

- [ ] **Step 3: Create `admin/src/components/ui/PageHeader.tsx`**

```tsx
import type { ReactNode } from 'react';

export function PageHeader({ title, count, subtitle, actions }: { title: string; count?: number; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {count !== undefined && (
          <span className="rounded-full border border-line bg-subtle px-2.5 py-0.5 text-xs font-medium tabular-nums text-ink-2">{count.toLocaleString('en-IN')}</span>
        )}
        {subtitle && <p className="truncate text-xs text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 4: Create `admin/src/components/ui/Toolbar.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from './cn';

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-card p-3 shadow-sm">{children}</div>;
}

interface SearchInputProps { value: string; onChange: (v: string) => void; label: string; placeholder?: string; className?: string }

export function SearchInput({ value, onChange, label, placeholder, className }: SearchInputProps) {
  return (
    <label className={cn('relative block min-w-56 flex-1', className)}>
      <span className="sr-only">{label}</span>
      <Search size={14} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-control border border-line bg-card pl-8 pr-3 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </label>
  );
}

export interface ChipOption<V extends string> { value: V; label: string; count?: number }

export function ChipGroup<V extends string>({ label, options, value, onChange }: { label: string; options: ChipOption<V>[]; value: V; onChange: (v: V) => void }) {
  return (
    <div role="group" aria-label={label} className="flex shrink-0 items-center rounded-control border border-line bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-control px-3 py-1 text-xs font-medium whitespace-nowrap', o.value === value ? 'bg-accent text-white' : 'text-ink-2 hover:text-ink')}
        >
          {o.label}
          {o.count !== undefined && <span className="ml-1 tabular-nums opacity-80">{o.count.toLocaleString('en-IN')}</span>}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `admin/src/components/ui/DataTable.tsx`**

```tsx
import type { KeyboardEvent, ReactNode } from 'react';
import { cn } from './cn';

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  label: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  selectedKey?: string | null;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
}

/** One table style for every entity page: sticky header, hover, selected row, empty state. Scrolls inside its card. */
export function DataTable<T>({ label, columns, rows, rowKey, selectedKey, onRowClick, loading, empty, footer }: DataTableProps<T>) {
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (e.key === 'Enter' && e.target === e.currentTarget) { e.preventDefault(); onRowClick?.(row); }
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-card shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto">
        <table aria-label={label} aria-busy={loading || undefined} className="w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 z-10 bg-subtle">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cn('border-b border-line px-4 py-2.5 text-xs font-medium text-ink-2', c.headerClassName)}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const k = rowKey(row);
              const selected = k === selectedKey;
              return (
                <tr
                  key={k}
                  aria-selected={selected}
                  tabIndex={onRowClick ? 0 : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => onKey(e, row) : undefined}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent',
                    selected && 'bg-accent-soft shadow-[inset_4px_0_0_var(--color-accent)] hover:bg-accent-soft',
                  )}
                >
                  {columns.map((c) => <td key={c.key} className={cn('px-4 py-2.5 text-ink', c.className)}>{c.cell(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <div className="p-6">{empty ?? <p className="text-center text-sm text-muted">Nothing to show.</p>}</div>}
        {loading && rows.length === 0 && <p className="p-10 text-center text-sm text-muted">Loading…</p>}
      </div>
      {footer && <div className="border-t border-line">{footer}</div>}
    </div>
  );
}
```

- [ ] **Step 6: Create `admin/src/components/ui/Pager.tsx`**

```tsx
import { Button } from './Button';

interface PagerProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Plural noun for the range text, e.g. "parties". */
  noun: string;
  onPage: (page: number) => void;
  /** Extra text after the range, e.g. "district filter applies to this page". */
  note?: string;
}

export function Pager({ page, totalPages, total, pageSize, noun, onPage, note }: PagerProps) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const fmt = (n: number) => n.toLocaleString('en-IN');
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-xs text-ink-2">
      <span className="tabular-nums">Showing {fmt(from)}–{fmt(to)} of {fmt(total)} {noun}{note ? ` · ${note}` : ''}</span>
      <div className="flex items-center gap-1.5">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <span className="px-1 tabular-nums">Page {page} of {totalPages}</span>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `admin/src/components/ui/EmptyState.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, title, description, action }: { icon?: LucideIcon; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2 py-10 text-center">
      {Icon && (
        <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon size={18} aria-hidden />
        </span>
      )}
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {description && <p className="text-xs text-ink-2">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 8: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/components/ui/list.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 9: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add admin/src/components/ui/PageHeader.tsx admin/src/components/ui/Toolbar.tsx admin/src/components/ui/DataTable.tsx admin/src/components/ui/Pager.tsx admin/src/components/ui/EmptyState.tsx admin/src/components/ui/list.test.tsx
git commit -m "admin: list primitives (page header, toolbar, table, pager, empty state)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Sheet (non-modal right panel) and ConfirmDialog

**Files:**
- Create: `admin/src/components/ui/Sheet.tsx`, `admin/src/components/ui/ConfirmDialog.tsx`
- Test: `admin/src/components/ui/Sheet.test.tsx`

**Interfaces:**
- Consumes: `@radix-ui/react-dialog` (already installed), `Button`, `cn`.
- Produces:
  - `<Sheet open onRequestClose title description? width?='md'|'full' footer? legacyBody? children>`:
    - `md` is `w-[400px] shrink-0` and sits in the page body's flex row.
    - `full` is `absolute inset-0 z-20`, so the page body must be `relative` (`EntityPage` does this).
    - Esc calls `onRequestClose`, except when focus is inside an element with `aria-expanded="true"` (an open combobox list).
    - Outside clicks are ignored.
    - The close button has `aria-label="Close panel"`.
    - `legacyBody` puts `tw-ui` on the header and footer only.
  - `<ConfirmDialog open title description confirmLabel tone?='danger'|'primary' busy? onConfirm onCancel>`, a **modal** Radix Dialog in a portal with `tw-ui`. Esc and Cancel call `onCancel`.

- [ ] **Step 1: Write the failing test** `admin/src/components/ui/Sheet.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from './Sheet';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

function Page({ onRequestClose, open = true }: { onRequestClose: () => void; open?: boolean }) {
  return (
    <div className="relative flex">
      <button type="button">Row in the table</button>
      <Sheet open={open} onRequestClose={onRequestClose} title="Bharatiya Janata Party" description="Party · BJP">
        <input aria-label="Name" defaultValue="BJP" />
        <input aria-label="Seat" aria-expanded="true" role="combobox" />
      </Sheet>
    </div>
  );
}

describe('Sheet', () => {
  it('renders in place as a named, non-modal dialog; the table beside it stays usable', () => {
    render(<Page onRequestClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Bharatiya Janata Party' });
    expect(dialog.className).toContain('w-[400px]');
    expect(dialog.className).toContain('tw-ui');
    const row = screen.getByRole('button', { name: 'Row in the table' });
    expect(row.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('a pointer-down outside never asks to close; Esc and the close button do', () => {
    const onRequestClose = vi.fn();
    render(<Page onRequestClose={onRequestClose} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Row in the table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Row in the table' }));
    expect(onRequestClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onRequestClose).toHaveBeenCalledTimes(2);
  });

  it('Esc inside an open combobox only closes that list', () => {
    const onRequestClose = vi.fn();
    render(<Page onRequestClose={onRequestClose} />);
    const seat = screen.getByLabelText('Seat');
    seat.focus();
    fireEvent.keyDown(seat, { key: 'Escape' });
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('renders nothing when closed; legacyBody keeps tw-ui off the body', () => {
    const { rerender } = render(<Page onRequestClose={vi.fn()} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<Sheet open onRequestClose={vi.fn()} title="Manifest" width="full" legacyBody><button className="btn">Legacy</button></Sheet>);
    const dialog = screen.getByRole('dialog', { name: 'Manifest' });
    expect(dialog.className).not.toContain('tw-ui');
    expect(dialog.className).toContain('inset-0');
    expect(screen.getByRole('button', { name: 'Legacy' }).closest('.tw-ui')).toBeNull();
  });
});

describe('ConfirmDialog', () => {
  it('confirms and cancels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Finalize election?" description="This cannot be undone." confirmLabel="Yes, finalize" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Finalize election?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize' }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/components/ui/Sheet.test.tsx`
Expected: FAIL with "Failed to resolve import './Sheet'".

- [ ] **Step 3: Create `admin/src/components/ui/Sheet.tsx`**

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
  /** Only header + footer get the `tw-ui` reset, so legacy `.btn` markup in the body keeps its styles. */
  legacyBody?: boolean;
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
export function Sheet({ open, onRequestClose, title, description, width = 'md', footer, legacyBody, children }: SheetProps) {
  const onEscape = (e: KeyboardEvent) => {
    e.preventDefault();
    // Esc inside an open combobox list closes that list only.
    if ((document.activeElement as HTMLElement | null)?.closest('[aria-expanded="true"]')) return;
    onRequestClose();
  };
  return (
    <Dialog.Root open={open} modal={false}>
      <Dialog.Content
        onEscapeKeyDown={onEscape}
        onInteractOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn('flex flex-col overflow-hidden rounded-card border border-line bg-card shadow-sm', !legacyBody && 'tw-ui', WIDTH[width])}
      >
        <div className={cn('flex items-start justify-between gap-3 border-b border-line px-4 py-3', legacyBody && 'tw-ui')}>
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
          <div className={cn('flex items-center justify-between gap-2 border-t border-line bg-subtle/60 px-4 py-3', legacyBody && 'tw-ui')}>{footer}</div>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Create `admin/src/components/ui/ConfirmDialog.tsx`**

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Modal yes/no for irreversible or live-affecting actions (Go live, Finalize). It sits above any open Sheet. */
export function ConfirmDialog({ open, title, description, confirmLabel, tone = 'danger', busy, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="tw-ui fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content className="tw-ui fixed left-1/2 top-1/2 z-50 w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-card p-6 shadow-lg">
          <Dialog.Title className="text-base font-semibold text-ink">{title}</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-ink-2">{description}</Dialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button variant={tone === 'danger' ? 'danger' : 'primary'} disabled={busy} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/components/ui/Sheet.test.tsx`
Expected: PASS (5 tests), with no "DialogContent requires a DialogTitle" warning in the output.

- [ ] **Step 6: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add admin/src/components/ui/Sheet.tsx admin/src/components/ui/ConfirmDialog.tsx admin/src/components/ui/Sheet.test.tsx
git commit -m "admin: non-modal in-place Sheet (400px / full) and modal ConfirmDialog

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: `useUnsavedGuard` (shared guard) + Live Console refactor + same-section sidebar link

**Files:**
- Create: `admin/src/hooks/useUnsavedGuard.ts`
- Modify: `admin/src/context/ShellStatusContext.tsx`, `admin/src/pages/LiveConsole.tsx`, `admin/src/components/shell/Sidebar.tsx:35`
- Test: `admin/src/hooks/useUnsavedGuard.test.tsx`, plus the prompt-text updates in `admin/src/components/shell/shell.test.tsx` and `admin/src/pages/LiveConsole.test.tsx`

**Interfaces:**
- Consumes: `useShellStatus()` → `{ editorDirty, setEditorDirty }` and `confirmDiscardEdits(dirty)` from `ShellStatusContext`.
- Produces:
  - `useUnsavedGuard(dirty: boolean): void`. It sets the shell's `editorDirty` to `dirty`, adds a `beforeunload` listener while dirty, and resets `editorDirty` to `false` on unmount.
  - `DISCARD_EDITS_PROMPT === 'Discard unsaved changes?'`.

- [ ] **Step 1: Write the failing test** `admin/src/hooks/useUnsavedGuard.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ShellStatusProvider, useShellStatus, DISCARD_EDITS_PROMPT } from '../context/ShellStatusContext';
import { useUnsavedGuard } from './useUnsavedGuard';

afterEach(cleanup);

function Probe() { return <output data-testid="dirty">{String(useShellStatus().editorDirty)}</output>; }
function Guarded({ dirty }: { dirty: boolean }) { useUnsavedGuard(dirty); return null; }
const unload = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };

describe('useUnsavedGuard', () => {
  it('reports dirty to the shell, arms the tab-close warning, and clears both on unmount', () => {
    const { rerender } = render(<ShellStatusProvider><Guarded dirty={false} /><Probe /></ShellStatusProvider>);
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    expect(unload()).toBe(false);
    rerender(<ShellStatusProvider><Guarded dirty /><Probe /></ShellStatusProvider>);
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    expect(unload()).toBe(true);
    rerender(<ShellStatusProvider><Probe /></ShellStatusProvider>);
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    expect(unload()).toBe(false);
  });

  it('uses one generic prompt for seats and records', () => {
    expect(DISCARD_EDITS_PROMPT).toBe('Discard unsaved changes?');
  });
});
```

Add this test to the `Sidebar` describe block in `admin/src/components/shell/shell.test.tsx`:

```tsx
  it('with unsaved edits, the link to the current section asks too (it would close the open record)', () => {
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MemoryRouter initialEntries={['/parties/BJP']}><Sidebar /><Routes><Route path="*" element={<Where />} /></Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: /Parties/ }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(screen.getByTestId('where').textContent).toBe('/parties/BJP');
  });
```

In `shell.test.tsx`, replace both `'Discard unsaved edits for this seat?'` with `'Discard unsaved changes?'`. In `admin/src/pages/LiveConsole.test.tsx`, replace the one `'Discard unsaved edits for this seat?'` with `'Discard unsaved changes?'`.

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/useUnsavedGuard.test.tsx src/components/shell/shell.test.tsx src/pages/LiveConsole.test.tsx`
Expected: FAIL.
- `useUnsavedGuard.test.tsx` fails with "Failed to resolve import './useUnsavedGuard'".
- The shell and Live Console tests fail with `expected "spy" to be called with arguments: [ 'Discard unsaved changes?' ]`.
- The new same-section test fails with `expected "spy" to be called` (`0 calls`).

- [ ] **Step 3: Generalise the prompt in `admin/src/context/ShellStatusContext.tsx`.** Replace the `editorDirty` doc comment and the prompt constant:

```ts
  /** A record panel or the Live Console seat editor has unsaved edits: the shell asks before leaving or switching election. */
  editorDirty: boolean;
```

```ts
export const DISCARD_EDITS_PROMPT = 'Discard unsaved changes?';
```

- [ ] **Step 4: Create `admin/src/hooks/useUnsavedGuard.ts`**

```ts
import { useEffect } from 'react';
import { useShellStatus } from '../context/ShellStatusContext';

/**
 * Unsaved-changes guard for one editor (a record panel or the Live Console seat editor).
 * Reports `dirty` to the shell (sidebar, election picker and ⌘K ask before leaving), arms the browser's
 * tab-close warning while dirty, and clears both on unmount. BrowserRouter has no useBlocker, so the
 * browser Back button is not guarded.
 */
export function useUnsavedGuard(dirty: boolean): void {
  const { setEditorDirty } = useShellStatus();

  useEffect(() => { setEditorDirty(dirty); }, [dirty, setEditorDirty]);
  useEffect(() => () => setEditorDirty(false), [setEditorDirty]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);
}
```

- [ ] **Step 5: Use it in `admin/src/pages/LiveConsole.tsx`.** Replace the imports and the top of the component (everything down to and including the `beforeunload` effect) with the code below. The rest of the file is unchanged.

```tsx
import { useEffect, useRef, useState } from 'react';
import { useLiveConsole } from '../hooks/useLiveConsole';
import { useSeatLock } from '../hooks/useSeatLock';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { useAuth } from '../context/AuthContext';
import { confirmDiscardEdits } from '../context/ShellStatusContext';
import { LiveHeader } from '../components/live/LiveHeader';
import { SeatList } from '../components/live/SeatList';
import { SeatEditor, type SeatEditorHandle } from '../components/live/SeatEditor';
import Spinner from '../components/atoms/Spinner';

const isTypingTarget = (el: Element | null) => !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);
/** Focus is inside an open Radix widget that handles arrow keys itself. */
const inArrowWidget = (el: Element | null) => !!el?.closest('[role=listbox],[role=menu],[role=dialog],[role=combobox]');

/** PAGE: Live Console — split view (seat list | seat editor), keyboard-first. */
export default function LiveConsole() {
  // The seat editor reports unsaved edits here; the guard shares them with the shell and arms tab-close.
  const [editorDirty, setEditorDirty] = useState(false);
  useUnsavedGuard(editorDirty);
  const lc = useLiveConsole({ holdSelection: editorDirty });
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const lock = useSeatLock(lc.electionId, lc.selectedId, myId, lc.selectedId ? lc.locks[lc.selectedId] : undefined);
  const editorRef = useRef<SeatEditorHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const editorBoxRef = useRef<HTMLDivElement>(null);
```

The two effects being removed are `useEffect(() => () => setEditorDirty(false), [setEditorDirty]);` and the `beforeunload` effect. `useUnsavedGuard` now does both. `onDirtyChange={setEditorDirty}` on `<SeatEditor>` stays as it is.

- [ ] **Step 6: Guard the current section's own link in `admin/src/components/shell/Sidebar.tsx`.** Replace the `onClick` line with:

```tsx
                  // BrowserRouter has no useBlocker: ask here before an editor unmounts with unsaved edits.
                  // Compare the exact path: "Parties" while on /parties/BJP closes that record, so it asks too.
                  onClick={(e) => { if (pathname !== path && !confirmDiscardEdits(editorDirty)) e.preventDefault(); }}
```

- [ ] **Step 7: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/hooks/useUnsavedGuard.test.tsx src/components/shell/shell.test.tsx src/pages/LiveConsole.test.tsx`
Expected: PASS. This includes the existing "unsaved edits are reported to the shell and arm the tab-close warning; unmount clears them" Live Console test, which now runs through the hook.

- [ ] **Step 8: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add admin/src/hooks/useUnsavedGuard.ts admin/src/hooks/useUnsavedGuard.test.tsx admin/src/context/ShellStatusContext.tsx admin/src/pages/LiveConsole.tsx admin/src/pages/LiveConsole.test.tsx admin/src/components/shell/Sidebar.tsx admin/src/components/shell/shell.test.tsx
git commit -m "admin: shared useUnsavedGuard, generic discard prompt, guard same-section link

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: `useEntityRoute`, `/x/:id/edit` redirect, `EntityPage` scaffold and test harness

**Files:**
- Create: `admin/src/hooks/useEntityRoute.ts`
- Create: `admin/src/components/routing/EditRedirect.tsx`
- Create: `admin/src/components/entity/EntityPage.tsx`, `admin/src/components/entity/PanelFooter.tsx`, `admin/src/components/entity/NoElection.tsx`
- Create: `admin/src/test-utils/entity-harness.tsx`
- Modify: `admin/src/components/Layout.tsx`, `admin/src/theme/tailwind.css`
- Test: `admin/src/hooks/useEntityRoute.test.tsx`, `admin/src/components/entity/entity.test.tsx`

**Interfaces:**
- Consumes: `confirmDiscardEdits` (Task 7), `Button`, `EmptyState`, `cn`.
- Produces:
  - `NEW_ID = 'new'`.
  - `useEntityRoute(base: string, dirty?: boolean): EntityRoute`, where `EntityRoute = { id: string | null; isNew: boolean; open(id: string, opts?: { force?: boolean }): boolean; close(opts?: { force?: boolean }): boolean }`.
    - `id` comes from `${base}/:id`, decoded. It is `'new'` in create mode and `null` on the bare list.
    - `open` and `close` keep `location.search`.
    - When `dirty` is set and the target differs, `open` and `close` ask `Discard unsaved changes?` and return `false` on cancel. `force` skips the question, for use right after a successful save or create.
  - `<EditRedirect base="/parties" />` sends `/parties/:id/edit?…` to `/parties/:id?…` with `replace`.
  - `<EntityPage header toolbar? table panel?>`:
    - The page body is `relative flex`.
    - `tw-ui` goes on the header and on the list column only.
    - The panel is the right column, or it covers the body when the Sheet is `full`.
  - `<PanelFooter dirty saving canSave? onCancel onSave saveLabel?='Save changes' extra?>`:
    - The left side shows "Unsaved changes" or "No changes".
    - Cancel and Save are both disabled while the panel is clean or saving. Save is also disabled when `canSave` is false.
  - `<NoElection error? />` is the empty state shown when no election is selected. Its action is "Create an election" → `/elections/new`.
  - `renderEntityPage(base, page, at)` and `<Where />` (test harness):
    - mount `page` at `${base}/*` plus `${base}/:id/edit` → `EditRedirect`, the same way as `App.tsx`
    - wrap it in `ToastProvider` + `ShellStatusProvider`
    - `<Where/>` prints `pathname + search` in `data-testid="where"`
  - `Layout.tsx` gets `BARE_PATHS: string[]`. Each page task appends its path.

- [ ] **Step 1: Write the failing tests.** `admin/src/hooks/useEntityRoute.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useEntityRoute, NEW_ID } from './useEntityRoute';
import { EditRedirect } from '../components/routing/EditRedirect';
import { Where } from '../test-utils/entity-harness';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Probe({ dirty = false }: { dirty?: boolean }) {
  const r = useEntityRoute('/parties', dirty);
  return (
    <>
      <output data-testid="id">{String(r.id)}</output>
      <output data-testid="new">{String(r.isNew)}</output>
      <button type="button" onClick={() => r.open('BJP')}>open BJP</button>
      <button type="button" onClick={() => r.open('A B')}>open spaced</button>
      <button type="button" onClick={() => r.open('INC', { force: true })}>force INC</button>
      <button type="button" onClick={() => r.open(NEW_ID)}>new</button>
      <button type="button" onClick={() => r.close()}>close</button>
    </>
  );
}

function renderAt(at: string, dirty = false) {
  return render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route path="/parties/:id/edit" element={<EditRedirect base="/parties" />} />
        <Route path="/parties/*" element={<Probe dirty={dirty} />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}
const where = () => screen.getByTestId('where').textContent;

describe('useEntityRoute', () => {
  it('reads the id and opens/closes records keeping the query string', () => {
    renderAt('/parties?election=e1');
    expect(screen.getByTestId('id').textContent).toBe('null');
    fireEvent.click(screen.getByText('open BJP'));
    expect(where()).toBe('/parties/BJP?election=e1');
    expect(screen.getByTestId('id').textContent).toBe('BJP');
    fireEvent.click(screen.getByText('close'));
    expect(where()).toBe('/parties?election=e1');
  });

  it('encodes and decodes ids, and knows create mode', () => {
    renderAt('/parties');
    fireEvent.click(screen.getByText('open spaced'));
    expect(where()).toBe('/parties/A%20B');
    expect(screen.getByTestId('id').textContent).toBe('A B');
    fireEvent.click(screen.getByText('new'));
    expect(screen.getByTestId('new').textContent).toBe('true');
  });

  it('with unsaved edits, asks before opening another record or closing; force skips the question', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/parties/BJP?election=e1', true);
    fireEvent.click(screen.getByText('open BJP'));
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('new'));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/parties/BJP?election=e1');
    fireEvent.click(screen.getByText('close'));
    expect(where()).toBe('/parties/BJP?election=e1');
    fireEvent.click(screen.getByText('force INC'));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toBe('/parties/INC?election=e1');
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('close'));
    expect(where()).toBe('/parties?election=e1');
  });

  it('old /:id/edit links redirect to the panel URL, keeping the query', () => {
    renderAt('/parties/JD(U)/edit?election=e1');
    expect(where()).toBe('/parties/JD(U)?election=e1');
    expect(screen.getByTestId('id').textContent).toBe('JD(U)');
  });
});
```

`admin/src/components/entity/entity.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EntityPage } from './EntityPage';
import { PanelFooter } from './PanelFooter';
import { NoElection } from './NoElection';

afterEach(cleanup);

describe('entity scaffold', () => {
  it('EntityPage puts tw-ui on the header and list column, not on the root', () => {
    const { container } = render(<EntityPage header={<h1>Parties</h1>} toolbar={<div>tools</div>} table={<div>table</div>} panel={<aside>panel</aside>} />);
    expect((container.firstElementChild as HTMLElement).className).not.toContain('tw-ui');
    expect(screen.getByRole('heading', { name: 'Parties' }).closest('.tw-ui')).not.toBeNull();
    expect(screen.getByText('table').closest('.tw-ui')).not.toBeNull();
    expect(screen.getByText('panel').closest('.tw-ui')).toBeNull();
  });

  it('PanelFooter shows unsaved state and only enables actions when dirty', () => {
    const onSave = vi.fn();
    const { rerender } = render(<PanelFooter dirty={false} saving={false} onCancel={vi.fn()} onSave={onSave} />);
    expect(screen.getByText('No changes')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<PanelFooter dirty saving={false} onCancel={vi.fn()} onSave={onSave} />);
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onSave).toHaveBeenCalled();
    rerender(<PanelFooter dirty saving={false} canSave={false} onCancel={vi.fn()} onSave={onSave} />);
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('NoElection links to creating an election', () => {
    render(<MemoryRouter><NoElection /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Create an election' }).getAttribute('href')).toBe('/elections/new');
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/useEntityRoute.test.tsx src/components/entity/entity.test.tsx`
Expected: FAIL with "Failed to resolve import './useEntityRoute'" and "Failed to resolve import './EntityPage'".

- [ ] **Step 3: Create `admin/src/hooks/useEntityRoute.ts`**

```ts
import { useCallback, useMemo } from 'react';
import { matchPath, useLocation, useNavigate } from 'react-router-dom';
import { confirmDiscardEdits } from '../context/ShellStatusContext';

/** Route id for create mode: `/parties/new`. */
export const NEW_ID = 'new';

export interface EntityRoute {
  /** Record id from `${base}/:id` ('new' in create mode), or null on the bare list. */
  id: string | null;
  isNew: boolean;
  /** Open a record (or NEW_ID). Asks first when dirty and the id changes; false if the user cancelled. */
  open: (id: string, opts?: { force?: boolean }) => boolean;
  /** Back to the list. Asks first when dirty; false if the user cancelled. */
  close: (opts?: { force?: boolean }) => boolean;
}

const safeDecode = (s: string) => { try { return decodeURIComponent(s); } catch { return s; } };

/**
 * `/x` = list, `/x/:id` = list + panel. Mount the page at `x/*` so it stays mounted while records change.
 * Navigation keeps the query string (`?election=` …).
 */
export function useEntityRoute(base: string, dirty = false): EntityRoute {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const raw = matchPath({ path: `${base}/:id`, end: true }, pathname)?.params.id;
  const id = raw ? safeDecode(raw) : null;

  const open = useCallback((next: string, opts?: { force?: boolean }) => {
    if (next === id) return true;
    if (!opts?.force && !confirmDiscardEdits(dirty)) return false;
    navigate(`${base}/${encodeURIComponent(next)}${search}`);
    return true;
  }, [id, dirty, navigate, base, search]);

  const close = useCallback((opts?: { force?: boolean }) => {
    if (!opts?.force && !confirmDiscardEdits(dirty)) return false;
    navigate(`${base}${search}`);
    return true;
  }, [dirty, navigate, base, search]);

  return useMemo(() => ({ id, isNew: id === NEW_ID, open, close }), [id, open, close]);
}
```

- [ ] **Step 4: Create `admin/src/components/routing/EditRedirect.tsx`**

```tsx
import { Navigate, useLocation, useParams } from 'react-router-dom';

/** Old `/x/:id/edit` links: the panel at `/x/:id` is now both view and edit. */
export function EditRedirect({ base }: { base: string }) {
  const { id = '' } = useParams<{ id: string }>();
  const { search } = useLocation();
  return <Navigate to={`${base}/${encodeURIComponent(id)}${search}`} replace />;
}
```

- [ ] **Step 5: Create `admin/src/components/entity/EntityPage.tsx`**

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
 * `tw-ui` sits on the header and list column only — Sheets carry their own, and a `legacyBody` Sheet
 * (manifest editor) must not inherit it.
 */
export function EntityPage({ header, toolbar, table, panel }: EntityPageProps) {
  return (
    <div className="flex h-full flex-col gap-4 bg-page p-6 font-sans text-ink">
      <div className="tw-ui">{header}</div>
      <div className="relative flex min-h-0 flex-1 gap-4">
        <div className="tw-ui flex min-w-0 flex-1 flex-col gap-3">
          {toolbar}
          {table}
        </div>
        {panel}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Create `admin/src/components/entity/PanelFooter.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';

interface PanelFooterProps {
  dirty: boolean;
  saving: boolean;
  /** Extra condition for Save (e.g. required fields filled). */
  canSave?: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveLabel?: string;
  extra?: ReactNode;
}

export function PanelFooter({ dirty, saving, canSave = true, onCancel, onSave, saveLabel = 'Save changes', extra }: PanelFooterProps) {
  return (
    <>
      <span className={cn('flex items-center gap-1.5 text-xs font-medium', dirty ? 'text-warn-text' : 'text-muted')}>
        {dirty && <span className="h-2 w-2 rounded-full bg-warn" aria-hidden />}
        {dirty ? 'Unsaved changes' : 'No changes'}
      </span>
      <div className="flex items-center gap-2">
        {extra}
        <Button size="sm" variant="outline" disabled={!dirty || saving} onClick={onCancel}>Cancel</Button>
        <Button size="sm" variant="primary" disabled={!dirty || !canSave || saving} onClick={onSave}>{saving ? 'Saving…' : saveLabel}</Button>
      </div>
    </>
  );
}
```

- [ ] **Step 7: Create `admin/src/components/entity/NoElection.tsx`**

```tsx
import { Link } from 'react-router-dom';
import { Vote } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';

/** The one "no election" state for pages that need the global election (spec §1). */
export function NoElection({ error }: { error?: string | null }) {
  if (error) return <EmptyState title="Could not load elections" description="Check the connection and reload." />;
  return (
    <EmptyState
      icon={Vote}
      title="No election yet"
      description="Seats and candidates belong to an election. Create one first."
      action={
        <Link to="/elections/new" className="inline-flex h-9 items-center rounded-control bg-accent px-4 text-sm font-medium text-white hover:bg-accent-hover">
          Create an election
        </Link>
      }
    />
  );
}
```

- [ ] **Step 8: Create `admin/src/test-utils/entity-harness.tsx`**

```tsx
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { EditRedirect } from '../components/routing/EditRedirect';

/** Prints the current path + query (data-testid="where"). */
export function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

/** Mounts an entity page exactly like App.tsx: `${base}/*` plus the `${base}/:id/edit` redirect. */
export function renderEntityPage(base: string, page: ReactElement, at: string) {
  const seg = base.replace(/^\//, '');
  return render(
    <ToastProvider>
      <ShellStatusProvider>
        <MemoryRouter initialEntries={[at]}>
          <Routes>
            <Route path={`${seg}/:id/edit`} element={<EditRedirect base={base} />} />
            <Route path={`${seg}/*`} element={page} />
          </Routes>
          <Where />
        </MemoryRouter>
      </ShellStatusProvider>
    </ToastProvider>,
  );
}
```

- [ ] **Step 9: Make the bare-path check a list in `admin/src/components/Layout.tsx`.** Replace the file with:

```tsx
import { Outlet, useLocation } from 'react-router-dom';
import { ElectionProvider } from '../context/ElectionContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { Sidebar } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';

/** Rebuilt pages manage their own padding and scrolling; legacy pages keep `.admin-content` until they migrate. */
const BARE_PATHS = ['/overrides'];
const isBare = (pathname: string) => BARE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** VIEW: admin shell — grouped sidebar, top bar with global election picker, page outlet. */
export default function Layout() {
  const bare = isBare(useLocation().pathname);
  return (
    <ElectionProvider>
      <ShellStatusProvider>
        <div className="flex h-screen bg-page font-sans text-ink">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className={bare ? 'min-h-0 flex-1 overflow-hidden' : 'admin-content min-h-0 max-h-none flex-1 overflow-y-auto'}>
              <Outlet />
            </main>
          </div>
        </div>
      </ShellStatusProvider>
    </ElectionProvider>
  );
}
```

- [ ] **Step 10: Add the `@source` line to `admin/src/theme/tailwind.css`.** Add this line after `@source "../components/Layout.tsx";`:

```css
@source "../components/entity";
```

- [ ] **Step 11: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/hooks/useEntityRoute.test.tsx src/components/entity/entity.test.tsx`
Expected: PASS (7 tests).

- [ ] **Step 12: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS, and the Live Console still renders bare.

- [ ] **Step 13: Commit**

```bash
git add admin/src/hooks/useEntityRoute.ts admin/src/hooks/useEntityRoute.test.tsx admin/src/components/routing admin/src/components/entity admin/src/test-utils admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: entity route hook, /:id/edit redirect, entity page scaffold, test harness

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Parties page (template for the pattern)

**Files:**
- Create: `admin/src/pages/Parties.tsx`
- Create: `admin/src/components/entity/parties/PartyPanel.tsx`, `PartyCreatePanel.tsx`, `SymbolField.tsx`, `ColourField.tsx`
- Modify: `admin/src/hooks/usePartyEdit.ts` (dirty snapshot, reset), `admin/src/hooks/usePartyManager.ts` (`handleCreate` returns the party)
- Modify: `admin/src/App.tsx`, `admin/src/components/Layout.tsx`, `admin/src/theme/tailwind.css`
- Delete: `admin/src/pages/PartyManager.tsx`, `admin/src/pages/PartyDetail.tsx`, `admin/src/pages/PartyEdit.tsx`
- Test: `admin/src/hooks/usePartyEdit.test.tsx`, `admin/src/pages/Parties.test.tsx`

**Interfaces:**
- Consumes:
  - from Task 1: `useResourceList` (via `usePartyManager`)
  - from Tasks 4–6: `Field`, `FormSection`, `Input`, `Textarea`, `Select`, `PageHeader`, `Toolbar`, `SearchInput`, `DataTable`, `Column`, `Pager`, `EmptyState`, `Sheet`
  - from Task 7: `useUnsavedGuard`
  - from Task 8: `useEntityRoute`, `NEW_ID`, `EntityPage`, `PanelFooter`, `EditRedirect`, `renderEntityPage`
  - `Badge`, `Button` (Phase 1)
- Produces:
  - `usePartyEdit(id?)` returns `{ fieldErrors, party, loading, saving, form, setForm, dirty, reset, handleSave, refresh }`. `PartyForm` is exported. `loading` starts `true` when `id` is given.
  - `usePartyManager().handleCreate(data): Promise<Party | null>`.
  - `<PartyPanel id candidateCount? onClose onSaved />` and `<PartyCreatePanel saving onCreate(data: NewParty) onClose />`, where `NewParty = { id: string; name: string; color: string; abbreviation?: string }`.
  - `<ColourField value error? onChange />` and `<SymbolField label url error? onChange />`.

- [ ] **Step 1: Write the failing hook test** `admin/src/hooks/usePartyEdit.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

vi.mock('../services/geo.service', () => ({
  getParty: vi.fn(async () => ({
    id: 'BJP', name: 'Bharatiya Janata Party', color: '#f59e0b', symbol_url: null, eci_symbol_url: null, abbreviation: 'BJP',
    leader_name: null, founded_year: 1980, headquarters: null, website: null, wikipedia_url: null, description: null,
  })),
  updateParty: vi.fn(async () => ({})),
}));
import { usePartyEdit } from './usePartyEdit';
import { updateParty } from '../services/geo.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => vi.clearAllMocks());

describe('usePartyEdit', () => {
  it('starts loading, is clean after load, dirty after an edit, clean again after reset', async () => {
    const { result } = renderHook(() => usePartyEdit('BJP'), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.party?.id).toBe('BJP'));
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setForm({ ...result.current.form, leader_name: 'J P Nadda' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
    expect(result.current.form.leader_name).toBe('');
  });

  it('saves the form with founded_year as a number', async () => {
    const { result } = renderHook(() => usePartyEdit('BJP'), { wrapper });
    await waitFor(() => expect(result.current.party).not.toBeNull());
    act(() => result.current.setForm({ ...result.current.form, founded_year: '1981' }));
    await act(() => result.current.handleSave());
    expect(updateParty).toHaveBeenCalledWith('BJP', expect.objectContaining({ founded_year: 1981, name: 'Bharatiya Janata Party' }));
  });
});
```

- [ ] **Step 2: Write the failing page test** `admin/src/pages/Parties.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Party } from '../types';

const api = vi.hoisted(() => ({
  getPartiesPaginated: vi.fn(),
  getParty: vi.fn(),
  updateParty: vi.fn(async () => ({})),
  createParty: vi.fn(),
  getStates: vi.fn(async () => [{ id: 1, name: 'Bihar', code: 'BR' }]),
}));
vi.mock('../services/geo.service', () => api);
vi.mock('../services/election.service', () => ({ getElections: vi.fn(async () => []) }));
import Parties from './Parties';
import { renderEntityPage } from '../test-utils/entity-harness';

const party = (id: string, name: string, over: Partial<Party> = {}): Party & { candidate_count: number } => ({
  id, name, color: '#f59e0b', symbol_url: null, eci_symbol_url: null, abbreviation: id, leader_name: null, founded_year: 1980,
  headquarters: null, website: null, wikipedia_url: null, description: null, candidate_count: 12, ...over,
});
const ROWS = [party('BJP', 'Bharatiya Janata Party'), party('INC', 'Indian National Congress', { color: '#0ea5e9' })];

beforeEach(() => {
  api.getPartiesPaginated.mockImplementation(async (page: number) => ({
    success: true,
    data: page === 1 ? ROWS : [party('RJD', 'Rashtriya Janata Dal')],
    pagination: { page, limit: 25, total: 26, totalPages: 2 },
  }));
  api.getParty.mockImplementation(async (id: string) => ROWS.find((p) => p.id === id) ?? party(id, `Party ${id}`));
  api.createParty.mockImplementation(async (d: { id: string; name: string }) => party(d.id, d.name));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/parties') => renderEntityPage('/parties', <Parties />, at);
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Parties' });

describe('Parties page', () => {
  it('lists parties with candidate counts and opens a row in the panel at /parties/:id', async () => {
    renderAt();
    expect(await within(table()).findByText('Bharatiya Janata Party')).toBeTruthy();
    expect(within(table()).getAllByText('12')).toHaveLength(2);
    fireEvent.click(within(table()).getByText('Indian National Congress'));
    expect(where()).toBe('/parties/INC');
    const panel = await screen.findByRole('dialog');
    await waitFor(() => expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Indian National Congress'));
    expect(within(panel).getByText('INC · 12 candidates')).toBeTruthy();
  });

  it('saves the edited form and refreshes the list', async () => {
    renderAt('/parties/BJP');
    const panel = await screen.findByRole('dialog');
    fireEvent.change(await within(panel).findByDisplayValue('Bharatiya Janata Party'), { target: { value: 'BJP renamed' } });
    expect(within(panel).getByText('Unsaved changes')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updateParty).toHaveBeenCalledWith('BJP', expect.objectContaining({ name: 'BJP renamed', founded_year: 1980 })));
    await waitFor(() => expect(api.getPartiesPaginated).toHaveBeenCalledTimes(2));
  });

  it('with unsaved edits: another row, Esc and close ask first; cancel keeps the record; an outside click does nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/parties/BJP');
    const panel = await screen.findByRole('dialog');
    fireEvent.change(await within(panel).findByDisplayValue('Bharatiya Janata Party'), { target: { value: 'Edited' } });
    fireEvent.click(within(table()).getByText('Indian National Congress'));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/parties/BJP');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(where()).toBe('/parties/BJP');
    fireEvent.pointerDown(table());
    expect(confirm).toHaveBeenCalledTimes(2);
    expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Edited');
    confirm.mockReturnValue(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Close panel' }));
    expect(where()).toBe('/parties');
  });

  it('switching rows quickly shows the last clicked record (panels are keyed by id)', async () => {
    let releaseBjp!: (p: Party) => void;
    api.getParty.mockImplementationOnce(() => new Promise<Party>((r) => { releaseBjp = r; }));
    renderAt('/parties/BJP');
    fireEvent.click(await within(table()).findByText('Indian National Congress'));
    const panel = await screen.findByRole('dialog');
    await within(panel).findByDisplayValue('Indian National Congress');
    releaseBjp(ROWS[0]);
    await new Promise((r) => setTimeout(r, 0));
    expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Indian National Congress');
  });

  it('a deep link to an unknown party shows "not found" in the panel', async () => {
    api.getParty.mockRejectedValueOnce(new Error('Party not found'));
    renderAt('/parties/NOPE');
    expect(await within(await screen.findByRole('dialog')).findByText('Party not found')).toBeTruthy();
  });

  it('New party opens /parties/new and, once created, shows the new record', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'New party' }));
    expect(where()).toBe('/parties/new');
    const panel = await screen.findByRole('dialog', { name: 'New party' });
    fireEvent.change(within(panel).getByLabelText('ID'), { target: { value: 'aap' } });
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Aam Aadmi Party' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create party' }));
    await waitFor(() => expect(api.createParty).toHaveBeenCalledWith({ id: 'AAP', name: 'Aam Aadmi Party', color: '#3b82f6', abbreviation: undefined }));
    await waitFor(() => expect(where()).toBe('/parties/AAP'));
  });

  it('pages through the list', async () => {
    renderAt();
    await within(table()).findByText('Bharatiya Janata Party');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Rashtriya Janata Dal')).toBeTruthy();
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  });

  it('old /parties/:id/edit links land on the panel, keeping the query', async () => {
    renderAt('/parties/BJP/edit?election=e1');
    expect(where()).toBe('/parties/BJP?election=e1');
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/usePartyEdit.test.tsx src/pages/Parties.test.tsx`
Expected: FAIL.
- `usePartyEdit.test.tsx`: `expected false to be true` (the `loading` check), then `dirty` is `undefined`.
- `Parties.test.tsx`: "Failed to resolve import './Parties'".

- [ ] **Step 4: Rewrite `admin/src/hooks/usePartyEdit.ts`**

```ts
import { useState, useEffect, useCallback } from 'react';
import { getParty, updateParty } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import type { Party } from '../types';

export interface PartyForm {
  name: string;
  color: string;
  symbol_url: string;
  eci_symbol_url: string;
  abbreviation: string;
  leader_name: string;
  founded_year: string | number;
  headquarters: string;
  website: string;
  wikipedia_url: string;
  description: string;
}

const EMPTY_FORM: PartyForm = {
  name: '', color: '', symbol_url: '', eci_symbol_url: '', abbreviation: '', leader_name: '',
  founded_year: '', headquarters: '', website: '', wikipedia_url: '', description: '',
};

const toForm = (data: Party): PartyForm => ({
  name: data.name || '',
  color: data.color || '',
  symbol_url: data.symbol_url || '',
  eci_symbol_url: data.eci_symbol_url || '',
  abbreviation: data.abbreviation || '',
  leader_name: data.leader_name || '',
  founded_year: data.founded_year ?? '',
  headquarters: data.headquarters || '',
  website: data.website || '',
  wikipedia_url: data.wikipedia_url || '',
  description: data.description || '',
});

/**
 * CONTROLLER: Party Edit (MVC)
 * Party identity and branding. `dirty` compares the form with the last loaded/saved snapshot.
 */
export function usePartyEdit(id?: string) {
  const { toast, toastError } = useToast();

  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PartyForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<PartyForm>(EMPTY_FORM);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getParty(id);
      const next = toForm(data);
      setParty(data);
      setForm(next);
      setSaved(next);
    } catch (err) {
      toastError(err, 'Failed to load party data');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!id) return false;
    setSaving(true);
    setFieldErrors({});
    try {
      await updateParty(id, {
        ...form,
        founded_year: form.founded_year ? Number(form.founded_year) : null
      });
      toast('Party profile updated');
      loadData();
      return true;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Update failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  /** Drop unsaved edits (panel Cancel). */
  const reset = () => { setForm(saved); setFieldErrors({}); };

  return {
    fieldErrors,
    party, loading, saving, form, setForm, dirty, reset,
    handleSave, refresh: loadData
  };
}
```

- [ ] **Step 5: Return the created party from `usePartyManager.handleCreate`.** In `admin/src/hooks/usePartyManager.ts`, change the type import to `import type { Election, Party, State } from '../types';` and replace `handleCreate` with:

```ts
  /** Creates the party and returns it (the page then opens /parties/:id), or null on failure. */
  const handleCreate = async (data: Parameters<typeof createParty>[0]): Promise<Party | null> => {
    setSaving(true);
    try {
      const created = await createParty(data);
      toast('Party registered successfully');
      list.refresh();
      return created;
    } catch (err) {
      toastError(err, 'Registration failed');
      return null;
    } finally {
      setSaving(false);
    }
  };
```

- [ ] **Step 6: Create `admin/src/components/entity/parties/ColourField.tsx`**

```tsx
import { Input } from '../../ui/Input';

const HEX = /^#[0-9a-f]{6}$/i;

/** Colour picker + hex text, kept in sync. The picker needs a valid #rrggbb, so it falls back to slate. */
export function ColourField({ value, error, onChange }: { value: string; error?: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <span className="mb-1 block text-xs font-medium text-ink-2">Colour</span>
      <div className="flex gap-2">
        <input
          type="color"
          aria-label="Colour picker"
          value={HEX.test(value) ? value : '#94a3b8'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-control border border-line bg-card p-1"
        />
        <Input aria-label="Colour" value={value} invalid={!!error} placeholder="#4f46e5" className="font-mono" onChange={(e) => onChange(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 7: Create `admin/src/components/entity/parties/SymbolField.tsx`**

```tsx
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';

/** Image URL with a live preview (always visible — no click-to-reveal). */
export function SymbolField({ label, url, error, onChange }: { label: string; url: string; error?: string; onChange: (url: string) => void }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-card p-1.5">
        {url ? <img src={url} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted">None</span>}
      </div>
      <Field label={label} error={error} className="min-w-0 flex-1">
        <Input value={url} placeholder="https://…" onChange={(e) => onChange(e.target.value)} />
      </Field>
      {url && <Button variant="ghost" size="sm" className="mt-5" aria-label={`Remove ${label}`} onClick={() => onChange('')}>Remove</Button>}
    </div>
  );
}
```

- [ ] **Step 8: Create `admin/src/components/entity/parties/PartyPanel.tsx`**

```tsx
import { ExternalLink } from 'lucide-react';
import { usePartyEdit, type PartyForm } from '../../../hooks/usePartyEdit';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Textarea } from '../../ui/Input';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import { ColourField } from './ColourField';
import { SymbolField } from './SymbolField';

interface PartyPanelProps {
  id: string;
  /** From the list row; getParty does not return it. */
  candidateCount?: number;
  onClose: () => void;
  onSaved: () => void;
}

/** Party record: the whole profile as one form, plus logo / ECI symbol. The page keys it by id. */
export function PartyPanel({ id, candidateCount, onClose, onSaved }: PartyPanelProps) {
  const ed = usePartyEdit(id);
  const { party, form, setForm, fieldErrors } = ed;
  useUnsavedGuard(ed.dirty);

  const set = (patch: Partial<PartyForm>) => setForm({ ...form, ...patch });
  const nameError = form.name.trim() ? fieldErrors.name : 'Name is required';
  const save = async () => { if (await ed.handleSave()) onSaved(); };
  const subtitle = party
    ? [party.id, candidateCount !== undefined ? `${candidateCount.toLocaleString('en-IN')} candidates` : null].filter(Boolean).join(' · ')
    : undefined;
  const logo = form.symbol_url || form.eci_symbol_url;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={party?.name ?? 'Party'}
      description={subtitle}
      footer={party ? <PanelFooter dirty={ed.dirty} saving={ed.saving} canSave={!!form.name.trim()} onCancel={ed.reset} onSave={save} /> : undefined}
    >
      {!party ? (
        ed.loading
          ? <p className="py-10 text-center text-sm text-muted">Loading party…</p>
          : <EmptyState title="Party not found" description="It may have been removed. Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-card p-1.5">
              {logo
                ? <img src={logo} alt="" className="max-h-full max-w-full object-contain" />
                : <span className="text-sm font-semibold" style={{ color: form.color || undefined }}>{form.abbreviation || party.id.slice(0, 3)}</span>}
            </span>
            <div className="flex flex-wrap gap-3 text-xs">
              {form.website && (
                <a href={form.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Website <ExternalLink size={12} aria-hidden />
                </a>
              )}
              {form.wikipedia_url && (
                <a href={form.wikipedia_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                  Wikipedia <ExternalLink size={12} aria-hidden />
                </a>
              )}
            </div>
          </div>

          <FormSection title="Details">
            <Field label="Name" error={nameError}>
              <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            {/* Single column (decisions.md): every field stacked, symbols below. */}
            <Field label="Abbreviation" error={fieldErrors.abbreviation}>
              <Input value={form.abbreviation} onChange={(e) => set({ abbreviation: e.target.value.toUpperCase() })} />
            </Field>
            <ColourField value={form.color} error={fieldErrors.color} onChange={(color) => set({ color })} />
            <Field label="Leader" error={fieldErrors.leader_name}>
              <Input value={form.leader_name} onChange={(e) => set({ leader_name: e.target.value })} />
            </Field>
            <Field label="Founded year" error={fieldErrors.founded_year}>
              <Input inputMode="numeric" value={form.founded_year} onChange={(e) => set({ founded_year: e.target.value })} />
            </Field>
            <Field label="Headquarters" error={fieldErrors.headquarters}>
              <Input value={form.headquarters} onChange={(e) => set({ headquarters: e.target.value })} />
            </Field>
            <Field label="Website" error={fieldErrors.website}>
              <Input value={form.website} placeholder="https://…" onChange={(e) => set({ website: e.target.value })} />
            </Field>
            <Field label="Wikipedia URL" error={fieldErrors.wikipedia_url}>
              <Input value={form.wikipedia_url} placeholder="https://en.wikipedia.org/wiki/…" onChange={(e) => set({ wikipedia_url: e.target.value })} />
            </Field>
            <Field label="Description" error={fieldErrors.description}>
              <Textarea rows={5} value={form.description} onChange={(e) => set({ description: e.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Symbols">
            <SymbolField label="Logo URL" url={form.symbol_url} error={fieldErrors.symbol_url} onChange={(symbol_url) => set({ symbol_url })} />
            <SymbolField label="ECI symbol URL" url={form.eci_symbol_url} error={fieldErrors.eci_symbol_url} onChange={(eci_symbol_url) => set({ eci_symbol_url })} />
          </FormSection>
        </div>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 9: Create `admin/src/components/entity/parties/PartyCreatePanel.tsx`**

```tsx
import { useState } from 'react';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { PanelFooter } from '../PanelFooter';
import { ColourField } from './ColourField';

export interface NewParty { id: string; name: string; color: string; abbreviation?: string }

const EMPTY = { id: '', name: '', abbreviation: '', color: '#3b82f6' };

/** /parties/new: the four fields the old inline form had; everything else is edited after creation. */
export function PartyCreatePanel({ saving, onCreate, onClose }: { saving: boolean; onCreate: (data: NewParty) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const dirty = JSON.stringify(form) !== JSON.stringify(EMPTY);
  useUnsavedGuard(dirty);
  const set = (patch: Partial<typeof EMPTY>) => setForm({ ...form, ...patch });
  const canSave = !!form.id.trim() && !!form.name.trim();
  const submit = () => onCreate({
    id: form.id.trim(),
    name: form.name.trim(),
    color: form.color,
    abbreviation: form.abbreviation.trim() || undefined,
  });

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title="New party"
      description="Add the profile and symbols after it is created."
      footer={<PanelFooter dirty={dirty} saving={saving} canSave={canSave} onCancel={() => setForm(EMPTY)} onSave={submit} saveLabel="Create party" />}
    >
      <FormSection title="Details">
        <Field label="ID" hint="Short code, e.g. BJP. It cannot be changed later.">
          <Input value={form.id} onChange={(e) => set({ id: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Name">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="Abbreviation">
          <Input value={form.abbreviation} onChange={(e) => set({ abbreviation: e.target.value.toUpperCase() })} />
        </Field>
        <ColourField value={form.color} onChange={(color) => set({ color })} />
      </FormSection>
    </Sheet>
  );
}
```

- [ ] **Step 10: Create `admin/src/pages/Parties.tsx`**

```tsx
import { Plus } from 'lucide-react';
import { useShellStatus } from '../context/ShellStatusContext';
import { usePartyManager } from '../hooks/usePartyManager';
import { NEW_ID, useEntityRoute } from '../hooks/useEntityRoute';
import { EntityPage } from '../components/entity/EntityPage';
import { PartyPanel } from '../components/entity/parties/PartyPanel';
import { PartyCreatePanel, type NewParty } from '../components/entity/parties/PartyCreatePanel';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import type { Party } from '../types';

type PartyRow = Party & { candidate_count?: number };
type SymbolFilter = 'all' | 'has_logo' | 'has_eci' | 'missing';
const PAGE_SIZE = 25;

const COLUMNS: Column<PartyRow>[] = [
  {
    key: 'party',
    header: 'Party',
    cell: (p) => (
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line text-[10px] font-semibold text-white" style={{ background: p.color || 'var(--color-muted)' }}>
          {p.abbreviation || p.id.slice(0, 3)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{p.name}</div>
          <div className="font-mono text-[11px] text-muted">{p.id}</div>
        </div>
      </div>
    ),
  },
  { key: 'candidates', header: 'Candidates', className: 'tabular-nums text-ink-2', cell: (p) => (p.candidate_count ?? 0).toLocaleString('en-IN') },
  {
    key: 'symbol',
    header: 'Symbol',
    cell: (p) => (p.symbol_url || p.eci_symbol_url)
      ? <img src={p.symbol_url || p.eci_symbol_url || ''} alt="" className="h-6 w-6 object-contain" />
      : <Badge tone="warn">Missing</Badge>,
  },
];

/** PAGE: Parties — registry table + party panel at /parties/:id (create at /parties/new). */
export default function Parties() {
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/parties', editorDirty);
  const list = usePartyManager();
  const rows = list.items as PartyRow[];

  const create = async (data: NewParty) => {
    const created = await list.handleCreate(data);
    if (created) route.open(created.id, { force: true });
  };

  const panel = !route.id ? null : route.isNew
    ? <PartyCreatePanel saving={list.saving} onCreate={create} onClose={() => route.close()} />
    : (
      <PartyPanel
        key={route.id}
        id={route.id}
        candidateCount={rows.find((p) => p.id === route.id)?.candidate_count}
        onClose={() => route.close()}
        onSaved={list.refresh}
      />
    );

  return (
    <EntityPage
      header={
        <PageHeader
          title="Parties"
          count={list.total}
          subtitle="Registry, colours and symbols"
          actions={<Button variant="primary" onClick={() => route.open(NEW_ID)}><Plus size={16} aria-hidden />New party</Button>}
        />
      }
      toolbar={
        <Toolbar>
          <SearchInput label="Search parties" placeholder="Search by name or ID…" value={list.search} onChange={list.handleSearch} />
          <Select aria-label="State" className="w-44" value={String(list.filters.stateId)} onChange={(e) => list.updateFilters({ stateId: e.target.value ? Number(e.target.value) : '' })}>
            <option value="">All states</option>
            {list.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <Select aria-label="Symbol (this page)" className="w-48" value={list.filters.symbol} onChange={(e) => list.updateFilters({ symbol: e.target.value as SymbolFilter })}>
            <option value="all">All symbols</option>
            <option value="has_logo">Has logo</option>
            <option value="has_eci">Has ECI symbol</option>
            <option value="missing">Missing symbol</option>
          </Select>
        </Toolbar>
      }
      table={
        <DataTable
          label="Parties"
          columns={COLUMNS}
          rows={rows}
          rowKey={(p) => p.id}
          selectedKey={route.id}
          onRowClick={(p) => route.open(p.id)}
          loading={list.loading}
          empty={list.error
            ? <EmptyState title="Could not load parties" description={list.error} />
            : <EmptyState title="No parties match" description="Try a different search or filter." />}
          footer={
            <Pager
              page={list.page} totalPages={list.totalPages} total={list.total} pageSize={PAGE_SIZE} noun="parties" onPage={list.loadPage}
              note={list.filters.symbol !== 'all' ? 'symbol filter applies to this page' : undefined}
            />
          }
        />
      }
      panel={panel}
    />
  );
}
```

- [ ] **Step 11: Mount it in `admin/src/App.tsx`.** Replace these three imports:

```tsx
import PartyManager from './pages/PartyManager';
import PartyDetail from './pages/PartyDetail';
import PartyEdit from './pages/PartyEdit';
```

with:

```tsx
import Parties from './pages/Parties';
import { EditRedirect } from './components/routing/EditRedirect';
```

Replace the `{/* Parties */}` route block (its three `<Route>` lines) with:

```tsx
                {/* Parties: list + panel at /parties/:id; old /:id/edit links redirect */}
                <Route path="parties/:id/edit" element={<EditRedirect base="/parties" />} />
                <Route path="parties/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Parties /></ProtectedRoute>} />
```

- [ ] **Step 12: Register the page as bare, and the file with Tailwind.**
- In `admin/src/components/Layout.tsx`, change `const BARE_PATHS = ['/overrides'];` to `const BARE_PATHS = ['/overrides', '/parties'];`.
- In `admin/src/theme/tailwind.css`, add this line after `@source "../pages/LiveConsole.tsx";`:

```css
@source "../pages/Parties.tsx";
```

- [ ] **Step 13: Delete the old party pages and check that nothing imports them**

```bash
git rm admin/src/pages/PartyManager.tsx admin/src/pages/PartyDetail.tsx admin/src/pages/PartyEdit.tsx
grep -rnE "pages/Party(Manager|Detail|Edit)" admin/src
```

Expected: the grep prints nothing.

- [ ] **Step 14: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/hooks/usePartyEdit.test.tsx src/pages/Parties.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 15: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. `dist/assets/*.css` contains `w-\[400px\]`.

- [ ] **Step 16: Manual check.** Run `cd admin && npm run dev`, sign in, and open http://localhost:3081/parties. Check each of the following:
- The page has 24px padding and no legacy `.admin-content` padding.
- The table header is sticky.
- Clicking a row opens the 400px panel on the right, and the table stays scrollable beside it.
- Editing a field and then clicking another row asks "Discard unsaved changes?".
- Esc asks too.
- The URL follows the open record.
- `/parties/BJP/edit` lands on `/parties/BJP`.

Compare the result with `docs/design/admin/candidates.png`.

- [ ] **Step 17: Commit**

```bash
git add admin/src/pages/Parties.tsx admin/src/pages/Parties.test.tsx admin/src/components/entity/parties admin/src/hooks/usePartyEdit.ts admin/src/hooks/usePartyEdit.test.tsx admin/src/hooks/usePartyManager.ts admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: Parties as table + side panel (/parties/:id, /parties/new)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Elections page (+ `ElectionContext.reload`)

**Files:**
- Create: `admin/src/pages/Elections.tsx`, `admin/src/components/entity/elections/ElectionPanel.tsx`
- Modify: `admin/src/hooks/useElectionManager.ts`, `admin/src/context/ElectionContext.tsx`
- Modify: `admin/src/App.tsx`, `admin/src/components/Layout.tsx`, `admin/src/theme/tailwind.css`
- Delete: `admin/src/pages/ElectionManager.tsx`
- Test: `admin/src/hooks/useElectionManager.test.tsx`, `admin/src/context/ElectionContext.test.tsx` (add a test), `admin/src/pages/Elections.test.tsx`

**Interfaces:**
- Consumes: everything from Task 9's list, plus `ConfirmDialog` (Task 6) and `useAuth().hasRole`.
- Produces:
  - `useElection().reload(): Promise<void>`. It re-fetches the list and keeps the current selection while it still exists. Otherwise it picks again: from storage, then the first live election, then the first election.
  - `useElectionManager({ onChanged? })`. `onChanged` is awaited after create, update, go-live and finalize. The hook returns `{ ...list, fieldErrors, states, saving, form, setForm, dirty, revert, editId, startCreate, startEdit, handleSave, goLive, handleFinalize, resetForm, confirmFinalize, setConfirmFinalize, showForm, setShowForm }`.
    - `handleSave(e?) → Promise<string | null>` resolves to the saved election's id.
    - `ElectionFormState` and `INITIAL_ELECTION_FORM` are exported.
  - `<ElectionPanel mode election manager loadingElections canFinalize onClose onSave onGoLive onFinalize />`.
  - `<ElectionStatusBadge status />`.

- [ ] **Step 1: Write the failing context test.** Add this to `admin/src/context/ElectionContext.test.tsx`, inside `describe('ElectionProvider', …)`:

```tsx
  it('reload picks up a new election and keeps the current selection', async () => {
    function ReloadProbe() {
      const { elections, electionId, reload } = useElection();
      return <><span data-testid="n">{elections.length}</span><span data-testid="sel">{electionId}</span><button onClick={() => { void reload(); }}>reload</button></>;
    }
    render(<MemoryRouter><ElectionProvider><ReloadProbe /></ElectionProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('sel').textContent).toBe('b'));
    vi.mocked(getElections).mockResolvedValueOnce([e('a'), e('b', 'Live'), e('c')]);
    await act(async () => { screen.getByText('reload').click(); });
    await waitFor(() => expect(screen.getByTestId('n').textContent).toBe('3'));
    expect(screen.getByTestId('sel').textContent).toBe('b');
  });

  it('reload selects an election once the first one exists', async () => {
    vi.mocked(getElections).mockResolvedValueOnce([]);
    function ReloadProbe() {
      const { electionId, reload } = useElection();
      return <><span data-testid="sel">{electionId}</span><button onClick={() => { void reload(); }}>reload</button></>;
    }
    render(<MemoryRouter><ElectionProvider><ReloadProbe /></ElectionProvider></MemoryRouter>);
    await waitFor(() => expect(getElections).toHaveBeenCalled());
    vi.mocked(getElections).mockResolvedValueOnce([e('first')]);
    await act(async () => { screen.getByText('reload').click(); });
    await waitFor(() => expect(screen.getByTestId('sel').textContent).toBe('first'));
  });
```

- [ ] **Step 2: Write the failing hook test** `admin/src/hooks/useElectionManager.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';
import type { Election } from '../types';

vi.mock('../services/election.service', () => ({
  getElections: vi.fn(async () => []),
  createElection: vi.fn(async () => ({ id: 'e9' })),
  updateElection: vi.fn(async () => ({})),
  finalizeElection: vi.fn(async () => ({})),
}));
vi.mock('../services/geo.service', () => ({ getStates: vi.fn(async () => []) }));
import { useElectionManager } from './useElectionManager';
import { createElection } from '../services/election.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

const bihar: Election = { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', state_id: 10, year: 2025, status: 'Upcoming', tentative_next_date: '2030-10-01T00:00:00.000Z', manifest_url: null };

describe('useElectionManager', () => {
  it('startEdit is clean, an edit is dirty, revert is clean again; dates fit the date input', () => {
    const { result } = renderHook(() => useElectionManager(), { wrapper });
    act(() => result.current.startEdit(bihar));
    expect(result.current.dirty).toBe(false);
    expect(result.current.form.tentative_next_date).toBe('2030-10-01');
    act(() => result.current.setForm({ ...result.current.form, year: 2026 }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.revert());
    expect(result.current.dirty).toBe(false);
  });

  it('create resolves to the new id only after onChanged has finished', async () => {
    const order: string[] = [];
    const onChanged = vi.fn(async () => { order.push('reload'); });
    const { result } = renderHook(() => useElectionManager({ onChanged }), { wrapper });
    act(() => result.current.startCreate());
    act(() => result.current.setForm({ ...result.current.form, name: 'Kerala Vidhan Sabha 2026', type: 'VS', state_id: '32' }));
    let id: string | null = null;
    await act(async () => { id = await result.current.handleSave(); order.push('saved'); });
    expect(id).toBe('e9');
    expect(order).toEqual(['reload', 'saved']);
    expect(createElection).toHaveBeenCalledWith({ name: 'Kerala Vidhan Sabha 2026', type: 'VS', year: new Date().getFullYear(), state_id: 32 });
    expect(result.current.dirty).toBe(false);
  });
});
```

- [ ] **Step 3: Write the failing page test** `admin/src/pages/Elections.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Election } from '../types';

const svc = vi.hoisted(() => ({
  getElections: vi.fn(),
  createElection: vi.fn(),
  updateElection: vi.fn(async () => ({})),
  finalizeElection: vi.fn(async () => ({})),
}));
vi.mock('../services/election.service', () => svc);
vi.mock('../services/geo.service', () => ({ getStates: vi.fn(async () => [{ id: 1, name: 'Bihar', code: 'BR' }]) }));
const ctx = vi.hoisted(() => ({ reload: vi.fn(async () => {}), elections: [] as Election[] }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({ elections: ctx.elections, electionId: 'e1', election: null, setElectionId: vi.fn(), loading: false, error: null, reload: ctx.reload }),
}));
const auth = vi.hoisted(() => ({ role: 'EDITOR' }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: auth.role, email: 'x' }, hasRole: (...r: string[]) => r.includes(auth.role) }),
}));
import Elections from './Elections';
import { renderEntityPage } from '../test-utils/entity-harness';

const E = (id: string, name: string, type: 'LS' | 'VS', status: Election['status']): Election => ({
  id, name, type, state_id: type === 'VS' ? 1 : null, year: 2025, status, tentative_next_date: null, manifest_url: null,
});
const ELECTIONS = [E('e1', 'Bihar Vidhan Sabha 2025', 'VS', 'Upcoming'), E('e2', 'Lok Sabha 2024', 'LS', 'Live'), E('e3', 'Kerala Vidhan Sabha 2026', 'VS', 'Upcoming')];

beforeEach(() => {
  ctx.elections = ELECTIONS;
  auth.role = 'EDITOR';
  svc.getElections.mockImplementation(async (f?: { type?: string; status?: string }) =>
    ELECTIONS.filter((e) => (!f?.type || e.type === f.type) && (!f?.status || e.status === f.status)));
  svc.createElection.mockImplementation(async () => ELECTIONS[2]);
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/elections') => renderEntityPage('/elections', <Elections />, at);
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Elections' });

describe('Elections page', () => {
  it('lists elections with sentence-case status and opens one in the panel', async () => {
    renderAt();
    expect(await within(table()).findByText('Lok Sabha 2024')).toBeTruthy();
    expect(within(table()).getByText('Live')).toBeTruthy();
    fireEvent.click(within(table()).getByText('Bihar Vidhan Sabha 2025'));
    expect(where()).toBe('/elections/e1');
    const panel = screen.getByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Bihar Vidhan Sabha 2025');
    // The state options arrive with getStates; a controlled <select> reads '' until its option exists.
    await waitFor(() => expect((within(panel).getByLabelText('State') as HTMLSelectElement).value).toBe('1'));
  });

  it('Go live asks first, then sets the status and reloads the top-bar list', async () => {
    renderAt('/elections/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Go live' }));
    const confirm = screen.getByRole('dialog', { name: 'Go live?' });
    fireEvent.click(within(confirm).getByRole('button', { name: 'Go live' }));
    await waitFor(() => expect(svc.updateElection).toHaveBeenCalledWith('e1', { status: 'Live' }));
    await waitFor(() => expect(ctx.reload).toHaveBeenCalled());
  });

  it('an EDITOR never sees Finalize', async () => {
    renderAt('/elections/e2');
    await screen.findByRole('dialog', { name: 'Lok Sabha 2024' });
    expect(screen.queryByRole('button', { name: 'Finalize' })).toBeNull();
  });

  it('a SUPER_ADMIN can finalize a live election after confirming', async () => {
    auth.role = 'SUPER_ADMIN';
    renderAt('/elections/e2');
    const panel = await screen.findByRole('dialog', { name: 'Lok Sabha 2024' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Finalize' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Finalize election?' })).getByRole('button', { name: 'Yes, finalize' }));
    await waitFor(() => expect(svc.finalizeElection).toHaveBeenCalledWith('e2'));
  });

  it('a deep link opens the election even when the table filter hides it', async () => {
    localStorage.setItem('elections_filters', JSON.stringify({ status: '', type: 'LS', stateId: null }));
    renderAt('/elections/e1');
    await within(table()).findByText('Lok Sabha 2024');
    expect(within(table()).queryByText('Bihar Vidhan Sabha 2025')).toBeNull();
    const panel = screen.getByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    expect((within(panel).getByLabelText('Name') as HTMLInputElement).value).toBe('Bihar Vidhan Sabha 2025');
  });

  it('New election creates, waits for the reload, then shows the new record', async () => {
    renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'New election' }));
    expect(where()).toBe('/elections/new');
    const panel = screen.getByRole('dialog', { name: 'New election' });
    fireEvent.change(within(panel).getByLabelText('Name'), { target: { value: 'Kerala Vidhan Sabha 2026' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Create election' }));
    await waitFor(() => expect(svc.createElection).toHaveBeenCalledWith(expect.objectContaining({ name: 'Kerala Vidhan Sabha 2026' })));
    await waitFor(() => expect(where()).toBe('/elections/e3'));
    expect(ctx.reload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/context/ElectionContext.test.tsx src/hooks/useElectionManager.test.tsx src/pages/Elections.test.tsx`
Expected: FAIL.
- `reload is not a function`.
- `dirty` is `undefined`, and `expected '2030-10-01T00:00:00.000Z' to be '2030-10-01'`.
- "Failed to resolve import './Elections'".

- [ ] **Step 5: Add `reload` to `admin/src/context/ElectionContext.tsx`.**

In `ElectionContextValue`, add:

```ts
  /** Re-fetch after create / go live / finalize; keeps the selection while it still exists. */
  reload: () => Promise<void>;
```

Add this callback after `setElectionId`:

```ts
  const reload = useCallback(async () => {
    try {
      const all = await getElections();
      setElections(all);
      setId((cur) => (cur && all.some((e) => e.id === cur) ? cur : pickInitialElection(all, null, readStorage())));
      setError(null);
    } catch {
      setError('Could not load elections');
    }
  }, []);
```

Then replace the `value` memo with:

```ts
  const value = useMemo<ElectionContextValue>(() => ({
    elections, electionId, setElectionId, loading, error, reload,
    election: elections.find((e) => e.id === electionId) ?? null,
  }), [elections, electionId, setElectionId, loading, error, reload]);
```

- [ ] **Step 6: Rewrite `admin/src/hooks/useElectionManager.ts`**

```ts
import { useState, useEffect } from 'react';
import { getElections, createElection, updateElection, finalizeElection } from '../services/election.service';
import { getStates } from '../services/geo.service';
import { useResourceList } from './useResourceList';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import type { Election, State } from '../types';

interface ElectionFilters {
  status: string;
  type: '' | 'LS' | 'VS';
  stateId: number | null;
}

export interface ElectionFormState {
  name: string;
  type: 'LS' | 'VS';
  year: number;
  state_id: string;
  tentative_next_date: string;
}

export const INITIAL_ELECTION_FORM: ElectionFormState = {
  name: '',
  type: 'LS',
  year: new Date().getFullYear(),
  state_id: '',
  tentative_next_date: ''
};

/** `<input type="date">` needs YYYY-MM-DD; the API may return a full ISO timestamp. */
const toForm = (el: Election): ElectionFormState => ({
  name: el.name,
  type: el.type,
  year: el.year,
  state_id: el.state_id?.toString() || '',
  tentative_next_date: el.tentative_next_date ? el.tentative_next_date.slice(0, 10) : ''
});

interface Options {
  /** Awaited after a create, update, go-live or finalize (the page reloads the top-bar election list). */
  onChanged?: () => void | Promise<void>;
}

/**
 * CONTROLLER: Election Manager (MVC)
 * Election lifecycle, list and the panel form. `dirty` compares the form with the opened/saved snapshot.
 */
export function useElectionManager({ onChanged }: Options = {}) {
  const { toast, toastError } = useToast();
  const [states, setStates] = useState<State[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmFinalize, setConfirmFinalize] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<ElectionFormState>(INITIAL_ELECTION_FORM);
  const [savedForm, setSavedForm] = useState<ElectionFormState>(INITIAL_ELECTION_FORM);

  useEffect(() => {
    getStates().then(setStates).catch(() => {});
  }, []);

  const list = useResourceList<ElectionFilters>({
    key: 'elections',
    initialFilters: { status: '', type: '', stateId: null },
    onLoad: async (_page, search, filters) => {
      const data = await getElections({
        type: filters.type || undefined,
        status: filters.status || undefined
      });
      const filtered = search
        ? data.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))
        : data;
      return { data: filtered, total: filtered.length };
    }
  });

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm(INITIAL_ELECTION_FORM);
    setSavedForm(INITIAL_ELECTION_FORM);
    setFieldErrors({});
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (el: Election) => {
    const f = toForm(el);
    setForm(f);
    setSavedForm(f);
    setEditId(el.id);
    setFieldErrors({});
    setShowForm(true);
  };

  /** Drop unsaved edits (panel Cancel). */
  const revert = () => { setForm(savedForm); setFieldErrors({}); };

  /** Saves the form; resolves to the saved election's id (the new id on create) or null on failure. */
  const handleSave = async (e?: { preventDefault(): void }): Promise<string | null> => {
    e?.preventDefault();
    setSaving(true);
    setFieldErrors({});

    const payload = {
      name: form.name,
      type: form.type,
      year: form.year,
      ...(form.state_id ? { state_id: Number(form.state_id) } : {}),
      ...(form.tentative_next_date ? { tentative_next_date: form.tentative_next_date } : {}),
    };

    try {
      let savedId: string;
      if (editId) {
        await updateElection(editId, payload);
        savedId = editId;
        setSavedForm(form);
        toast('Election updated successfully');
      } else {
        const created = await createElection(payload);
        savedId = created.id;
        setForm(INITIAL_ELECTION_FORM);
        setSavedForm(INITIAL_ELECTION_FORM);
        toast('New election registered');
      }
      list.refresh();
      await onChanged?.();
      return savedId;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Operation failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (id: string) => {
    try {
      await finalizeElection(id);
      toast('Election finalized and archived');
      list.refresh();
      await onChanged?.();
    } catch (err) {
      toastError(err, 'Finalization failed');
    }
  };

  const goLive = async (id: string) => {
    try {
      await updateElection(id, { status: 'Live' });
      toast('Election is now live');
      list.refresh();
      await onChanged?.();
    } catch (err) {
      toastError(err, 'Failed to go live');
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  return {
    fieldErrors,
    ...list,
    states,
    saving,
    confirmFinalize,
    setConfirmFinalize,
    showForm,
    setShowForm,
    editId,
    form,
    setForm,
    dirty,
    revert,
    startCreate,
    startEdit,
    handleSave,
    handleFinalize,
    goLive,
    resetForm
  };
}
```

- [ ] **Step 7: Create `admin/src/components/entity/elections/ElectionPanel.tsx`**

```tsx
import { useElectionManager, type ElectionFormState } from '../../../hooks/useElectionManager';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import type { Election } from '../../../types';

const TONE: Record<Election['status'], 'accent' | 'ok' | 'muted'> = { Upcoming: 'accent', Live: 'ok', Finalized: 'muted' };
const HELP: Record<Election['status'], string> = {
  Upcoming: 'Not live yet. Going live opens it to results entry in the Live Console.',
  Live: 'Accepting results. Finalizing archives the live data and stops overrides.',
  Finalized: 'Archived. Results can no longer be changed.',
};

export function ElectionStatusBadge({ status }: { status: Election['status'] }) {
  return <Badge tone={TONE[status]}>{status}</Badge>;
}

export const electionTypeLabel = (t: Election['type']) => (t === 'LS' ? 'Lok Sabha' : 'Vidhan Sabha');

interface ElectionPanelProps {
  mode: 'new' | 'edit';
  /** The open election, resolved from the global list (null while loading or if unknown). */
  election: Election | null;
  manager: ReturnType<typeof useElectionManager>;
  loadingElections: boolean;
  canFinalize: boolean;
  onClose: () => void;
  onSave: () => void;
  onGoLive: () => void;
  onFinalize: () => void;
}

/** Elections have no detail page: the panel is the create/edit form plus the lifecycle actions. */
export function ElectionPanel({ mode, election, manager, loadingElections, canFinalize, onClose, onSave, onGoLive, onFinalize }: ElectionPanelProps) {
  const { form, setForm, states, fieldErrors } = manager;
  const set = (patch: Partial<ElectionFormState>) => setForm({ ...form, ...patch });
  const nameError = form.name.trim() ? fieldErrors.name : 'Name is required';
  const missing = mode === 'edit' && !election;
  const title = mode === 'new' ? 'New election' : election?.name ?? 'Election';
  const description = election
    ? `${electionTypeLabel(election.type)} · ${election.year}`
    : mode === 'new' ? 'Name, type, year and state' : undefined;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={title}
      description={description}
      footer={missing ? undefined : (
        <PanelFooter dirty={manager.dirty} saving={manager.saving} canSave={!!form.name.trim()} onCancel={manager.revert} onSave={onSave}
          saveLabel={mode === 'new' ? 'Create election' : 'Save changes'} />
      )}
    >
      {missing ? (
        loadingElections
          ? <p className="py-10 text-center text-sm text-muted">Loading election…</p>
          : <EmptyState title="Election not found" description="Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5">
          {election && (
            <FormSection title="Status">
              <div className="flex items-center justify-between gap-3">
                <ElectionStatusBadge status={election.status} />
                <div className="flex gap-2">
                  {election.status === 'Upcoming' && <Button size="sm" variant="primary" onClick={onGoLive}>Go live</Button>}
                  {election.status === 'Live' && canFinalize && <Button size="sm" variant="danger" onClick={onFinalize}>Finalize</Button>}
                </div>
              </div>
              <p className="text-xs text-muted">{HELP[election.status]}</p>
            </FormSection>
          )}
          <FormSection title="Details">
            <Field label="Name" error={nameError}>
              <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={form.type} onChange={(e) => {
                  const type = e.target.value as ElectionFormState['type'];
                  set(type === 'LS' ? { type, state_id: '' } : { type });
                }}>
                  <option value="LS">Lok Sabha</option>
                  <option value="VS">Vidhan Sabha</option>
                </Select>
              </Field>
              <Field label="Year" error={fieldErrors.year}>
                <Input type="number" value={form.year} onChange={(e) => set({ year: parseInt(e.target.value, 10) || 0 })} />
              </Field>
            </div>
            {form.type === 'VS' && (
              <Field label="State" error={fieldErrors.state_id}>
                <Select value={form.state_id} onChange={(e) => set({ state_id: e.target.value })}>
                  <option value="">Select a state</option>
                  {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Tentative next date" error={fieldErrors.tentative_next_date}>
              <Input type="date" value={form.tentative_next_date} onChange={(e) => set({ tentative_next_date: e.target.value })} />
            </Field>
          </FormSection>
        </div>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 8: Create `admin/src/pages/Elections.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { useElectionManager } from '../hooks/useElectionManager';
import { NEW_ID, useEntityRoute } from '../hooks/useEntityRoute';
import { useUnsavedGuard } from '../hooks/useUnsavedGuard';
import { EntityPage } from '../components/entity/EntityPage';
import { ElectionPanel, ElectionStatusBadge, electionTypeLabel } from '../components/entity/elections/ElectionPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Button } from '../components/ui/Button';
import type { Election, State } from '../types';

const columns = (states: State[]): Column<Election>[] => [
  {
    key: 'name',
    header: 'Election',
    cell: (e) => <div><div className="font-medium text-ink">{e.name}</div><div className="text-[11px] text-muted">{e.year}</div></div>,
  },
  { key: 'type', header: 'Type', className: 'text-ink-2', cell: (e) => electionTypeLabel(e.type) },
  { key: 'state', header: 'State', className: 'text-ink-2', cell: (e) => (e.state_id == null ? 'National' : states.find((s) => s.id === e.state_id)?.name ?? '–') },
  { key: 'status', header: 'Status', cell: (e) => <ElectionStatusBadge status={e.status} /> },
];

/** PAGE: Elections — table + create/edit panel at /elections/:id (create at /elections/new). */
export default function Elections() {
  const { hasRole } = useAuth();
  const canFinalize = hasRole('SUPER_ADMIN');
  const ctx = useElection();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/elections', editorDirty);
  const m = useElectionManager({ onChanged: ctx.reload });
  const [confirm, setConfirm] = useState<'live' | 'finalize' | null>(null);
  useUnsavedGuard(!!route.id && m.dirty);

  // Resolve the open record from the full list: the table's (remembered) filters may hide it.
  const target = route.id && !route.isNew ? ctx.elections.find((e) => e.id === route.id) ?? null : null;
  useEffect(() => {
    if (route.isNew) m.startCreate();
    else if (target) m.startEdit(target);
    // Only when the open record changes — not when its object is refreshed by a reload.
  }, [route.id, target?.id]);

  const save = async () => {
    const id = await m.handleSave();
    if (id && route.isNew) route.open(id, { force: true });
  };

  return (
    <>
      <EntityPage
        header={
          <PageHeader
            title="Elections"
            count={m.total}
            subtitle="Lok Sabha and Vidhan Sabha cycles"
            actions={<Button variant="primary" onClick={() => route.open(NEW_ID)}><Plus size={16} aria-hidden />New election</Button>}
          />
        }
        toolbar={
          <Toolbar>
            <SearchInput label="Search elections" placeholder="Search by name…" value={m.search} onChange={m.handleSearch} />
            <ChipGroup
              label="Type"
              value={m.filters.type}
              onChange={(type) => m.updateFilters({ type, stateId: null })}
              options={[{ value: '', label: 'All' }, { value: 'LS', label: 'Lok Sabha' }, { value: 'VS', label: 'Vidhan Sabha' }]}
            />
            <Select aria-label="Status" className="w-40" value={m.filters.status} onChange={(e) => m.updateFilters({ status: e.target.value })}>
              <option value="">All statuses</option>
              <option value="Upcoming">Upcoming</option>
              <option value="Live">Live</option>
              <option value="Finalized">Finalized</option>
            </Select>
          </Toolbar>
        }
        table={
          <DataTable
            label="Elections"
            columns={columns(m.states)}
            rows={m.items as Election[]}
            rowKey={(e) => e.id}
            selectedKey={route.id}
            onRowClick={(e) => route.open(e.id)}
            loading={m.loading}
            empty={m.error
              ? <EmptyState title="Could not load elections" description={m.error} />
              : <EmptyState title="No elections match" description="Try a different search or filter, or create one." />}
          />
        }
        panel={route.id ? (
          <ElectionPanel
            mode={route.isNew ? 'new' : 'edit'}
            election={target}
            manager={m}
            loadingElections={ctx.loading}
            canFinalize={canFinalize}
            onClose={() => route.close()}
            onSave={save}
            onGoLive={() => setConfirm('live')}
            onFinalize={() => setConfirm('finalize')}
          />
        ) : null}
      />
      <ConfirmDialog
        open={confirm === 'live'}
        tone="primary"
        title="Go live?"
        description="Viewers will see this election as live, and the Live Console will accept results for it."
        confirmLabel="Go live"
        onCancel={() => setConfirm(null)}
        onConfirm={() => { setConfirm(null); if (target) void m.goLive(target.id); }}
      />
      {canFinalize && (
        <ConfirmDialog
          open={confirm === 'finalize'}
          title="Finalize election?"
          description="This will archive live data, disable scraping and manual overrides. This action cannot be undone."
          confirmLabel="Yes, finalize"
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); if (target) void m.handleFinalize(target.id); }}
        />
      )}
    </>
  );
}
```

- [ ] **Step 9: Mount it in `admin/src/App.tsx`.** Replace `import ElectionManager from './pages/ElectionManager';` with `import Elections from './pages/Elections';`. Then replace the `elections` route line with:

```tsx
                <Route path="elections/:id/edit" element={<EditRedirect base="/elections" />} />
                <Route path="elections/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Elections /></ProtectedRoute>} />
```

- [ ] **Step 10: Register the page as bare and add it to Tailwind.**
- In `Layout.tsx`, change `['/overrides', '/parties']` to `['/overrides', '/parties', '/elections']`.
- In `tailwind.css`, add this line after `@source "../pages/Parties.tsx";`:

```css
@source "../pages/Elections.tsx";
```

- [ ] **Step 11: Delete the old page**

```bash
git rm admin/src/pages/ElectionManager.tsx
grep -rn "pages/ElectionManager" admin/src
```

Expected: the grep prints nothing.

- [ ] **Step 12: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/context/ElectionContext.test.tsx src/hooks/useElectionManager.test.tsx src/pages/Elections.test.tsx`
Expected: PASS.

- [ ] **Step 13: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 14: Manual check.** Open http://localhost:3081/elections.
- "New election": create one and check it appears in the top-bar election picker without reloading the page.
- "Go live": it shows a confirmation.
- As an EDITOR, "Finalize" is not visible.

- [ ] **Step 15: Commit**

```bash
git add admin/src/pages/Elections.tsx admin/src/pages/Elections.test.tsx admin/src/components/entity/elections admin/src/hooks/useElectionManager.ts admin/src/hooks/useElectionManager.test.tsx admin/src/context/ElectionContext.tsx admin/src/context/ElectionContext.test.tsx admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: Elections as table + panel with go-live/finalize confirms; context reload

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Persons page (`?q=`, readable gender, merge duplicates)

**Files:**
- Create: `admin/src/pages/Persons.tsx`, `admin/src/components/entity/persons/PersonPanel.tsx`
- Modify: `admin/src/hooks/usePersonEdit.ts` (dirty snapshot, `reset`, `handleMerge` returns boolean)
- Modify: `admin/src/App.tsx`, `admin/src/components/Layout.tsx`, `admin/src/theme/tailwind.css`
- Delete: `admin/src/pages/PersonManager.tsx`, `admin/src/pages/PersonDetail.tsx`, `admin/src/pages/PersonEdit.tsx`
- Test: `admin/src/hooks/usePersonEdit.test.tsx` (add a test), `admin/src/pages/Persons.test.tsx`

**Interfaces:**
- Consumes:
  - Task 1: `useResourceList` with `initialSearch`
  - Task 2: `genderLabel`, `normalizeGender`
  - Task 7: `useUnsavedGuard`
  - Task 8: entity scaffold
  - `useAuth().hasRole`
- Produces:
  - `usePersonEdit(id?)` returns `{ fieldErrors, person, loading, saving, form, setForm, dirty, reset, mergeSearch, setMergeSearch, mergeResults, merging, handleSave, handleMerge }`.
    - `handleMerge(duplicateId, duplicateName) → Promise<boolean>`.
    - `loading` starts `true` when `id` is given.
  - `<PersonPanel id onClose onChanged />`.

- [ ] **Step 1: Write the failing hook test.** Add to `admin/src/hooks/usePersonEdit.test.tsx`:

```tsx
  it('is clean after load, dirty after an edit, clean after reset; merge reports success', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() => usePersonEdit('p1'), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.person).not.toBeNull());
    expect(result.current.dirty).toBe(false);
    act(() => result.current.setForm({ ...result.current.form, bio: 'New bio' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
    let merged = false;
    await act(async () => { merged = await result.current.handleMerge('dup', 'Nitish Kr'); });
    expect(merged).toBe(true);
  });
```

- [ ] **Step 2: Write the failing page test** `admin/src/pages/Persons.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { PersonWithStats } from '../types';

const api = vi.hoisted(() => ({
  getPersons: vi.fn(),
  getPerson: vi.fn(),
  updatePerson: vi.fn(async () => ({})),
  mergePersons: vi.fn(async () => ({ merged: true, target_id: 'p1' })),
}));
vi.mock('../services/person.api', () => api);
const auth = vi.hoisted(() => ({ role: 'EDITOR' }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: auth.role, email: 'x' }, hasRole: (...r: string[]) => r.includes(auth.role) }),
}));
import Persons from './Persons';
import { renderEntityPage } from '../test-utils/entity-harness';

const P = (id: string, name: string, gender: string | null, count = 2): PersonWithStats => ({
  id, name, photo_url: null, gender, education: 'BA', date_of_birth: null, candidate_count: count,
  elections: [], state_id: null, state_name: null, region_id: null, region_name: null,
});
const PAGE1 = [P('p1', 'Nitish Kumar', 'M'), P('p3', 'Rabri Devi', 'Female'), P('p4', 'Unknown Person', null)];
const page = (data: PersonWithStats[], p = 1) => ({ success: true, data, pagination: { page: p, limit: 50, total: 120, totalPages: 3 } });

beforeEach(() => {
  auth.role = 'EDITOR';
  api.getPersons.mockImplementation(async (p: number, limit: number) =>
    limit === 20 ? page([P('p1', 'Nitish Kumar', 'M'), P('p2', 'Nitish Kr', 'M', 1)]) : page(p === 1 ? PAGE1 : [P('p9', 'Page Two', 'M')], p));
  api.getPerson.mockImplementation(async (id: string) => ({
    ...(PAGE1.find((x) => x.id === id) ?? P(id, `Person ${id}`, null)),
    bio: null,
    metadata: { caste: 'Kurmi' },
    candidates: [{
      id: 'c1', person_id: id, election_id: 'e1', const_id: 's1', party_id: 'JDU', party: null, name: 'Nitish Kumar',
      is_incumbent: true, constituency_name: 'Harnaut', election_name: 'Bihar Vidhan Sabha', election_year: 2020,
    }],
  }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/persons') => renderEntityPage('/persons', <Persons />, at);
const table = () => screen.getByRole('table', { name: 'Persons' });

describe('Persons page', () => {
  it('shows stored gender values readably', async () => {
    renderAt();
    const row = (await within(table()).findByText('Nitish Kumar')).closest('tr')!;
    expect(within(row).getByText('Male')).toBeTruthy();
    expect(within(within(table()).getByText('Rabri Devi').closest('tr')!).getByText('Female')).toBeTruthy();
    expect(within(within(table()).getByText('Unknown Person').closest('tr')!).getByText('Not specified')).toBeTruthy();
  });

  it('?q= becomes the initial search (the Candidates "find person" link works)', async () => {
    renderAt('/persons?q=Nitish');
    expect((screen.getByLabelText('Search persons') as HTMLInputElement).value).toBe('Nitish');
    await waitFor(() => expect(api.getPersons).toHaveBeenCalledWith(1, 50, 'Nitish'));
  });

  it('opens a person with history and read-only details; saving keeps the normalised gender', async () => {
    renderAt();
    fireEvent.click(await within(table()).findByText('Nitish Kumar'));
    const panel = await screen.findByRole('dialog', { name: 'Nitish Kumar' });
    expect(await within(panel).findByText('Harnaut')).toBeTruthy();
    expect(within(panel).getByText('Kurmi')).toBeTruthy();
    expect((within(panel).getByLabelText('Gender') as HTMLSelectElement).value).toBe('Male');
    fireEvent.change(within(panel).getByLabelText('Education'), { target: { value: 'MA' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(api.updatePerson).toHaveBeenCalledWith('p1', expect.objectContaining({ education: 'MA', gender: 'Male' })));
  });

  it('an EDITOR does not see Merge duplicates', async () => {
    renderAt('/persons/p1');
    const panel = await screen.findByRole('dialog', { name: 'Nitish Kumar' });
    await within(panel).findByText('Harnaut');
    expect(within(panel).queryByText('Merge duplicates')).toBeNull();
  });

  it('a SUPER_ADMIN merges a duplicate into the open person and the list refreshes', async () => {
    auth.role = 'SUPER_ADMIN';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('/persons/p1');
    const panel = await screen.findByRole('dialog', { name: 'Nitish Kumar' });
    fireEvent.change(await within(panel).findByLabelText('Search duplicates'), { target: { value: 'Nitish' } });
    fireEvent.click(await within(panel).findByRole('button', { name: 'Merge Nitish Kr into this record' }));
    await waitFor(() => expect(api.mergePersons).toHaveBeenCalledWith('p2', 'p1'));
    await waitFor(() => expect(api.getPersons.mock.calls.filter(([, l]) => l === 50)).toHaveLength(2));
  });

  it('Merge is disabled while the form has unsaved edits (a merge reloads the record)', async () => {
    auth.role = 'SUPER_ADMIN';
    renderAt('/persons/p1');
    const panel = await screen.findByRole('dialog', { name: 'Nitish Kumar' });
    fireEvent.change(await within(panel).findByLabelText('Search duplicates'), { target: { value: 'Nitish' } });
    const merge = await within(panel).findByRole('button', { name: 'Merge Nitish Kr into this record' });
    fireEvent.change(within(panel).getByLabelText('Bio'), { target: { value: 'New bio' } });
    expect((merge as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).getByText('Save or cancel your changes first.')).toBeTruthy();
  });

  it('pages through persons', async () => {
    renderAt();
    await within(table()).findByText('Nitish Kumar');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Page Two')).toBeTruthy();
    expect(api.getPersons).toHaveBeenLastCalledWith(2, 50, undefined);
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/usePersonEdit.test.tsx src/pages/Persons.test.tsx`
Expected: FAIL.
- The hook test fails with `expected false to be true` (on `loading`).
- The page test fails with "Failed to resolve import './Persons'".

- [ ] **Step 4: Rewrite `admin/src/hooks/usePersonEdit.ts`**

```ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { getPerson, updatePerson, mergePersons, getPersons } from '../services/person.api';
import { PersonService } from '../services/person.service';
import { useToast } from '../context/ToastContext';
import { fieldErrorMap } from '../services/api-client';
import type { PersonWithCandidates, PersonWithStats } from '../types';

export type PersonForm = ReturnType<typeof PersonService.prepareFormState>;

const EMPTY_FORM: PersonForm = { name: '', date_of_birth: '', gender: '', education: '', photo_url: '', bio: '', wikipedia_url: '' };

/**
 * CONTROLLER: Person Edit (MVC)
 * Master record state and deduplication (merging). `dirty` compares the form with the loaded/saved snapshot.
 */
export function usePersonEdit(id?: string) {
  const { toast, toastError } = useToast();

  const [person, setPerson] = useState<PersonWithCandidates | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<PersonForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<PersonForm>(EMPTY_FORM);

  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeResults, setMergeResults] = useState<PersonWithStats[]>([]);
  const [merging, setMerging] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const loadPerson = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getPerson(id);
      const next = PersonService.prepareFormState(data);
      setPerson(data);
      setForm(next);
      setSaved(next);
    } catch (err) {
      toastError(err, 'Failed to load person record');
    } finally {
      setLoading(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadPerson();
  }, [loadPerson]);

  const handleSave = async () => {
    if (!id || !person) return false;
    setSaving(true);
    setFieldErrors({});
    try {
      await updatePerson(id, {
        ...form,
        metadata: {
          ...person.metadata,
          wikipedia_url: form.wikipedia_url
        }
      });
      toast('Person record updated');
      loadPerson();
      return true;
    } catch (err) {
      setFieldErrors(fieldErrorMap(err));
      toastError(err, 'Failed to update record');
      return false;
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!mergeSearch || mergeSearch.trim().length < 2) {
      setMergeResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      try {
        const response = await getPersons(1, 20, mergeSearch.trim());
        setMergeResults(response.data.filter(p => p.id !== id));
      } catch {
        setMergeResults([]);
      }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [mergeSearch, id]);

  /** Merge a duplicate record INTO the person being viewed: the duplicate's contests move here and it is deleted. */
  const handleMerge = async (duplicateId: string, duplicateName: string): Promise<boolean> => {
    if (!id) return false;
    if (!window.confirm(`Merge "${duplicateName}" into "${person?.name}"? This action is permanent.`)) return false;

    setMerging(true);
    try {
      // mergePersons(sourceId, targetId): the backend deletes the source.
      await mergePersons(duplicateId, id);
      toast('Records merged successfully');
      setMergeSearch('');
      loadPerson();
      return true;
    } catch (err) {
      toastError(err, 'Merge failed');
      return false;
    } finally {
      setMerging(false);
    }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  /** Drop unsaved edits (panel Cancel). */
  const reset = () => { setForm(saved); setFieldErrors({}); };

  return {
    fieldErrors,
    person, loading, saving, form, setForm, dirty, reset,
    mergeSearch, setMergeSearch, mergeResults, merging,
    handleSave, handleMerge
  };
}
```

- [ ] **Step 5: Create `admin/src/components/entity/persons/PersonPanel.tsx`**

```tsx
import { useAuth } from '../../../context/AuthContext';
import { usePersonEdit, type PersonForm } from '../../../hooks/usePersonEdit';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { genderLabel } from '../../../utils/person-format';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select, Textarea } from '../../ui/Input';
import { SearchInput } from '../../ui/Toolbar';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';

const GENDERS = ['Male', 'Female', 'Other'];

/** Person record: edit form, read-only recorded details, election history, and (SUPER_ADMIN) merge duplicates. */
export function PersonPanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const { hasRole } = useAuth();
  const canMerge = hasRole('SUPER_ADMIN');
  const ed = usePersonEdit(id);
  const { person, form, setForm, fieldErrors } = ed;
  useUnsavedGuard(ed.dirty);

  const set = (patch: Partial<PersonForm>) => setForm({ ...form, ...patch });
  const nameError = form.name.trim() ? fieldErrors.name : 'Name is required';
  const save = async () => { if (await ed.handleSave()) onChanged(); };
  const merge = async (dupId: string, dupName: string) => { if (await ed.handleMerge(dupId, dupName)) onChanged(); };
  const meta = (person?.metadata ?? {}) as Record<string, unknown>;
  const contests = person?.candidates?.length ?? 0;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={person?.name ?? 'Person'}
      description={person ? `${genderLabel(person.gender)} · ${contests} ${contests === 1 ? 'contest' : 'contests'}` : undefined}
      footer={person ? <PanelFooter dirty={ed.dirty} saving={ed.saving} canSave={!!form.name.trim()} onCancel={ed.reset} onSave={save} /> : undefined}
    >
      {!person ? (
        ed.loading
          ? <p className="py-10 text-center text-sm text-muted">Loading person…</p>
          : <EmptyState title="Person not found" description="It may have been merged into another record." />
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-card border border-line bg-subtle text-lg font-semibold text-ink-2">
              {form.photo_url ? <img src={form.photo_url} alt="" className="h-full w-full object-cover" /> : person.name.charAt(0)}
            </span>
            <p className="text-xs text-ink-2">{person.education || 'No education recorded'}</p>
          </div>

          <FormSection title="Details">
            <Field label="Name" error={nameError}>
              <Input value={form.name} invalid={!!nameError} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth" error={fieldErrors.date_of_birth}>
                <Input type="date" value={form.date_of_birth} onChange={(e) => set({ date_of_birth: e.target.value })} />
              </Field>
              <Field label="Gender" error={fieldErrors.gender}>
                <Select value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                  <option value="">Not specified</option>
                  {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                  {form.gender && !GENDERS.includes(form.gender) && <option value={form.gender}>{form.gender}</option>}
                </Select>
              </Field>
            </div>
            <Field label="Education" error={fieldErrors.education}>
              <Input value={form.education} onChange={(e) => set({ education: e.target.value })} />
            </Field>
            <Field label="Photo URL" error={fieldErrors.photo_url}>
              <Input value={form.photo_url} placeholder="https://…" onChange={(e) => set({ photo_url: e.target.value })} />
            </Field>
            <Field label="Wikipedia URL" error={fieldErrors.wikipedia_url}>
              <Input value={form.wikipedia_url} placeholder="https://en.wikipedia.org/wiki/…" onChange={(e) => set({ wikipedia_url: e.target.value })} />
            </Field>
            <Field label="Bio" error={fieldErrors.bio}>
              <Textarea rows={5} value={form.bio} onChange={(e) => set({ bio: e.target.value })} />
            </Field>
          </FormSection>

          <FormSection title="Recorded details">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-muted">Caste</dt><dd className="text-ink">{(meta.caste as string) || 'Not recorded'}</dd></div>
              <div><dt className="text-xs text-muted">Religion</dt><dd className="text-ink">{(meta.religion as string) || 'Not recorded'}</dd></div>
            </dl>
            <p className="text-[11px] text-muted">Read-only. These come from the data import.</p>
          </FormSection>

          <FormSection title="Election history">
            {contests === 0 && <p className="text-xs text-muted">No contests recorded.</p>}
            <ul className="divide-y divide-line">
              {person.candidates.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-ink">{c.constituency_name || c.const_id}</div>
                    <div className="text-[11px] text-muted">
                      {c.election_name || c.election_id}{c.election_year ? ` (${c.election_year})` : ''} · {c.party_id || 'IND'}
                    </div>
                  </div>
                  {c.is_incumbent && <Badge tone="warn">Incumbent</Badge>}
                </li>
              ))}
            </ul>
          </FormSection>

          {canMerge && (
            <FormSection title="Merge duplicates">
              <p className="text-xs text-ink-2">Find a duplicate record and merge it into this one. Its contests move here and the duplicate is deleted.</p>
              {/* A merge reloads the record, which would silently drop unsaved form edits. */}
              {ed.dirty && <p className="text-xs text-warn-text">Save or cancel your changes first.</p>}
              <SearchInput label="Search duplicates" placeholder="Search by name…" value={ed.mergeSearch} onChange={ed.setMergeSearch} />
              <ul className="space-y-1.5">
                {ed.mergeResults.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-control border border-line px-2.5 py-1.5">
                    <div className="min-w-0 text-xs">
                      <div className="truncate font-medium text-ink">{p.name}</div>
                      <div className="text-muted">{p.candidate_count} contests</div>
                    </div>
                    <Button size="sm" variant="danger" disabled={ed.merging || ed.dirty} aria-label={`Merge ${p.name} into this record`} onClick={() => merge(p.id, p.name)}>Merge</Button>
                  </li>
                ))}
              </ul>
            </FormSection>
          )}
        </div>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 6: Create `admin/src/pages/Persons.tsx`**

```tsx
import { useSearchParams } from 'react-router-dom';
import { useShellStatus } from '../context/ShellStatusContext';
import { useResourceList } from '../hooks/useResourceList';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { getPersons } from '../services/person.api';
import { genderLabel } from '../utils/person-format';
import { EntityPage } from '../components/entity/EntityPage';
import { PersonPanel } from '../components/entity/persons/PersonPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import type { PersonWithStats } from '../types';

const PAGE_SIZE = 50;

const COLUMNS: Column<PersonWithStats>[] = [
  {
    key: 'person',
    header: 'Person',
    cell: (p) => (
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-control border border-line bg-subtle text-xs font-semibold text-ink-2">
          {p.photo_url ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" /> : p.name.charAt(0)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{p.name}</div>
          <div className="font-mono text-[11px] text-muted">{p.id.split('-')[0]}</div>
        </div>
      </div>
    ),
  },
  { key: 'education', header: 'Education', className: 'text-ink-2', cell: (p) => p.education || '–' },
  { key: 'gender', header: 'Gender', className: 'text-ink-2', cell: (p) => genderLabel(p.gender) },
  { key: 'contests', header: 'Contests', className: 'tabular-nums text-ink-2', cell: (p) => p.candidate_count },
];

/** PAGE: Persons — master registry table + person panel at /persons/:id. `?q=` seeds the search. */
export default function Persons() {
  const [params] = useSearchParams();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/persons', editorDirty);
  const list = useResourceList<Record<string, never>>({
    key: 'persons',
    pageSize: PAGE_SIZE,
    initialFilters: {},
    initialSearch: params.get('q'),
    onLoad: async (page, search) => {
      const res = await getPersons(page, PAGE_SIZE, search || undefined);
      return { data: res.data || [], total: res.pagination?.total || 0 };
    },
  });

  return (
    <EntityPage
      header={<PageHeader title="Persons" count={list.total} subtitle="One record per politician, across elections" />}
      toolbar={
        <Toolbar>
          <SearchInput label="Search persons" placeholder="Search by name…" value={list.search} onChange={list.handleSearch} />
        </Toolbar>
      }
      table={
        <DataTable
          label="Persons"
          columns={COLUMNS}
          rows={list.items as PersonWithStats[]}
          rowKey={(p) => p.id}
          selectedKey={route.id}
          onRowClick={(p) => route.open(p.id)}
          loading={list.loading}
          empty={list.error
            ? <EmptyState title="Could not load persons" description={list.error} />
            : <EmptyState title="No persons match" description="Try a different name." />}
          footer={<Pager page={list.page} totalPages={list.totalPages} total={list.total} pageSize={PAGE_SIZE} noun="persons" onPage={list.loadPage} />}
        />
      }
      panel={route.id ? <PersonPanel key={route.id} id={route.id} onClose={() => route.close()} onChanged={list.refresh} /> : null}
    />
  );
}
```

- [ ] **Step 7: Mount it in `admin/src/App.tsx`.** Replace these three imports:

```tsx
import PersonManager from './pages/PersonManager';
import PersonDetail from './pages/PersonDetail';
import PersonEdit from './pages/PersonEdit';
```

with `import Persons from './pages/Persons';`. Then replace the `{/* Persons */}` route block with:

```tsx
                {/* Persons */}
                <Route path="persons/:id/edit" element={<EditRedirect base="/persons" />} />
                <Route path="persons/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Persons /></ProtectedRoute>} />
```

- [ ] **Step 8: Register the page as bare and add it to Tailwind.**
- In `Layout.tsx`, change `['/overrides', '/parties', '/elections']` to `['/overrides', '/parties', '/elections', '/persons']`.
- In `tailwind.css`, add this line after `@source "../pages/Elections.tsx";`:

```css
@source "../pages/Persons.tsx";
```

- [ ] **Step 9: Delete the old pages**

```bash
git rm admin/src/pages/PersonManager.tsx admin/src/pages/PersonDetail.tsx admin/src/pages/PersonEdit.tsx
grep -rnE "pages/Person(Manager|Detail|Edit)" admin/src
```

Expected: the grep prints nothing.

- [ ] **Step 10: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/hooks/usePersonEdit.test.tsx src/pages/Persons.test.tsx`
Expected: PASS (10 tests).

- [ ] **Step 11: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 12: Commit**

```bash
git add admin/src/pages/Persons.tsx admin/src/pages/Persons.test.tsx admin/src/components/entity/persons admin/src/hooks/usePersonEdit.ts admin/src/hooks/usePersonEdit.test.tsx admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: Persons as table + panel (?q= search, readable gender, merge into this record)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Candidates page (global election, seat select, link suggestions in the panel)

decisions.md scopes Candidates to one constituency, with no backend change:
- The toolbar has a searchable Seat select (default: the lowest seat number), the All / Linked / Unlinked chips with counts, and a name search within the seat.
- Link suggestions move from inline table rows into the panel.
- The old cross-election "search all candidates" box is **replaced by ⌘K** (Task 15). It is not lost.
- The old "Find" link (`/persons?q=`) becomes the panel's person search, pre-filled with the candidate's name. `/persons?q=` still works (Task 11).

**Files:**
- Create: `admin/src/pages/Candidates.tsx`
- Create: `admin/src/components/entity/candidates/CandidatePanel.tsx`, `admin/src/components/entity/ElectionMismatch.tsx`
- Modify: `admin/src/hooks/useCandidateManager.ts` (takes `electionId`, drops the election state, localStorage and global search), `admin/src/hooks/useCandidateEdit.ts` (dirty snapshot, `reset`, `refresh`, pre-filled person search)
- Modify: `admin/src/App.tsx`, `admin/src/components/Layout.tsx`, `admin/src/theme/tailwind.css`
- Delete: `admin/src/pages/CandidateManager.tsx`, `admin/src/pages/CandidateDetail.tsx`, `admin/src/pages/CandidateEdit.tsx`
- Test: `admin/src/hooks/useCandidateManager.test.tsx`, `admin/src/hooks/useCandidateEdit.test.tsx` (add a test), `admin/src/pages/Candidates.test.tsx`

**Interfaces:**
- Consumes: `useElection()` → `{ electionId, election, elections, loading, error, setElectionId }`, plus `Combobox` (Task 4), `ChipGroup` (Task 5), the entity scaffold (Task 8), and `shortElectionName(name, type, year)` from `components/shell/ElectionPicker.tsx`.
- Produces:
  - `useCandidateManager(electionId: string)` returns `{ constituencies, seatsLoading, selectedConst, setSelectedConst, personFilter, setPersonFilter, search, setSearch, candidates, counts: { all, linked, unlinked }, loading, linkingSuggestions: Map<string, LinkSuggestion>, selectedMatches, toggleMatch, handleLink(candidateId, matches): Promise<boolean>, handleUnlink, refresh }`.
    - `constituencies` are sorted by `const_no`.
    - `candidates` are filtered by the chip and the name search, with NOTA hidden.
    - `LinkSuggestion = { candidate: Candidate; matches: Candidate[] }` and `PersonFilter = 'all' | 'linked' | 'unlinked'` are exported.
  - `useCandidateEdit(id?)` adds `dirty`, `reset()` and `refresh()`. `personSearch` is pre-filled with the candidate's name while it is unlinked, and `loading` starts `true` when `id` is given.
  - `<ElectionMismatch recordElectionId />` renders nothing when the record is in the selected election. Otherwise it shows a notice with a "Switch election" button that calls `setElectionId`.
  - `<CandidatePanel id suggestion? selectedMatches? onToggleMatch onLinkSuggested onLoaded onChanged onClose />`.

- [ ] **Step 1: Write the failing hook tests.** `admin/src/hooks/useCandidateManager.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

const data = vi.hoisted(() => {
  const seat = (id: string, const_no: number, election_id: string) => ({ id, election_id, name: id, const_no, type: 'GEN', state_id: 1, district_id: null, region_id: null, voter_turnout: null, metadata: {} });
  const cand = (id: string, name: string, const_id: string, person_id: string | null = null, party_id = 'BJP') => ({
    id, person_id, election_id: 'e1', const_id, party_id, party: null, name, is_incumbent: false, metadata: {},
  });
  return {
    seats: { e1: [seat('s142', 142, 'e1'), seat('s1', 1, 'e1')], e2: [seat('k5', 5, 'e2')] } as Record<string, unknown[]>,
    cands: { s1: [cand('c1', 'Ravi Prasad', 's1', 'p1'), cand('c2', 'Anil Kumar', 's1'), cand('n', 'NOTA', 's1', null, 'NOTA')] } as Record<string, unknown[]>,
  };
});
vi.mock('../services/constituency.service', () => ({ getConstituencies: vi.fn(async (eid: string) => data.seats[eid] ?? []) }));
vi.mock('../services/candidate.service', () => ({
  getCandidates: vi.fn(async (_eid: string, cid: string) => data.cands[cid] ?? []),
  searchCandidates: vi.fn(async () => []),
  linkCandidatePerson: vi.fn(async () => ({})),
  unlinkCandidatePerson: vi.fn(async () => ({})),
}));
vi.mock('../services/person.api', () => ({ createPerson: vi.fn(async () => ({ id: 'p9' })) }));
import { useCandidateManager } from './useCandidateManager';
import { getCandidates } from '../services/candidate.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('useCandidateManager', () => {
  it('defaults to the lowest seat number, hides NOTA, and never writes per-page election keys', async () => {
    const { result } = renderHook(() => useCandidateManager('e1'), { wrapper });
    await waitFor(() => expect(result.current.selectedConst).toBe('s1'));
    await waitFor(() => expect(result.current.candidates.map((c) => c.id)).toEqual(['c1', 'c2']));
    expect(result.current.constituencies.map((c) => c.const_no)).toEqual([1, 142]);
    expect(getCandidates).not.toHaveBeenCalledWith('e1', '');
    expect(localStorage.getItem('admin_cand_election')).toBeNull();
    expect(localStorage.getItem('admin_cand_const')).toBeNull();
  });

  it('chips and the name search filter the seat; counts stay per seat', async () => {
    const { result } = renderHook(() => useCandidateManager('e1'), { wrapper });
    await waitFor(() => expect(result.current.candidates).toHaveLength(2));
    expect(result.current.counts).toEqual({ all: 2, linked: 1, unlinked: 1 });
    act(() => result.current.setPersonFilter('unlinked'));
    expect(result.current.candidates.map((c) => c.id)).toEqual(['c2']);
    act(() => { result.current.setPersonFilter('all'); result.current.setSearch('ravi'); });
    expect(result.current.candidates.map((c) => c.id)).toEqual(['c1']);
  });

  it('switching election resets the seat to that election\'s first seat', async () => {
    const { result, rerender } = renderHook(({ eid }) => useCandidateManager(eid), { wrapper, initialProps: { eid: 'e1' } });
    await waitFor(() => expect(result.current.selectedConst).toBe('s1'));
    rerender({ eid: 'e2' });
    await waitFor(() => expect(result.current.selectedConst).toBe('k5'));
    expect(getCandidates).not.toHaveBeenCalledWith('e2', 's1');
  });
});
```

Add to `admin/src/hooks/useCandidateEdit.test.tsx`:

```tsx
  it('is clean after load, pre-fills the person search with the name while unlinked, and reset drops edits', async () => {
    const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.candidate).not.toBeNull());
    expect(result.current.dirty).toBe(false);
    expect(result.current.personSearch).toBe('Ravi Prasad');
    act(() => result.current.setForm({ ...result.current.form, education: 'BA' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
  });
```

- [ ] **Step 2: Write the failing page test** `admin/src/pages/Candidates.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { Candidate } from '../types';

const data = vi.hoisted(() => {
  const seat = (id: string, const_no: number, name: string, election_id = 'e1') => ({ id, election_id, name, const_no, type: 'GEN', state_id: 1, district_id: null, region_id: null, voter_turnout: null, metadata: {} });
  return {
    seats: { e1: [seat('s142', 142, 'Patna Sahib'), seat('s1', 1, 'Valmiki Nagar')], e2: [seat('k5', 5, 'Kochi', 'e2')] } as Record<string, ReturnType<typeof seat>[]>,
    elections: [
      { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_url: null },
      { id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', year: 2021, status: 'Finalized', state_id: 2, tentative_next_date: null, manifest_url: null },
    ],
  };
});
const svc = vi.hoisted(() => ({
  getCandidates: vi.fn(),
  getCandidate: vi.fn(),
  searchCandidates: vi.fn(async (_q: string): Promise<unknown[]> => []),
  updateCandidate: vi.fn(async (_id: string, _data: Record<string, unknown>) => ({})),
  linkCandidatePerson: vi.fn(async (_c: string, _p: string) => ({})),
  unlinkCandidatePerson: vi.fn(async () => ({})),
}));
vi.mock('../services/candidate.service', () => svc);
const people = vi.hoisted(() => ({
  getPersons: vi.fn(async (..._args: unknown[]) => ({ success: true, data: [] as unknown[], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } })),
  createPerson: vi.fn(async () => ({ id: 'p9' })),
}));
vi.mock('../services/person.api', () => people);
vi.mock('../services/constituency.service', () => ({ getConstituencies: vi.fn(async (eid: string) => data.seats[eid] ?? []) }));
vi.mock('../services/geo.service', () => ({ getParties: vi.fn(async () => [{ id: 'BJP', name: 'Bharatiya Janata Party' }]) }));
const ctx = vi.hoisted(() => ({ setElectionId: vi.fn() }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({
    elections: data.elections, electionId: 'e1', election: data.elections[0], setElectionId: ctx.setElectionId,
    loading: false, error: null, reload: vi.fn(),
  }),
}));
import Candidates from './Candidates';
import { renderEntityPage } from '../test-utils/entity-harness';

const cand = (id: string, name: string, const_id: string, over: Partial<Candidate> = {}): Candidate => ({
  id, person_id: null, person: null, election_id: 'e1', const_id, party_id: 'BJP',
  party: { id: 'BJP', name: 'Bharatiya Janata Party', color: '#f59e0b', abbreviation: 'BJP' } as Candidate['party'],
  name, is_incumbent: false, metadata: { age: 50, criminal_cases: 0 }, ...over,
});
const ROWS: Record<string, Candidate[]> = {
  s1: [
    cand('c1', 'Ravi Prasad', 's1', { person_id: 'p1', person: { id: 'p1', name: 'Ravi Shankar Prasad', photo_url: null, gender: 'Male', education: null, date_of_birth: null } }),
    cand('c2', 'Anil Kumar', 's1', { metadata: { age: 44, criminal_cases: 2 } }),
    cand('nota', 'NOTA', 's1', { party_id: 'NOTA' }),
  ],
  s142: [cand('c9', 'Priya Kumari', 's142')],
};
const OTHER = { k1: cand('k1', 'Thomas Isaac', 'k5', { election_id: 'e2' }) };

beforeEach(() => {
  svc.getCandidates.mockImplementation(async (_e: string, cid: string) => ROWS[cid] ?? []);
  svc.getCandidate.mockImplementation(async (id: string) => {
    const c = Object.values(ROWS).flat().find((x) => x.id === id) ?? OTHER[id as 'k1'];
    const constituency = Object.values(data.seats).flat().find((s) => s.id === c.const_id);
    return { ...c, constituency };
  });
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/candidates') => renderEntityPage('/candidates', <Candidates />, at);
const where = () => screen.getByTestId('where').textContent;
const table = () => screen.getByRole('table', { name: 'Candidates' });
const seatInput = () => screen.getByRole('combobox', { name: 'Seat' }) as HTMLInputElement;

describe('Candidates page', () => {
  it('uses the global election, defaults to the lowest seat, hides NOTA, and filters by link state', async () => {
    renderAt();
    expect(await within(table()).findByText('Ravi Prasad')).toBeTruthy();
    expect(within(table()).queryByText('NOTA')).toBeNull();
    expect(seatInput().value).toBe('1 Valmiki Nagar');
    expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's1');
    fireEvent.click(screen.getByRole('button', { name: /^Unlinked/ }));
    expect(within(table()).queryByText('Ravi Prasad')).toBeNull();
    expect(within(table()).getByText('Anil Kumar')).toBeTruthy();
  });

  it('opening an unlinked candidate pre-fills the person search; Save sends no photo_url', async () => {
    renderAt();
    fireEvent.click(await within(table()).findByText('Anil Kumar'));
    expect(where()).toBe('/candidates/c2');
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    await waitFor(() => expect((within(panel).getByLabelText('Find a person') as HTMLInputElement).value).toBe('Anil Kumar'));
    await waitFor(() => expect(people.getPersons).toHaveBeenCalledWith(1, 10, 'Anil Kumar'));
    fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '45' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateCandidate).toHaveBeenCalled());
    const [id, payload] = svc.updateCandidate.mock.calls[0];
    expect(id).toBe('c2');
    expect(payload).not.toHaveProperty('photo_url');
    expect(payload.metadata).toEqual(expect.objectContaining({ age: 45, criminal_cases: 2 }));
  });

  it('a deep link to a candidate in another seat switches the Seat select to it', async () => {
    renderAt('/candidates/c9');
    await screen.findByRole('dialog', { name: 'Priya Kumari' });
    await waitFor(() => expect(seatInput().value).toBe('142 Patna Sahib'));
    const row = (await within(table()).findByText('Priya Kumari')).closest('tr')!;
    expect(row.getAttribute('aria-selected')).toBe('true');
    expect(svc.getCandidates).toHaveBeenCalledWith('e1', 's142');
  });

  it('a candidate from another election offers "Switch election"', async () => {
    renderAt('/candidates/k1');
    const panel = await screen.findByRole('dialog', { name: 'Thomas Isaac' });
    expect(within(panel).getByText(/This record is in Kerala VS 2021/)).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Switch election' }));
    expect(ctx.setElectionId).toHaveBeenCalledWith('e2');
  });

  it('same-name suggestions show in the panel (not the table) and link the checked matches', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    renderAt('/candidates/c2');
    expect(await within(table()).findByText('Suggestion')).toBeTruthy();
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    fireEvent.click(await within(panel).findByLabelText(/Kerala VS 2021 · BR_VS2020_VALMIKI/));
    fireEvent.click(within(panel).getByRole('button', { name: 'Link selected' }));
    await waitFor(() => expect(svc.linkCandidatePerson).toHaveBeenCalledWith('old', 'p9'));
    expect(people.createPerson).toHaveBeenCalledWith('Anil Kumar');
    expect(svc.linkCandidatePerson).toHaveBeenCalledWith('c2', 'p9');
  });

  it('linking is disabled while the form has unsaved edits (linking reloads the record)', async () => {
    svc.searchCandidates.mockImplementation(async (q: string) =>
      q === 'Anil Kumar' ? [cand('old', 'ANIL KUMAR', 'BR_VS2020_VALMIKI', { election_id: 'e2' })] : []);
    people.getPersons.mockResolvedValue({
      success: true,
      data: [{ id: 'p5', name: 'Anil Kumar', photo_url: null, gender: null, education: null, date_of_birth: null, candidate_count: 1, elections: [], state_id: null, state_name: null, region_id: null, region_name: null }],
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
    });
    renderAt('/candidates/c2');
    const panel = await screen.findByRole('dialog', { name: 'Anil Kumar' });
    const linkTo = await within(panel).findByRole('button', { name: 'Link to Anil Kumar' });
    const linkSelected = await within(panel).findByRole('button', { name: 'Link selected' });
    fireEvent.change(within(panel).getByLabelText('Age'), { target: { value: '45' } });
    expect((linkTo as HTMLButtonElement).disabled).toBe(true);
    expect((linkSelected as HTMLButtonElement).disabled).toBe(true);
    expect((within(panel).getByRole('button', { name: 'Create new person record' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(panel).getByText('Save or cancel your changes first.')).toBeTruthy();
  });

  it('"Open person" asks before leaving a panel with unsaved edits', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/candidates/c1');
    const panel = await screen.findByRole('dialog', { name: 'Ravi Prasad' });
    fireEvent.change(await within(panel).findByLabelText('Age'), { target: { value: '51' } });
    fireEvent.click(within(panel).getByRole('link', { name: /Open person/ }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(where()).toBe('/candidates/c1');
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/useCandidateManager.test.tsx src/hooks/useCandidateEdit.test.tsx src/pages/Candidates.test.tsx`
Expected: FAIL.
- The hook test fails with `expected '' to be 's1'`, because the hook still ignores its argument and reads localStorage.
- The edit test fails with `expected false to be true`.
- The page test fails with "Failed to resolve import './Candidates'".

- [ ] **Step 4: Rewrite `admin/src/hooks/useCandidateManager.ts`**

```ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getCandidates, searchCandidates, linkCandidatePerson, unlinkCandidatePerson } from '../services/candidate.service';
import { createPerson } from '../services/person.api';
import { getConstituencies } from '../services/constituency.service';
import { useToast } from '../context/ToastContext';
import type { Candidate, Constituency } from '../types';

export type PersonFilter = 'all' | 'linked' | 'unlinked';
export interface LinkSuggestion { candidate: Candidate; matches: Candidate[] }

const isNota = (c: Candidate) => c.party_id === 'NOTA' || c.name === 'NOTA';

/**
 * CONTROLLER: Candidate Manager (MVC)
 * Candidates of one seat in the global election, person-link filters, and same-name link suggestions.
 * Cross-election candidate search lives in the ⌘K palette.
 */
export function useCandidateManager(electionId: string) {
  const { toast, toastError } = useToast();

  // Seats are tagged with their election, so a render right after an election switch never pairs
  // the new election with the old election's seat (no getCandidates(newElection, oldSeat) call).
  const [seats, setSeats] = useState<{ electionId: string; list: Constituency[] }>({ electionId: '', list: [] });
  const constituencies = useMemo(() => (seats.electionId === electionId ? seats.list : []), [seats, electionId]);
  const [seatsLoading, setSeatsLoading] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedConst, setSelectedConst] = useState('');
  const [personFilter, setPersonFilter] = useState<PersonFilter>('all');
  const [search, setSearch] = useState('');

  const [linkingSuggestions, setLinkingSuggestions] = useState<Map<string, LinkSuggestion>>(new Map());
  const [selectedMatches, setSelectedMatches] = useState<Map<string, Set<string>>>(new Map());

  // Seats of the selected election, by seat number.
  useEffect(() => {
    let cancelled = false;
    if (!electionId) return;
    setSeatsLoading(true);
    getConstituencies(electionId)
      .then((list) => { if (!cancelled) setSeats({ electionId, list: [...list].sort((a, b) => a.const_no - b.const_no) }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setSeatsLoading(false); });
    return () => { cancelled = true; };
  }, [electionId]);

  // Default seat: the first by number whenever the current one is not in this election.
  useEffect(() => {
    if (constituencies.length > 0 && !constituencies.some((c) => c.id === selectedConst)) setSelectedConst(constituencies[0].id);
  }, [constituencies, selectedConst]);

  // Only load once the seat belongs to the loaded election; a request counter drops late responses.
  const seatReady = constituencies.some((c) => c.id === selectedConst);
  const requestRef = useRef(0);
  const loadCandidates = useCallback(async () => {
    const req = ++requestRef.current;
    if (!electionId || !seatReady) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getCandidates(electionId, selectedConst);
      if (req === requestRef.current) setCandidates(data.filter((c) => !isNota(c)));
    } catch {
      if (req === requestRef.current) setCandidates([]);
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, [electionId, selectedConst, seatReady]);

  useEffect(() => { loadCandidates(); }, [loadCandidates]);

  const constBaseName = useCallback((constId: string) => {
    const vsMatch = constId.match(/^[A-Z]+_VS\d*_(.+)$/);
    if (vsMatch) return vsMatch[1];
    return constId;
  }, []);

  // Same-name candidates in other elections, for each unlinked candidate (shown in the candidate panel).
  useEffect(() => {
    if (candidates.length === 0) return;
    const unlinked = candidates.filter(c => !c.person_id);
    if (unlinked.length === 0) {
      setLinkingSuggestions(new Map());
      setSelectedMatches(new Map());
      return;
    }

    const suggestions = new Map<string, LinkSuggestion>();
    const preselected = new Map<string, Set<string>>();
    let cancelled = false;

    (async () => {
      for (const c of unlinked) {
        if (cancelled) break;
        try {
          const results = await searchCandidates(c.name);
          const matches = results.filter(
            r => r.id !== c.id && r.election_id !== c.election_id &&
              r.name.toUpperCase().trim() === c.name.toUpperCase().trim(),
          );
          if (matches.length > 0) {
            suggestions.set(c.id, { candidate: c, matches });
            const myBase = constBaseName(c.const_id);
            const checked = new Set<string>();
            matches.forEach(m => {
              if (constBaseName(m.const_id) === myBase) checked.add(m.id);
            });
            preselected.set(c.id, checked);
          }
        } catch { /* one failed lookup must not stop the others */ }
      }
      if (!cancelled) {
        setLinkingSuggestions(new Map(suggestions));
        setSelectedMatches(new Map(preselected));
      }
    })();

    return () => { cancelled = true; };
  }, [candidates, constBaseName]);

  const toggleMatch = (candidateId: string, matchId: string) => {
    setSelectedMatches(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(candidateId) || []);
      if (set.has(matchId)) set.delete(matchId); else set.add(matchId);
      next.set(candidateId, set);
      return next;
    });
  };

  /** Link the candidate and its checked matches to one person (an existing match's, or a new one). */
  const handleLink = async (candidateId: string, matches: Candidate[]): Promise<boolean> => {
    const checked = selectedMatches.get(candidateId);
    const toLink = matches.filter(m => checked?.has(m.id));
    if (toLink.length === 0) { toast('Select at least one match to link', 'error'); return false; }

    try {
      let personId = toLink.find(m => m.person_id)?.person_id ?? undefined;
      if (!personId) {
        const candidate = candidates.find(c => c.id === candidateId);
        const person = await createPerson(candidate?.name || 'Unknown');
        personId = person.id;
      }

      await linkCandidatePerson(candidateId, personId);
      for (const match of toLink) {
        if (!match.person_id) await linkCandidatePerson(match.id, personId);
      }

      toast(`Successfully linked ${toLink.length + 1} records`);
      loadCandidates();
      return true;
    } catch (err) {
      toastError(err, 'Linking failed');
      return false;
    }
  };

  const handleUnlink = async (candidateId: string) => {
    if (!confirm('Unlink this candidate from the master record?')) return;
    try {
      await unlinkCandidatePerson(candidateId);
      toast('Candidate unlinked');
      loadCandidates();
    } catch (err) { toastError(err, 'Unlink failed'); }
  };

  const counts = useMemo(() => {
    const linked = candidates.filter((c) => !!c.person_id).length;
    return { all: candidates.length, linked, unlinked: candidates.length - linked };
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return candidates.filter((c) => {
      if (personFilter === 'linked' && !c.person_id) return false;
      if (personFilter === 'unlinked' && c.person_id) return false;
      return !q || c.name.toLowerCase().includes(q);
    });
  }, [candidates, personFilter, search]);

  return {
    constituencies, seatsLoading, selectedConst, setSelectedConst,
    personFilter, setPersonFilter, search, setSearch,
    candidates: filteredCandidates, counts, loading,
    linkingSuggestions, selectedMatches, toggleMatch, handleLink, handleUnlink,
    refresh: loadCandidates
  };
}
```

- [ ] **Step 5: Edit `admin/src/hooks/useCandidateEdit.ts`.**

Add a form type and an empty form above the hook:

```ts
export interface CandidateForm {
  name: string;
  party_id: string;
  age: string | number;
  gender: string;
  education: string;
  criminal_cases: string | number;
  assets: string;
}

const EMPTY_FORM: CandidateForm = { name: '', party_id: '', age: '', gender: '', education: '', criminal_cases: '', assets: '' };
```

Replace the `loading` and `form` state lines with:

```ts
  const [loading, setLoading] = useState(!!id);
  // The photo belongs to the linked person; it is shown read-only, never sent here.
  const [form, setForm] = useState<CandidateForm>(EMPTY_FORM);
  const [saved, setSaved] = useState<CandidateForm>(EMPTY_FORM);
```

In `loadData`, replace the `setForm({...})` call with:

```ts
      const next: CandidateForm = {
        name: c.name || '',
        party_id: c.party_id || '',
        age: meta.age ?? '',
        gender: meta.gender ?? '',
        education: meta.education ?? '',
        criminal_cases: meta.criminal_cases ?? '',
        assets: meta.assets ?? ''
      };
      setForm(next);
      setSaved(next);
      // Unlinked: start the person search with the candidate's name (the old table "Find" link).
      setPersonSearch(c.person_id ? '' : c.name);
```

Finally, replace the `return { … }` with:

```ts
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  /** Drop unsaved edits (panel Cancel). */
  const reset = () => setForm(saved);

  return {
    candidate, parties, loading, saving, form, setForm, dirty, reset, refresh: loadData,
    personSearch, setPersonSearch, personResults, isLinking,
    handleSave, linkToPerson, createMasterRecord, unlink
  };
```

- [ ] **Step 6: Create `admin/src/components/entity/ElectionMismatch.tsx`**

```tsx
import { useElection } from '../../context/ElectionContext';
import { shortElectionName } from '../shell/ElectionPicker';
import { Button } from '../ui/Button';

/** Deep link / ⌘K into a record of another election: say so, and offer to switch the global election. */
export function ElectionMismatch({ recordElectionId }: { recordElectionId: string }) {
  const { electionId, elections, setElectionId } = useElection();
  if (!recordElectionId || !electionId || recordElectionId === electionId) return null;
  const e = elections.find((x) => x.id === recordElectionId);
  const name = e ? shortElectionName(e.name, e.type, e.year) : 'another election';
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-card border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn-text">
      <span>This record is in {name}, not the election selected in the top bar.</span>
      <Button size="sm" variant="outline" onClick={() => setElectionId(recordElectionId)}>Switch election</Button>
    </div>
  );
}
```

- [ ] **Step 7: Create `admin/src/components/entity/candidates/CandidatePanel.tsx`**

```tsx
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useElection } from '../../../context/ElectionContext';
import { confirmDiscardEdits } from '../../../context/ShellStatusContext';
import { useCandidateEdit, type CandidateForm } from '../../../hooks/useCandidateEdit';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import type { LinkSuggestion } from '../../../hooks/useCandidateManager';
import { shortElectionName } from '../../shell/ElectionPicker';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { SearchInput } from '../../ui/Toolbar';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import { ElectionMismatch } from '../ElectionMismatch';
import type { Candidate } from '../../../types';

interface CandidatePanelProps {
  id: string;
  /** Same-name candidates in other elections (from the page's list hook), if any. */
  suggestion?: LinkSuggestion;
  selectedMatches?: Set<string>;
  onToggleMatch: (candidateId: string, matchId: string) => void;
  onLinkSuggested: (candidateId: string, matches: Candidate[]) => Promise<boolean>;
  /** Each loaded record (the page syncs the Seat select to it). Must be stable (a state setter). */
  onLoaded: (c: Candidate) => void;
  /** Saved or linking changed: refresh the table. */
  onChanged: () => void;
  onClose: () => void;
}

/** Candidate record: affidavit form, read-only person photo, and person-record linking (suggestions live here). */
export function CandidatePanel({ id, suggestion, selectedMatches, onToggleMatch, onLinkSuggested, onLoaded, onChanged, onClose }: CandidatePanelProps) {
  const ed = useCandidateEdit(id);
  const { elections } = useElection();
  useUnsavedGuard(ed.dirty);
  const c = ed.candidate;
  useEffect(() => { if (c) onLoaded(c); }, [c, onLoaded]);

  const { form, setForm } = ed;
  const set = (patch: Partial<CandidateForm>) => setForm({ ...form, ...patch });
  const electionName = (eid: string) => {
    const e = elections.find((x) => x.id === eid);
    return e ? shortElectionName(e.name, e.type, e.year) : eid;
  };
  const seatLabel = c?.constituency ? `${c.constituency.const_no} ${c.constituency.name}` : c?.const_id;

  const save = async () => { if (await ed.handleSave()) onChanged(); };
  const linkTo = async (personId: string) => { await ed.linkToPerson(personId); onChanged(); };
  const createMaster = async () => { await ed.createMasterRecord(); onChanged(); };
  const unlink = async () => { await ed.unlink(); onChanged(); };
  const linkSuggested = async () => {
    if (c && suggestion && await onLinkSuggested(c.id, suggestion.matches)) await ed.refresh();
  };
  // Every linking action reloads the record, which would silently drop unsaved form edits.
  const linkLocked = ed.dirty;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={c?.name ?? 'Candidate'}
      description={c ? `${electionName(c.election_id)} · ${seatLabel}` : undefined}
      footer={c ? <PanelFooter dirty={ed.dirty} saving={ed.saving} canSave={!!form.name.trim()} onCancel={ed.reset} onSave={save} /> : undefined}
    >
      {!c ? (
        ed.loading
          ? <p className="py-10 text-center text-sm text-muted">Loading candidate…</p>
          : <EmptyState title="Candidate not found" description="Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5">
          <ElectionMismatch recordElectionId={c.election_id} />

          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-lg font-semibold text-ink-2">
              {c.person?.photo_url ? <img src={c.person.photo_url} alt="" className="h-full w-full object-cover" /> : c.name.charAt(0)}
            </span>
            <div className="space-y-1">
              {c.is_incumbent && <Badge tone="warn">Incumbent</Badge>}
              <p className="text-[11px] text-muted">The photo comes from the linked person record.</p>
            </div>
          </div>

          <FormSection title="Details">
            <Field label="Name" error={form.name.trim() ? undefined : 'Name is required'}>
              <Input value={form.name} invalid={!form.name.trim()} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Party">
              <Select value={form.party_id} onChange={(e) => set({ party_id: e.target.value })}>
                <option value="">Independent</option>
                {ed.parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gender">
                <Select value={form.gender} onChange={(e) => set({ gender: e.target.value })}>
                  <option value="">Not specified</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </Select>
              </Field>
              <Field label="Age">
                <Input inputMode="numeric" value={form.age} onChange={(e) => set({ age: e.target.value })} />
              </Field>
            </div>
            <Field label="Education">
              <Input value={form.education} onChange={(e) => set({ education: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Criminal cases">
                <Input inputMode="numeric" value={form.criminal_cases} onChange={(e) => set({ criminal_cases: e.target.value })} />
              </Field>
              <Field label="Declared assets">
                <Input value={form.assets} onChange={(e) => set({ assets: e.target.value })} />
              </Field>
            </div>
          </FormSection>

          <FormSection title="Person record">
            {linkLocked && <p className="text-xs text-warn-text">Save or cancel your changes first.</p>}
            {c.person ? (
              <div className="flex items-start justify-between gap-3 rounded-card border border-accent/20 bg-accent-soft/50 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{c.person.name}</div>
                  <Link
                    to={`/persons/${c.person.id}`}
                    // An in-app link: neither beforeunload nor the sidebar guard sees it, so ask here.
                    onClick={(e) => { if (!confirmDiscardEdits(ed.dirty)) e.preventDefault(); }}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    Open person <ExternalLink size={12} aria-hidden />
                  </Link>
                </div>
                <Button size="sm" variant="danger" disabled={linkLocked} onClick={unlink}>Unlink</Button>
              </div>
            ) : (
              <>
                {suggestion && (
                  <div className="space-y-2 rounded-card border border-line p-3">
                    <p className="text-xs font-medium text-ink-2">Same name in other elections</p>
                    <ul className="space-y-1">
                      {suggestion.matches.map((m) => (
                        <li key={m.id}>
                          <label className="flex items-center gap-2 text-xs text-ink">
                            <input type="checkbox" checked={selectedMatches?.has(m.id) ?? false} onChange={() => onToggleMatch(c.id, m.id)} />
                            {electionName(m.election_id)} · {m.const_id}{m.person_id ? ' · has a person record' : ''}
                          </label>
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" variant="primary" disabled={linkLocked} onClick={linkSuggested}>Link selected</Button>
                  </div>
                )}
                <SearchInput label="Find a person" placeholder="Search persons…" value={ed.personSearch} onChange={ed.setPersonSearch} />
                <ul className="space-y-1.5">
                  {ed.personResults.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-control border border-line px-2.5 py-1.5">
                      <div className="min-w-0 text-xs">
                        <div className="truncate font-medium text-ink">{p.name}</div>
                        <div className="text-muted">{p.candidate_count} contests</div>
                      </div>
                      <Button size="sm" variant="outline" disabled={ed.isLinking || linkLocked} aria-label={`Link to ${p.name}`} onClick={() => linkTo(p.id)}>Link</Button>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" disabled={ed.isLinking || linkLocked} onClick={createMaster}>Create new person record</Button>
              </>
            )}
          </FormSection>
        </div>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 8: Create `admin/src/pages/Candidates.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { useCandidateManager, type PersonFilter } from '../hooks/useCandidateManager';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { shortElectionName } from '../components/shell/ElectionPicker';
import { EntityPage } from '../components/entity/EntityPage';
import { NoElection } from '../components/entity/NoElection';
import { CandidatePanel } from '../components/entity/candidates/CandidatePanel';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Combobox } from '../components/ui/Combobox';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import type { Candidate } from '../types';

type Meta = { age?: number | string | null; criminal_cases?: number | string | null };
const meta = (c: Candidate) => (c.metadata ?? {}) as Meta;

/** PAGE: Candidates — one seat of the global election at a time; candidate panel at /candidates/:id. */
export default function Candidates() {
  const { electionId, election, loading: electionsLoading, error } = useElection();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/candidates', editorDirty);
  const m = useCandidateManager(electionId);
  const [opened, setOpened] = useState<Candidate | null>(null);

  // Deep link / ⌘K: show the opened candidate's seat — only when the record (or election) changes,
  // so picking another seat afterwards is not undone.
  useEffect(() => {
    if (opened && opened.election_id === electionId && opened.const_id !== m.selectedConst) m.setSelectedConst(opened.const_id);
  }, [opened?.id, electionId]);

  const seatOptions = useMemo(
    () => m.constituencies.map((c) => ({ value: c.id, label: `${c.const_no} ${c.name}`, hint: c.type })),
    [m.constituencies],
  );
  const seat = m.constituencies.find((c) => c.id === m.selectedConst);

  if (!electionId) {
    return (
      <EntityPage
        header={<PageHeader title="Candidates" />}
        table={electionsLoading ? <p className="p-10 text-center text-sm text-muted">Loading elections…</p> : <NoElection error={error} />}
      />
    );
  }

  const columns: Column<Candidate>[] = [
    {
      key: 'name',
      header: 'Candidate',
      cell: (c) => (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.party?.color || 'var(--color-line-strong)' }} aria-hidden />
          <span className="font-medium text-ink">{c.name}</span>
          {c.is_incumbent && <Badge tone="warn">Incumbent</Badge>}
        </div>
      ),
    },
    { key: 'party', header: 'Party', cell: (c) => <Badge tone="muted">{c.party?.abbreviation || c.party_id || 'IND'}</Badge> },
    { key: 'age', header: 'Age', className: 'tabular-nums text-ink-2', cell: (c) => meta(c).age ?? '–' },
    {
      key: 'cases',
      header: 'Cases',
      className: 'tabular-nums',
      cell: (c) => {
        const n = Number(meta(c).criminal_cases ?? 0);
        return <span className={n > 0 ? 'font-medium text-bad-text' : 'text-ink-2'}>{n}</span>;
      },
    },
    {
      key: 'person',
      header: 'Person',
      cell: (c) => c.person_id
        ? <Badge tone="ok">Linked</Badge>
        : m.linkingSuggestions.has(c.id) ? <Badge tone="accent">Suggestion</Badge> : <Badge tone="muted">Unlinked</Badge>,
    },
  ];

  const subtitle = [election ? shortElectionName(election.name, election.type, election.year) : null, seat ? `${seat.const_no} ${seat.name}` : null]
    .filter(Boolean).join(' · ');

  return (
    <EntityPage
      header={<PageHeader title="Candidates" count={m.counts.all} subtitle={subtitle} />}
      toolbar={
        <Toolbar>
          <Combobox label="Seat" className="w-64" options={seatOptions} value={m.selectedConst} onChange={m.setSelectedConst} placeholder="Find a seat…" />
          <ChipGroup<PersonFilter>
            label="Person link"
            value={m.personFilter}
            onChange={m.setPersonFilter}
            options={[
              { value: 'all', label: 'All', count: m.counts.all },
              { value: 'linked', label: 'Linked', count: m.counts.linked },
              { value: 'unlinked', label: 'Unlinked', count: m.counts.unlinked },
            ]}
          />
          <SearchInput label="Search names in this seat" placeholder="Search names in this seat…" value={m.search} onChange={m.setSearch} />
        </Toolbar>
      }
      table={
        <DataTable
          label="Candidates"
          columns={columns}
          rows={m.candidates}
          rowKey={(c) => c.id}
          selectedKey={route.id}
          onRowClick={(c) => route.open(c.id)}
          loading={m.loading || m.seatsLoading}
          empty={m.constituencies.length === 0
            ? <EmptyState title="No seats in this election" description="Add constituencies to this election first." />
            : <EmptyState title="No candidates match" description="Try another seat, filter or name." />}
        />
      }
      panel={route.id ? (
        <CandidatePanel
          key={route.id}
          id={route.id}
          suggestion={m.linkingSuggestions.get(route.id)}
          selectedMatches={m.selectedMatches.get(route.id)}
          onToggleMatch={m.toggleMatch}
          onLinkSuggested={m.handleLink}
          onLoaded={setOpened}
          onChanged={m.refresh}
          onClose={() => route.close()}
        />
      ) : null}
    />
  );
}
```

- [ ] **Step 9: Mount it in `admin/src/App.tsx`.** Replace these three imports:

```tsx
import CandidateManager from './pages/CandidateManager';
import CandidateDetail from './pages/CandidateDetail';
import CandidateEdit from './pages/CandidateEdit';
```

with `import Candidates from './pages/Candidates';`. Then replace the `{/* Candidates */}` route block with:

```tsx
                {/* Candidates */}
                <Route path="candidates/:id/edit" element={<EditRedirect base="/candidates" />} />
                <Route path="candidates/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Candidates /></ProtectedRoute>} />
```

- [ ] **Step 10: Register the page as bare and add it to Tailwind.**
- In `Layout.tsx`, change `['/overrides', '/parties', '/elections', '/persons']` to `['/overrides', '/parties', '/elections', '/persons', '/candidates']`.
- In `tailwind.css`, add this line after `@source "../pages/Persons.tsx";`:

```css
@source "../pages/Candidates.tsx";
```

- [ ] **Step 11: Delete the old pages**

```bash
git rm admin/src/pages/CandidateManager.tsx admin/src/pages/CandidateDetail.tsx admin/src/pages/CandidateEdit.tsx
grep -rnE "pages/Candidate(Manager|Detail|Edit)|admin_cand_" admin/src
```

Expected: the grep prints nothing.

- [ ] **Step 12: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/hooks/useCandidateManager.test.tsx src/hooks/useCandidateEdit.test.tsx src/pages/Candidates.test.tsx`
Expected: PASS (12 tests).

- [ ] **Step 13: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 14: Manual check against `docs/design/admin/candidates.png`.**
- Switch the top-bar election. The Seat select resets to the lowest seat.
- Type a seat name into the Seat select.
- Open an unlinked candidate. Check that the "Same name in other elections" suggestions appear in the panel.
- Check that the table rows stay single-line (no inline suggestion rows).

- [ ] **Step 15: Commit**

```bash
git add admin/src/pages/Candidates.tsx admin/src/pages/Candidates.test.tsx admin/src/components/entity/candidates admin/src/components/entity/ElectionMismatch.tsx admin/src/hooks/useCandidateManager.ts admin/src/hooks/useCandidateManager.test.tsx admin/src/hooks/useCandidateEdit.ts admin/src/hooks/useCandidateEdit.test.tsx admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: Candidates on the global election with seat select; link suggestions in the panel

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Constituencies page (global election, pager, visible-row bulk tag)

This task fixes decisions.md bug 6. The list was unreachable past 100 rows, so it gets a pager.
- `GET /admin/constituencies/list/:electionId` only accepts `page`, `limit` and `q` (`AdminConstituenciesQueryDto`). So the district and tag filters stay client-side and are labelled "(this page)".
- "Select all" and bulk tag act on the **visible** rows only.
- The selection clears when the page, search, filter or election changes.
- A new search goes back to page 1.

**Files:**
- Create: `admin/src/pages/Constituencies.tsx`
- Create: `admin/src/components/entity/constituencies/ConstituencyPanel.tsx`, `admin/src/components/entity/constituencies/tags.ts`
- Modify: `admin/src/hooks/useConstituencyManager.ts`
- Modify: `admin/src/App.tsx`, `admin/src/components/Layout.tsx`, `admin/src/theme/tailwind.css`
- Delete: `admin/src/pages/ConstituencyManager.tsx`, `admin/src/pages/ConstituencyDetail.tsx`, `admin/src/pages/ConstituencyEdit.tsx`
- Test: `admin/src/hooks/useConstituencyManager.test.tsx`, `admin/src/pages/Constituencies.test.tsx`

**Interfaces:**
- Consumes:
  - `useConstituencyEditor(id)` (Task 3: `fieldErrors`, the 0-safe numbers, the seat-number guard)
  - `useSelection<T>(items)` → `{ selectedIds, toggle, selectAll, clear, count, isAllSelected }`
  - `ElectionMismatch` (Task 12) and the entity scaffold (Task 8)
- Produces:
  - `CONSTITUENCY_PAGE_SIZE = 100`.
  - `useConstituencyManager(electionId: string)` returns `{ constituencies (filtered page), loading, search, setSearch, districtFilter, setDistrictFilter, tagFilter, setTagFilter, page, totalPages, total, allDistricts, allTags, selection, computing, bulkAddTag, computeAnalysis, loadPage, refresh }`.
    - `setSearch` resets to page 1.
    - Switching election starts at page 1.
  - `TAG_PALETTE: string[]` (15 values), `BULK_TAGS: string[]` (the 5 old bulk tags), and `tagLabel(tag): string` (`'yadav_dominated' → 'Yadav dominated'`).
  - `<ConstituencyPanel id onClose onSaved />`.

- [ ] **Step 1: Write the failing hook test** `admin/src/hooks/useConstituencyManager.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ToastProvider } from '../context/ToastContext';

const data = vi.hoisted(() => {
  const C = (id: string, no: number, district: string, tags: string[] = []) => ({
    id, election_id: 'e1', name: id, const_no: no, type: 'GEN', state_id: 1, district_id: 1,
    district: { id: 1, name: district, code: 'x' }, region_id: null, region: null, voter_turnout: null, metadata: { tags },
  });
  return { page1: [C('a', 1, 'Patna'), C('b', 2, 'Patna', ['urban']), C('c', 3, 'Gaya')], page2: [C('z', 101, 'Gaya')] };
});
vi.mock('../services/constituency.service', () => ({
  getAdminConstituencies: vi.fn(async (_e: string, page: number) => ({
    success: true, data: page === 1 ? data.page1 : data.page2, pagination: { page, limit: 100, total: 243, totalPages: 3 },
  })),
  bulkTagConstituencies: vi.fn(async () => []),
  computeConstituencyAnalysis: vi.fn(async () => ({ computed: 0 })),
}));
import { useConstituencyManager } from './useConstituencyManager';
import { getAdminConstituencies, bulkTagConstituencies } from '../services/constituency.service';

const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
afterEach(() => { vi.clearAllMocks(); localStorage.clear(); });

describe('useConstituencyManager', () => {
  it('pages, and a new search goes back to page 1', async () => {
    const { result } = renderHook(() => useConstituencyManager('e1'), { wrapper });
    await waitFor(() => expect(result.current.constituencies).toHaveLength(3));
    expect(result.current.totalPages).toBe(3);
    act(() => result.current.loadPage(2));
    await waitFor(() => expect(getAdminConstituencies).toHaveBeenLastCalledWith('e1', 2, 100, undefined));
    act(() => result.current.setSearch('pat'));
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(getAdminConstituencies).toHaveBeenLastCalledWith('e1', 1, 100, 'pat'));
  });

  it('select all and bulk tag act on the visible rows only; a filter change clears the selection', async () => {
    const { result } = renderHook(() => useConstituencyManager('e1'), { wrapper });
    await waitFor(() => expect(result.current.constituencies).toHaveLength(3));
    act(() => result.current.setDistrictFilter('Patna'));
    expect(result.current.constituencies.map((c) => c.id)).toEqual(['a', 'b']);
    act(() => result.current.selection.selectAll());
    expect([...result.current.selection.selectedIds]).toEqual(['a', 'b']);
    await act(() => result.current.bulkAddTag('rural'));
    expect(bulkTagConstituencies).toHaveBeenCalledWith(['a', 'b'], ['rural'], []);
    act(() => result.current.selection.selectAll());
    act(() => result.current.setDistrictFilter('Gaya'));
    expect(result.current.selection.count).toBe(0);
  });

  it('switching election starts again at page 1', async () => {
    const { result, rerender } = renderHook(({ eid }) => useConstituencyManager(eid), { wrapper, initialProps: { eid: 'e1' } });
    await waitFor(() => expect(result.current.constituencies).toHaveLength(3));
    act(() => result.current.loadPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));
    rerender({ eid: 'e2' });
    expect(result.current.page).toBe(1);
    await waitFor(() => expect(getAdminConstituencies).toHaveBeenLastCalledWith('e2', 1, 100, undefined));
    expect(getAdminConstituencies).not.toHaveBeenCalledWith('e2', 3, 100, undefined);
  });
});
```

- [ ] **Step 2: Write the failing page test** `admin/src/pages/Constituencies.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

const data = vi.hoisted(() => {
  const C = (id: string, no: number, name: string, district: string, tags: string[] = []) => ({
    id, election_id: 'e1', name, const_no: no, type: 'GEN', state_id: 1, district_id: 1,
    district: { id: 1, name: district, code: 'x' }, region_id: null, region: null, voter_turnout: null, metadata: { tags },
  });
  return {
    C,
    page1: [C('a', 1, 'Patna Sahib', 'Patna', ['urban']), C('b', 2, 'Bankipur', 'Patna'), C('c', 3, 'Gaya Town', 'Gaya')],
    elections: [{ id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_url: null }],
  };
});
const svc = vi.hoisted(() => ({
  getAdminConstituencies: vi.fn(),
  bulkTagConstituencies: vi.fn(async () => []),
  computeConstituencyAnalysis: vi.fn(async () => ({ computed: 0 })),
  getAdminConstituencyDetail: vi.fn(),
  updateConstituency: vi.fn(async () => ({})),
}));
vi.mock('../services/constituency.service', () => svc);
vi.mock('../services/geo.service', () => ({ getDistricts: vi.fn(async () => [{ id: 1, name: 'Patna', code: 'x' }]), getRegions: vi.fn(async () => []) }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({ elections: data.elections, electionId: 'e1', election: data.elections[0], setElectionId: vi.fn(), loading: false, error: null, reload: vi.fn() }),
}));
import Constituencies from './Constituencies';
import { renderEntityPage } from '../test-utils/entity-harness';

beforeEach(() => {
  svc.getAdminConstituencies.mockImplementation(async (_e: string, page: number) => ({
    success: true, data: page === 1 ? data.page1 : [data.C('z', 101, 'Page Two Seat', 'Gaya')], pagination: { page, limit: 100, total: 243, totalPages: 3 },
  }));
  svc.getAdminConstituencyDetail.mockImplementation(async (id: string) => ({
    ...data.page1.find((c) => c.id === id)!, metadata: { population: 1000, tags: ['urban'] }, analysis: null,
  }));
});
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/constituencies') => renderEntityPage('/constituencies', <Constituencies />, at);
const table = () => screen.getByRole('table', { name: 'Constituencies' });

describe('Constituencies page', () => {
  it('pages past the first 100 seats; a new search goes back to page 1', async () => {
    renderAt();
    await within(table()).findByText('Patna Sahib');
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await within(table()).findByText('Page Two Seat')).toBeTruthy();
    expect(svc.getAdminConstituencies).toHaveBeenLastCalledWith('e1', 2, 100, undefined);
    fireEvent.change(screen.getByLabelText('Search seats'), { target: { value: 'pat' } });
    await waitFor(() => expect(svc.getAdminConstituencies).toHaveBeenLastCalledWith('e1', 1, 100, 'pat'));
  });

  it('with a district filter, select all and bulk tag touch only the visible rows', async () => {
    renderAt();
    await within(table()).findByText('Patna Sahib');
    fireEvent.change(screen.getByLabelText('District (this page)'), { target: { value: 'Patna' } });
    expect(within(table()).queryByText('Gaya Town')).toBeNull();
    expect(screen.getByText(/district and tag filters apply to this page/)).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Select all on this page'));
    expect(screen.getByText('2 selected')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Add tag to selected'), { target: { value: 'rural' } });
    await waitFor(() => expect(svc.bulkTagConstituencies).toHaveBeenCalledWith(['a', 'b'], ['rural'], []));
  });

  it('a row checkbox selects without opening the panel', async () => {
    renderAt();
    fireEvent.click(await screen.findByLabelText('Select Bankipur'));
    expect(screen.getByText('1 selected')).toBeTruthy();
    expect(screen.getByTestId('where').textContent).toBe('/constituencies');
  });

  it('the panel saves 0 as 0 and shows an invalid seat number inline without sending it', async () => {
    renderAt('/constituencies/a');
    const panel = await screen.findByRole('dialog', { name: 'Patna Sahib' });
    fireEvent.change(await within(panel).findByLabelText('Urban %'), { target: { value: '0' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(svc.updateConstituency).toHaveBeenCalledWith('a', expect.objectContaining({
      const_no: 1, metadata: expect.objectContaining({ urban_pct: 0, population: 1000 }),
    })));
    await waitFor(() => expect(within(panel).getByText('No changes')).toBeTruthy());
    fireEvent.change(within(panel).getByLabelText('Seat number'), { target: { value: 'abc' } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Save changes' }));
    expect(await within(panel).findByText('Enter a whole number, 1 or more')).toBeTruthy();
    expect(svc.updateConstituency).toHaveBeenCalledTimes(1);
  });

  it('tags are added with Enter and removed in the panel', async () => {
    renderAt('/constituencies/a');
    const panel = await screen.findByRole('dialog', { name: 'Patna Sahib' });
    const input = await within(panel).findByLabelText('Add a tag');
    fireEvent.change(input, { target: { value: 'flood_prone' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(within(panel).getByText('Flood prone')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Remove tag Urban' }));
    expect(within(panel).queryByText('Urban')).toBeNull();
    expect(within(panel).getByText('Unsaved changes')).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run the tests to confirm they fail**

Run: `cd admin && npx vitest run src/hooks/useConstituencyManager.test.tsx src/pages/Constituencies.test.tsx`
Expected: FAIL.
- The hook test fails with `expected [] to have a length of 3`, because the hook still reads `admin_const_election` and ignores its argument.
- The page test fails with "Failed to resolve import './Constituencies'".

- [ ] **Step 4: Rewrite `admin/src/hooks/useConstituencyManager.ts`**

```ts
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { getAdminConstituencies, bulkTagConstituencies, computeConstituencyAnalysis } from '../services/constituency.service';
import { useToast } from '../context/ToastContext';
import { useSelection } from './useSelection';
import type { Constituency } from '../types';

export const CONSTITUENCY_PAGE_SIZE = 100;

/**
 * CONTROLLER: Constituency Manager (MVC)
 * One page of the global election's seats (server search + paging), client-side district/tag filters on that
 * page, and bulk tagging of the visible rows.
 */
export function useConstituencyManager(electionId: string) {
  const { toast, toastError } = useToast();

  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearchState] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [total, setTotal] = useState(0);
  const [computing, setComputing] = useState(false);

  // The page belongs to one election: switching election reads page 1 at once (no fetch of the old page number).
  const [pageState, setPageState] = useState({ electionId, page: 1 });
  const page = pageState.electionId === electionId ? pageState.page : 1;
  const setPage = useCallback((p: number) => setPageState({ electionId, page: Math.max(1, p) }), [electionId]);
  const setSearch = (s: string) => { setSearchState(s); setPageState({ electionId, page: 1 }); };

  // A request counter drops late responses (fast typing, quick paging).
  const requestRef = useRef(0);
  const loadData = useCallback(async () => {
    const req = ++requestRef.current;
    if (!electionId) {
      setConstituencies([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const response = await getAdminConstituencies(electionId, page, CONSTITUENCY_PAGE_SIZE, search || undefined);
      if (req !== requestRef.current) return;
      setConstituencies(response.data);
      setTotal(response.pagination.total);
    } catch (err) {
      if (req === requestRef.current) toastError(err, 'Failed to load constituencies');
    } finally {
      if (req === requestRef.current) setLoading(false);
    }
  }, [electionId, page, search, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const allDistricts = useMemo(() => {
    const set = new Set<string>();
    constituencies.forEach(c => { if (c.district?.name) set.add(c.district.name); });
    return Array.from(set).sort();
  }, [constituencies]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    constituencies.forEach(c => {
      const tags = (c.metadata?.tags as string[]) || [];
      tags.forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [constituencies]);

  const filteredConstituencies = useMemo(() => {
    return constituencies.filter(c => {
      if (districtFilter && c.district?.name !== districtFilter) return false;
      if (tagFilter) {
        const tags = (c.metadata?.tags as string[]) || [];
        if (!tags.includes(tagFilter)) return false;
      }
      return true;
    });
  }, [constituencies, districtFilter, tagFilter]);

  // Select-all and bulk tag act on the visible (filtered) rows only; any change of what is visible clears it.
  const selection = useSelection<Constituency>(filteredConstituencies);
  const { clear } = selection;
  useEffect(() => { clear(); }, [electionId, page, search, districtFilter, tagFilter, clear]);

  const bulkAddTag = async (tag: string) => {
    if (selection.selectedIds.size === 0 || !tag) return;
    try {
      await bulkTagConstituencies(Array.from(selection.selectedIds), [tag], []);
      toast('Bulk tag applied');
      loadData();
      selection.clear();
    } catch (err) {
      toastError(err, 'Bulk tag failed');
    }
  };

  const computeAnalysis = async () => {
    if (!electionId || computing) return;
    setComputing(true);
    try {
      await computeConstituencyAnalysis(electionId, []);
      toast('Analysis computation queued');
    } catch (err) {
      toastError(err, 'Failed to start computation');
    } finally {
      setComputing(false);
    }
  };

  return {
    constituencies: filteredConstituencies, loading,
    search, setSearch, districtFilter, setDistrictFilter, tagFilter, setTagFilter,
    page, totalPages: Math.max(1, Math.ceil(total / CONSTITUENCY_PAGE_SIZE)), total,
    allDistricts, allTags, selection, computing,
    bulkAddTag, computeAnalysis, loadPage: setPage, refresh: loadData
  };
}
```

- [ ] **Step 5: Create `admin/src/components/entity/constituencies/tags.ts`**

```ts
/** Suggested tags in the panel's tag input (free text is also allowed). */
export const TAG_PALETTE = [
  'yadav_dominated', 'bhumihar_dominated', 'rajput_dominated', 'kurmi_belt', 'ebc_majority', 'dalit_stronghold',
  'muslim_majority', 'muslim_significant', 'mixed_religious',
  'urban', 'semi_urban', 'rural', 'border', 'flood_prone', 'naxal_affected',
];

/** Tags offered by the toolbar's bulk "Add tag" select (unchanged from the old page). */
export const BULK_TAGS = ['yadav_dominated', 'bhumihar_dominated', 'kurmi_belt', 'urban', 'rural'];

/** 'yadav_dominated' → 'Yadav dominated' (sentence case; the stored value is unchanged). */
export function tagLabel(tag: string): string {
  const s = tag.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
```

- [ ] **Step 6: Create `admin/src/components/entity/constituencies/ConstituencyPanel.tsx`**

```tsx
import { useId, useState } from 'react';
import { X } from 'lucide-react';
import { useConstituencyEditor } from '../../../hooks/useConstituencyEditor';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { Sheet } from '../../ui/Sheet';
import { Field, FormSection } from '../../ui/Field';
import { Input, Select } from '../../ui/Input';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import { ElectionMismatch } from '../ElectionMismatch';
import { TAG_PALETTE, tagLabel } from './tags';

type SeatHistory = Array<{ year: number; party: string; candidate: string }>;

/** Constituency record: demographics, administrative fields, tags, and read-only seat history. */
export function ConstituencyPanel({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const ed = useConstituencyEditor(id);
  const c = ed.constituency;
  useUnsavedGuard(ed.isDirty);
  const listId = useId();
  const [tagInput, setTagInput] = useState('');

  const demo = (patch: Partial<typeof ed.editDemographics>) => { ed.setEditDemographics({ ...ed.editDemographics, ...patch }); ed.markDirty(); };
  const admin = (patch: Partial<typeof ed.adminInfo>) => { ed.setAdminInfo({ ...ed.adminInfo, ...patch }); ed.markDirty(); };
  const addTag = () => { const t = tagInput.trim(); if (t) ed.addTag(t); setTagInput(''); };
  const save = async () => { if (await ed.handleSave()) onSaved(); };
  const tags = (c?.metadata?.tags as string[] | undefined) ?? [];
  const history = ((c?.analysis?.incumbency ?? {}) as { seat_history?: SeatHistory }).seat_history ?? [];

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={c?.name ?? 'Constituency'}
      description={c ? `#${c.const_no} · ${c.type}${c.election ? ` · ${c.election.name}` : ''}` : undefined}
      // Cancel reloads the record: tags are edited on the loaded record itself.
      footer={c ? <PanelFooter dirty={ed.isDirty} saving={ed.saving} onCancel={() => { void ed.refresh(); }} onSave={save} /> : undefined}
    >
      {!c ? (
        ed.loading
          ? <p className="py-10 text-center text-sm text-muted">Loading constituency…</p>
          : <EmptyState title="Constituency not found" description="Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5">
          <ElectionMismatch recordElectionId={c.election_id} />

          <FormSection title="Demographics">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Population"><Input inputMode="numeric" value={ed.editDemographics.population} onChange={(e) => demo({ population: e.target.value })} /></Field>
              <Field label="Literacy %"><Input inputMode="decimal" value={ed.editDemographics.literacy_pct} onChange={(e) => demo({ literacy_pct: e.target.value })} /></Field>
              <Field label="Urban %"><Input inputMode="decimal" value={ed.editDemographics.urban_pct} onChange={(e) => demo({ urban_pct: e.target.value })} /></Field>
              <Field label="SC/ST %"><Input inputMode="decimal" value={ed.editDemographics.sc_st_pct} onChange={(e) => demo({ sc_st_pct: e.target.value })} /></Field>
            </div>
            <Field label="Dominant castes"><Input value={ed.editDemographics.dominant_castes} onChange={(e) => demo({ dominant_castes: e.target.value })} /></Field>
            <Field label="Religions"><Input value={ed.editDemographics.religions} onChange={(e) => demo({ religions: e.target.value })} /></Field>
          </FormSection>

          <FormSection title="Administrative">
            <Field label="District">
              <Select value={String(ed.adminInfo.district_id)} onChange={(e) => admin({ district_id: e.target.value })}>
                <option value="">No district</option>
                {ed.districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label="Region">
              <Select value={String(ed.adminInfo.region_id)} onChange={(e) => admin({ region_id: e.target.value })}>
                <option value="">No region</option>
                {ed.regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Seat number" error={ed.fieldErrors.const_no}>
                <Input inputMode="numeric" invalid={!!ed.fieldErrors.const_no} value={ed.adminInfo.const_no} onChange={(e) => admin({ const_no: e.target.value })} />
              </Field>
              <Field label="Phase"><Input value={ed.adminInfo.phase} onChange={(e) => admin({ phase: e.target.value })} /></Field>
            </div>
          </FormSection>

          <FormSection title="Tags">
            {tags.length === 0 && <p className="text-xs text-muted">No tags yet.</p>}
            <ul className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <li key={t}>
                  <Badge tone="muted" className="gap-1">
                    {tagLabel(t)}
                    <button type="button" aria-label={`Remove tag ${tagLabel(t)}`} onClick={() => ed.removeTag(t)} className="text-muted hover:text-ink">
                      <X size={12} aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input
                aria-label="Add a tag"
                list={listId}
                value={tagInput}
                placeholder="e.g. urban"
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
              />
              <datalist id={listId}>{TAG_PALETTE.map((t) => <option key={t} value={t} />)}</datalist>
              <Button variant="outline" onClick={addTag}>Add</Button>
            </div>
          </FormSection>

          <FormSection title="Seat history">
            {history.length === 0
              ? <p className="text-xs text-muted">No history computed yet. Use "Compute analysis" on the list.</p>
              : (
                <ul className="divide-y divide-line">
                  {history.map((h, i) => (
                    <li key={`${h.year}-${i}`} className="flex items-center gap-3 py-2 text-sm">
                      <span className="w-12 font-mono text-xs text-muted">{h.year}</span>
                      <span className="font-medium text-ink">{h.party}</span>
                      <span className="truncate text-ink-2">{h.candidate}</span>
                    </li>
                  ))}
                </ul>
              )}
          </FormSection>
        </div>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 7: Create `admin/src/pages/Constituencies.tsx`**

```tsx
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { CONSTITUENCY_PAGE_SIZE, useConstituencyManager } from '../hooks/useConstituencyManager';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { shortElectionName } from '../components/shell/ElectionPicker';
import { EntityPage } from '../components/entity/EntityPage';
import { NoElection } from '../components/entity/NoElection';
import { ConstituencyPanel } from '../components/entity/constituencies/ConstituencyPanel';
import { BULK_TAGS, tagLabel } from '../components/entity/constituencies/tags';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import type { Constituency } from '../types';

/** PAGE: Constituencies — seats of the global election, 100 per page; panel at /constituencies/:id. */
export default function Constituencies() {
  const { electionId, election, loading: electionsLoading, error } = useElection();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/constituencies', editorDirty);
  const m = useConstituencyManager(electionId);
  const sel = m.selection;

  if (!electionId) {
    return (
      <EntityPage
        header={<PageHeader title="Constituencies" />}
        table={electionsLoading ? <p className="p-10 text-center text-sm text-muted">Loading elections…</p> : <NoElection error={error} />}
      />
    );
  }

  const columns: Column<Constituency>[] = [
    {
      key: 'select',
      header: <input type="checkbox" aria-label="Select all on this page" checked={sel.isAllSelected} onChange={sel.selectAll} />,
      headerClassName: 'w-10',
      cell: (c) => (
        <input type="checkbox" aria-label={`Select ${c.name}`} checked={sel.selectedIds.has(c.id)} onChange={() => sel.toggle(c.id)} onClick={(e) => e.stopPropagation()} />
      ),
    },
    { key: 'no', header: 'No.', className: 'w-14 font-mono text-xs text-muted', cell: (c) => c.const_no },
    { key: 'name', header: 'Seat', cell: (c) => <div><div className="font-medium text-ink">{c.name}</div><div className="text-[11px] text-muted">{c.type}</div></div> },
    {
      key: 'district',
      header: 'District / region',
      cell: (c) => <div><div className="text-ink-2">{c.district?.name || '–'}</div><div className="text-[11px] text-muted">{c.region?.name || '–'}</div></div>,
    },
    {
      key: 'tags',
      header: 'Tags',
      cell: (c) => {
        const tags = (c.metadata?.tags as string[] | undefined) ?? [];
        return (
          <div className="flex flex-wrap items-center gap-1">
            {tags.slice(0, 3).map((t) => <Badge key={t} tone="muted">{tagLabel(t)}</Badge>)}
            {tags.length > 3 && <span className="text-[11px] text-muted">+{tags.length - 3}</span>}
          </div>
        );
      },
    },
  ];
  const filtered = !!(m.districtFilter || m.tagFilter);

  return (
    <EntityPage
      header={
        <PageHeader
          title="Constituencies"
          count={m.total}
          subtitle={election ? shortElectionName(election.name, election.type, election.year) : undefined}
          actions={<Button variant="outline" disabled={m.computing} onClick={m.computeAnalysis}>{m.computing ? 'Computing…' : 'Compute analysis'}</Button>}
        />
      }
      toolbar={
        <Toolbar>
          <SearchInput label="Search seats" placeholder="Search by name or number…" value={m.search} onChange={m.setSearch} />
          <Select aria-label="District (this page)" className="w-52" value={m.districtFilter} onChange={(e) => m.setDistrictFilter(e.target.value)}>
            <option value="">All districts (this page)</option>
            {m.allDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
          <Select aria-label="Tag (this page)" className="w-48" value={m.tagFilter} onChange={(e) => m.setTagFilter(e.target.value)}>
            <option value="">All tags (this page)</option>
            {m.allTags.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}
          </Select>
          {sel.count > 0 && (
            <div className="ml-auto flex items-center gap-2 rounded-control bg-accent-soft px-2.5 py-1">
              <span className="text-xs font-medium text-accent">{sel.count} selected</span>
              <Select aria-label="Add tag to selected" className="h-8 w-44" value="" onChange={(e) => { if (e.target.value) void m.bulkAddTag(e.target.value); }}>
                <option value="">Add tag…</option>
                {BULK_TAGS.map((t) => <option key={t} value={t}>{tagLabel(t)}</option>)}
              </Select>
              <Button size="sm" variant="ghost" onClick={sel.clear}>Clear</Button>
            </div>
          )}
        </Toolbar>
      }
      table={
        <DataTable
          label="Constituencies"
          columns={columns}
          rows={m.constituencies}
          rowKey={(c) => c.id}
          selectedKey={route.id}
          onRowClick={(c) => route.open(c.id)}
          loading={m.loading}
          empty={<EmptyState title="No seats match" description={filtered ? 'The district and tag filters only look at this page.' : 'Try a different name or number.'} />}
          footer={
            <Pager
              page={m.page} totalPages={m.totalPages} total={m.total} pageSize={CONSTITUENCY_PAGE_SIZE} noun="seats" onPage={m.loadPage}
              note={filtered ? 'district and tag filters apply to this page' : undefined}
            />
          }
        />
      }
      panel={route.id ? <ConstituencyPanel key={route.id} id={route.id} onClose={() => route.close()} onSaved={m.refresh} /> : null}
    />
  );
}
```

- [ ] **Step 8: Mount it in `admin/src/App.tsx`.** Replace these three imports:

```tsx
import ConstituencyManager from './pages/ConstituencyManager';
import ConstituencyDetail from './pages/ConstituencyDetail';
import ConstituencyEdit from './pages/ConstituencyEdit';
```

with `import Constituencies from './pages/Constituencies';`. Then replace the `{/* Constituencies */}` route block with:

```tsx
                {/* Constituencies */}
                <Route path="constituencies/:id/edit" element={<EditRedirect base="/constituencies" />} />
                <Route path="constituencies/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Constituencies /></ProtectedRoute>} />
```

- [ ] **Step 9: Register the page as bare and add it to Tailwind.**
- In `Layout.tsx`, change `['/overrides', '/parties', '/elections', '/persons', '/candidates']` to `['/overrides', '/parties', '/elections', '/persons', '/candidates', '/constituencies']`.
- In `tailwind.css`, add this line after `@source "../pages/Candidates.tsx";`:

```css
@source "../pages/Constituencies.tsx";
```

- [ ] **Step 10: Delete the old pages**

```bash
git rm admin/src/pages/ConstituencyManager.tsx admin/src/pages/ConstituencyDetail.tsx admin/src/pages/ConstituencyEdit.tsx
grep -rnE "pages/Constituency(Manager|Detail|Edit)|admin_const_election" admin/src
```

Expected: the grep prints nothing.

- [ ] **Step 11: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/hooks/useConstituencyManager.test.tsx src/hooks/useConstituencyEditor.test.tsx src/pages/Constituencies.test.tsx`
Expected: PASS (11 tests).

- [ ] **Step 12: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 13: Commit**

```bash
git add admin/src/pages/Constituencies.tsx admin/src/pages/Constituencies.test.tsx admin/src/components/entity/constituencies admin/src/hooks/useConstituencyManager.ts admin/src/hooks/useConstituencyManager.test.tsx admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: Constituencies with pager, page-scoped filters and visible-row bulk tag

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Manifests page (election list + full-width manifest panel)

decisions.md defines the layout:
- The page lists elections, one manifest each, in the standard table.
- Clicking a row opens a **full-width** sheet with three tabs:
  - **Summary** (the default): the old read-only ManifestDetail, rebuilt in Tailwind.
  - **Edit**: the existing `components/manifest/*` editors, unchanged, in their legacy CSS.
  - **JSON**.
- The footer has "Save draft" and "Publish" (SUPER_ADMIN only, with a confirm).

The table shows "Published" or "Not published", taken from `election.manifest_url`. A draft badge per row would need one `getManifest` call per election, so the draft state is shown only inside the panel.

**Files:**
- Create: `admin/src/pages/Manifests.tsx`
- Create: `admin/src/components/entity/manifests/ManifestPanel.tsx`, `admin/src/components/entity/manifests/ManifestSummary.tsx`
- Modify: `admin/src/hooks/useManifestEditor.ts` (takes `electionId`; `publish` returns a boolean)
- Modify: `admin/src/App.tsx`, `admin/src/components/Layout.tsx`, `admin/src/theme/tailwind.css`
- Delete: `admin/src/pages/ManifestDetail.tsx`, `admin/src/pages/ManifestEditor.tsx`
- Test: `admin/src/pages/Manifests.test.tsx`

**Interfaces:**
- Consumes: `Sheet` with `width="full" legacyBody` (Task 6), `ChipGroup` (Task 5), `ElectionStatusBadge` + `electionTypeLabel` (Task 10), `useElection().reload` (Task 10), and the existing editors:
  - `AllianceEditor`, `TrackedEditor`, `WatchlistEditor`
  - `MilestonesEditor`, `CompareHistoryEditor`, `VoteSplitsEditor`, `GeoConfigEditor`, `LiveTabsEditor`, `RevisionEditor`
- Produces:
  - `useManifestEditor(electionId: string | null)` returns `{ selectedId, elections, parties, constituencies, manifest, updateManifest, setFullManifest, loading, saving, isDraft, isDirty, contestingParties, partyMap, electionMap, trackedOptions, saveDraft, publish }`. `publish(pending?)` resolves to `Promise<boolean>`. There is no `setSelectedId` and no `useParams`.
  - `<ManifestPanel electionId election onClose onPublished />` and `<ManifestSummary manifest partyMap electionMap />`.

- [ ] **Step 1: Write the failing page test** `admin/src/pages/Manifests.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

const data = vi.hoisted(() => ({
  elections: [
    { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_url: null },
    { id: 'e2', name: 'Lok Sabha 2024', type: 'LS', year: 2024, status: 'Finalized', state_id: null, tentative_next_date: null, manifest_url: 'https://cdn.example/ls2024.json' },
  ],
}));
const svc = vi.hoisted(() => ({
  getElections: vi.fn(async () => data.elections),
  getManifest: vi.fn(async () => ({
    election_id: 'e1', manifest_url: null,
    draft: { alliances: [{ id: 'nda', name: 'NDA', color: '#f97316', parties: ['BJP'] }], milestones: [{ label: 'Majority', value: 122 }] },
  })),
  saveManifestDraft: vi.fn(async (_e: string, _m: object) => ({})),
  publishManifest: vi.fn(async () => ({})),
}));
vi.mock('../services/election.service', () => svc);
vi.mock('../services/geo.service', () => ({ getParties: vi.fn(async () => [{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#f97316' }]) }));
vi.mock('../services/constituency.service', () => ({ getConstituencies: vi.fn(async () => []) }));
vi.mock('../services/candidate.service', () => ({ searchCandidates: vi.fn(async () => []) }));
const ctx = vi.hoisted(() => ({ reload: vi.fn(async () => {}) }));
vi.mock('../context/ElectionContext', () => ({
  useElection: () => ({ elections: data.elections, electionId: 'e1', election: data.elections[0], setElectionId: vi.fn(), loading: false, error: null, reload: ctx.reload }),
}));
const auth = vi.hoisted(() => ({ role: 'EDITOR' }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: auth.role, email: 'x' }, hasRole: (...r: string[]) => r.includes(auth.role) }),
}));
import Manifests from './Manifests';
import { renderEntityPage } from '../test-utils/entity-harness';

beforeEach(() => { auth.role = 'EDITOR'; });
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.restoreAllMocks(); });

const renderAt = (at = '/manifests') => renderEntityPage('/manifests', <Manifests />, at);
const table = () => screen.getByRole('table', { name: 'Manifests' });

describe('Manifests page', () => {
  it('lists one manifest per election with its published state and opens the full-width panel on Summary', async () => {
    renderAt();
    const e1 = within(table()).getByText('Bihar Vidhan Sabha 2025').closest('tr')!;
    expect(within(e1).getByText('Not published')).toBeTruthy();
    expect(within(within(table()).getByText('Lok Sabha 2024').closest('tr')!).getByText('Published')).toBeTruthy();
    fireEvent.click(within(table()).getByText('Bihar Vidhan Sabha 2025'));
    expect(screen.getByTestId('where').textContent).toBe('/manifests/e1');
    const panel = screen.getByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    expect(panel.className).toContain('inset-0');
    expect(await within(panel).findByText('NDA')).toBeTruthy();
    expect(within(panel).getByText('Draft')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Summary' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('Edit shows the existing editors with their legacy styles; an EDITOR has no Publish button', async () => {
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    expect(within(panel).queryByRole('button', { name: 'Publish' })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Edit' }));
    const milestones = within(panel).getByText('Milestones');
    expect(milestones.closest('.mf-section')).not.toBeNull();
    expect(milestones.closest('.tw-ui')).toBeNull();
  });

  it('a SUPER_ADMIN publishes after confirming, and the election list is reloaded', async () => {
    auth.role = 'SUPER_ADMIN';
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(svc.publishManifest).toHaveBeenCalledWith('e1'));
    await waitFor(() => expect(ctx.reload).toHaveBeenCalled());
  });

  it('JSON: invalid text blocks tab switches and Save draft; a valid edit is guarded and saves as the draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderAt('/manifests/e1');
    const panel = await screen.findByRole('dialog', { name: 'Bihar Vidhan Sabha 2025' });
    await within(panel).findByText('NDA');
    fireEvent.click(within(panel).getByRole('button', { name: 'JSON' }));
    const json = within(panel).getByLabelText('Manifest JSON');
    fireEvent.change(json, { target: { value: '{bad' } });
    expect(within(panel).getByRole('alert')).toBeTruthy();
    expect((within(panel).getByRole('button', { name: 'Save draft' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(within(panel).getByRole('button', { name: 'Summary' }));
    expect(within(panel).getByLabelText('Manifest JSON')).toBeTruthy();
    const next = { alliances: [], milestones: [{ label: 'Majority', value: 122 }] };
    fireEvent.change(json, { target: { value: JSON.stringify(next) } });
    fireEvent.click(within(panel).getByRole('button', { name: 'Close panel' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(screen.getByTestId('where').textContent).toBe('/manifests/e1');
    fireEvent.click(within(panel).getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(svc.saveManifestDraft).toHaveBeenCalledWith('e1', next));
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/pages/Manifests.test.tsx`
Expected: FAIL with "Failed to resolve import './Manifests'".

- [ ] **Step 3: Rewrite `admin/src/hooks/useManifestEditor.ts`**

```ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getManifest, saveManifestDraft, publishManifest, getElections } from '../services/election.service';
import { getParties } from '../services/geo.service';
import { getConstituencies } from '../services/constituency.service';
import { useToast } from '../context/ToastContext';
import { resolvePublishedManifest } from '../utils/manifest-helpers';
import type { Election, ManifestData, Party, Constituency } from '../types';

const DEFAULT_MANIFEST: ManifestData = {
  alliances: [],
  watchlists: [],
  tracked: [],
  milestones: [{ label: 'Majority', value: 272 }],
  compare_with: [],
  history: [],
  history_years: [],
  leaders: [],
  cabinet: [],
  vote_splits: [],
  live_tabs: [],
  geo: {}
};

/**
 * CONTROLLER: Manifest Editor (MVC)
 * One election's manifest (the panel at /manifests/:electionId): load draft → published → default,
 * edit, save draft, publish.
 */
export function useManifestEditor(electionId: string | null) {
  const selectedId = electionId ?? '';
  const { toast, toastError } = useToast();

  const [elections, setElections] = useState<Election[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);

  const [manifest, setManifest] = useState<ManifestData>(DEFAULT_MANIFEST);
  const [loading, setLoading] = useState(!!electionId);
  const [saving, setSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  // Local edits not yet persisted to the server draft
  const [isDirty, setIsDirty] = useState(false);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    getElections().then(setElections).catch(() => {});
    getParties().then(setParties).catch(() => []);
  }, []);

  const loadManifest = useCallback(async (eid: string) => {
    if (!eid) return;
    setLoading(true);
    try {
      const [m, c] = await Promise.all([
        getManifest(eid),
        getConstituencies(eid).catch(() => [])
      ]);

      setConstituencies(c);

      let data: ManifestData;
      if (m.draft) {
        data = m.draft;
        setIsDraft(true);
      } else if (m.manifest_url) {
        data = (await resolvePublishedManifest(m.manifest_url)) || DEFAULT_MANIFEST;
        setIsDraft(false);
      } else {
        data = DEFAULT_MANIFEST;
        setIsDraft(false);
      }

      // MIGRATION: Convert old leaders/cabinet formats to watchlists if needed
      const watchlists = data.watchlists || [];

      if (data.leaders && data.leaders.length > 0 && !watchlists.some(w => w.id === 'leaders')) {
        watchlists.push({ id: 'leaders', name: 'Leaders', entries: data.leaders as any });
      }
      if (data.cabinet && data.cabinet.length > 0 && !watchlists.some(w => w.id === 'cabinet')) {
        watchlists.push({ id: 'cabinet', name: 'Cabinet', entries: data.cabinet as any });
      }

      const merged: ManifestData = {
        ...DEFAULT_MANIFEST,
        ...data,
        alliances: data.alliances || [],
        watchlists: watchlists.map(w => ({ ...w, entries: w.entries || [] })),
        tracked: data.tracked || [],
        milestones: data.milestones || DEFAULT_MANIFEST.milestones,
        compare_with: data.compare_with || [],
        history: data.history || [],
        history_years: data.history_years || [],
        vote_splits: data.vote_splits || [],
        live_tabs: data.live_tabs || [],
        geo: data.geo || {}
      };

      setManifest(merged);
      setIsDirty(false);
      loadedIdRef.current = eid;
    } catch (err) {
      console.error('Manifest load error:', err);
      toastError(err, 'Failed to load manifest data');
      // Only reset when switching elections; a failed reload keeps the local state.
      if (loadedIdRef.current !== eid) {
        setManifest(DEFAULT_MANIFEST);
        setConstituencies([]);
        setIsDraft(false);
        setIsDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    if (selectedId) loadManifest(selectedId);
  }, [selectedId, loadManifest]);

  const partyMap = useMemo(() => {
    const map = new Map<string, Party>();
    parties.forEach(p => { if (p && p.id) map.set(p.id, p); });
    return map;
  }, [parties]);

  const electionMap = useMemo(() => {
    const map = new Map<string, Election>();
    elections.forEach(e => { if (e && e.id) map.set(e.id, e); });
    return map;
  }, [elections]);

  const trackedOptions = useMemo(() => {
    return constituencies.map(c => ({ id: c.id, name: c.name }));
  }, [constituencies]);

  const updateManifest = (key: keyof ManifestData, value: any) => {
    setManifest(prev => ({ ...prev, [key]: value }));
    setIsDraft(true);
    setIsDirty(true);
  };

  const setFullManifest = (data: ManifestData) => {
    setManifest({ ...DEFAULT_MANIFEST, ...data });
    setIsDraft(true);
    setIsDirty(true);
  };

  const saveDraft = async (data: ManifestData): Promise<boolean> => {
    if (!selectedId) return false;
    setSaving(true);
    try {
      await saveManifestDraft(selectedId, data);
      toast('Draft saved successfully');
      setIsDraft(true);
      setIsDirty(false);
      setManifest(prev => ({ ...prev, ...data }));
      return true;
    } catch (err) {
      toastError(err, 'Failed to save draft');
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Publishes the server draft. Unsaved local edits (or `pending` data, e.g. from the JSON tab) are saved
   * first so the published version matches what's on screen. Resolves true when published.
   */
  const publish = async (pending?: ManifestData): Promise<boolean> => {
    if (!selectedId) return false;
    const needsSave = isDirty || pending !== undefined;
    const message = needsSave
      ? 'You have unsaved changes. Save them and publish this manifest to the live frontend?'
      : 'Publish this manifest to the live frontend?';
    if (!window.confirm(message)) return false;
    if (needsSave) {
      const saved = await saveDraft(pending ?? manifest);
      if (!saved) {
        toast('Publish aborted: unsaved changes could not be saved', 'error');
        return false;
      }
    }
    setSaving(true);
    try {
      await publishManifest(selectedId);
      toast('Manifest published to the live site');
      setIsDraft(false);
      loadManifest(selectedId);
      return true;
    } catch (err) {
      toastError(err, 'Publish failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    selectedId, elections, parties, constituencies,
    manifest, updateManifest, setFullManifest, loading, saving, isDraft, isDirty,
    contestingParties: parties, partyMap, electionMap, trackedOptions,
    saveDraft, publish
  };
}
```

- [ ] **Step 4: Create `admin/src/components/entity/manifests/ManifestSummary.tsx`**

```tsx
import type { ReactNode } from 'react';
import type { Election, ManifestData, Party } from '../../../types';

interface ManifestSummaryProps {
  manifest: ManifestData;
  partyMap: Map<string, Party>;
  electionMap: Map<string, Election>;
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-card p-4">
      <h3 className="mb-3 text-xs font-medium text-muted">{title}</h3>
      {children}
    </section>
  );
}

const None = ({ text }: { text: string }) => <p className="text-xs text-muted">{text}</p>;
const dot = (color?: string | null) => <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color || 'var(--color-line-strong)' }} aria-hidden />;

/** Read-only overview of a manifest (the old ManifestDetail), every section open — the panel's default tab. */
export function ManifestSummary({ manifest, partyMap, electionMap }: ManifestSummaryProps) {
  const stats: [string, number][] = [
    ['Alliances', manifest.alliances?.length ?? 0],
    ['Watchlists', manifest.watchlists?.length ?? 0],
    ['Tracked', manifest.tracked?.length ?? 0],
    ['Milestones', manifest.milestones?.length ?? 0],
  ];
  const geo = manifest.geo ?? {};

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {stats.map(([label, n]) => (
          <div key={label} className="rounded-card border border-line bg-card px-4 py-3">
            <div className="text-xs text-muted">{label}</div>
            <div className="text-2xl font-semibold tabular-nums text-ink">{n}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 items-start gap-4">
        <div className="space-y-4">
          <Card title="Alliances">
            {(manifest.alliances ?? []).length === 0 && <None text="No alliances configured." />}
            <ul className="space-y-2">
              {(manifest.alliances ?? []).map((a) => (
                <li key={a.id} className="rounded-control border-l-4 bg-subtle px-3 py-2" style={{ borderLeftColor: a.color }}>
                  <div className="text-sm font-medium text-ink">{a.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {a.parties.map((pid) => (
                      <span key={pid} className="inline-flex items-center gap-1 rounded-control border border-line bg-card px-1.5 py-0.5 text-[11px] text-ink-2">
                        {dot(partyMap.get(pid)?.color)}{pid}
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Vote splits">
            {(manifest.vote_splits ?? []).length === 0 && <None text="No vote splits configured." />}
            <ul className="space-y-1.5">
              {(manifest.vote_splits ?? []).map((v, i) => (
                <li key={i} className="flex items-center gap-2 rounded-control bg-subtle px-3 py-1.5 text-sm">
                  <span className="font-medium text-bad-text">{v.spoiler}</span>
                  <span className="text-xs text-muted">hurts</span>
                  <span className="font-medium text-ink">{v.hurts}</span>
                  <span className="ml-auto rounded-control bg-accent-soft px-1.5 py-0.5 text-[11px] text-accent">{v.label}</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Comparison history">
            {(manifest.history ?? []).length === 0 && <None text="No earlier elections configured for comparison." />}
            <ul className="space-y-1.5">
              {(manifest.history ?? []).map((hid, i) => {
                const el = electionMap.get(hid);
                return (
                  <li key={hid} className="flex items-center justify-between gap-3 rounded-control bg-subtle px-3 py-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-10 font-mono text-xs text-muted">{manifest.history_years?.[i] ?? el?.year ?? '–'}</span>
                      <span className="text-sm text-ink">{el?.name ?? hid}</span>
                    </div>
                    {i === 0 && <span className="text-[11px] text-accent">Baseline</span>}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Watchlists">
            {(manifest.watchlists ?? []).length === 0 && <None text="No watchlists defined." />}
            <div className="space-y-3">
              {(manifest.watchlists ?? []).map((w) => (
                <div key={w.id}>
                  <div className="mb-1 text-xs font-medium text-accent">{w.name}</div>
                  <ul className="space-y-1">
                    {w.entries.map((e, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="mt-1.5">{dot(partyMap.get(e.party_id)?.color)}</span>
                        <div>
                          <div className="font-medium text-ink">{e.name}</div>
                          <div className="text-[11px] text-muted">{e.role ? `${e.role} · ` : ''}{e.party_id} · {e.const_id}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Map">
            {geo.map_url && (
              <img
                src={geo.map_url.replace('.json', '.svg')}
                alt="Map preview"
                className="mb-3 h-40 w-full rounded-control bg-sidebar object-contain p-3"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-xs text-muted">Data source</dt><dd className="truncate text-ink">{geo.map_url || 'Default'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-muted">Centre</dt><dd className="text-ink">{geo.center ? `${geo.center[0]}, ${geo.center[1]}` : 'Auto'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-xs text-muted">Zoom</dt><dd className="text-ink">{geo.zoom ?? 'Auto'}</dd></div>
            </dl>
          </Card>

          <Card title="Milestones">
            {(manifest.milestones ?? []).length === 0 && <None text="No milestones." />}
            <ul className="space-y-1">
              {(manifest.milestones ?? []).map((ms, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-ink">{ms.label}</span>
                  <span className="font-semibold tabular-nums text-accent">{ms.value}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `admin/src/components/entity/manifests/ManifestPanel.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useManifestEditor } from '../../../hooks/useManifestEditor';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { searchCandidates } from '../../../services/candidate.service';
import ErrorBoundary from '../../atoms/ErrorBoundary';
import { AllianceEditor } from '../../manifest/AllianceEditor';
import { WatchlistEditor } from '../../manifest/WatchlistEditor';
import { TrackedEditor } from '../../manifest/TrackedEditor';
import {
  MilestonesEditor, CompareHistoryEditor, VoteSplitsEditor, GeoConfigEditor, LiveTabsEditor, RevisionEditor,
} from '../../manifest/MiscEditors';
import { Sheet } from '../../ui/Sheet';
import { ChipGroup } from '../../ui/Toolbar';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { ManifestSummary } from './ManifestSummary';
import type { Election, ManifestData } from '../../../types';

type Tab = 'summary' | 'edit' | 'json';

interface ManifestPanelProps {
  electionId: string;
  election: Election | null;
  onClose: () => void;
  /** After a publish: reload elections so the table's "Published" state is current. */
  onPublished: () => void;
}

/**
 * Full-width manifest sheet. Summary is rebuilt in Tailwind; Edit hosts the existing legacy-CSS editors
 * (so the body is `legacyBody`: no `tw-ui` around them); JSON is the raw manifest.
 */
export function ManifestPanel({ electionId, election, onClose, onPublished }: ManifestPanelProps) {
  const { hasRole } = useAuth();
  const canPublish = hasRole('SUPER_ADMIN');
  const { toast } = useToast();
  const c = useManifestEditor(electionId);
  const [tab, setTab] = useState<Tab>('summary');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  const pristineJson = JSON.stringify(c.manifest, null, 2);
  const jsonEdited = tab === 'json' && jsonText !== pristineJson;
  const dirty = c.isDirty || jsonEdited;
  useUnsavedGuard(dirty);

  // Entering the JSON tab, or a save/reload while on it, shows the current manifest.
  useEffect(() => {
    if (tab === 'json') { setJsonText(JSON.stringify(c.manifest, null, 2)); setJsonError(''); }
  }, [c.manifest, tab]);

  const parseJson = (): ManifestData | null => {
    try { return JSON.parse(jsonText) as ManifestData; } catch { return null; }
  };

  const switchTab = (next: Tab) => {
    if (tab === 'json' && next !== 'json') {
      const parsed = parseJson();
      if (!parsed) { toast('Fix JSON errors before switching tabs', 'error'); return; }
      if (jsonEdited) c.setFullManifest(parsed);
    }
    setTab(next);
  };

  const save = async () => {
    let data = c.manifest;
    if (tab === 'json') {
      const parsed = parseJson();
      if (!parsed) { toast('Invalid JSON format', 'error'); return; }
      data = parsed;
    }
    await c.saveDraft(data);
  };

  const publish = async () => {
    let pending: ManifestData | undefined;
    if (tab === 'json') {
      const parsed = parseJson();
      if (!parsed) { toast('Fix JSON errors before publishing', 'error'); return; }
      if (jsonEdited) pending = parsed;
    }
    if (await c.publish(pending)) onPublished();
  };

  const status = c.isDraft
    ? <Badge tone="warn">Draft</Badge>
    : election?.manifest_url ? <Badge tone="ok">Published</Badge> : <Badge tone="muted">Not published</Badge>;

  return (
    <Sheet
      open
      width="full"
      legacyBody
      onRequestClose={onClose}
      title={election?.name ?? 'Manifest'}
      description="What the public results page shows for this election: alliances, watchlists, milestones and map settings"
      footer={
        <>
          <div className="flex items-center gap-2">
            {status}
            {dirty && <span className="text-xs font-medium text-warn-text">Unsaved changes</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={c.saving || (tab === 'json' && !!jsonError)} onClick={save}>{c.saving ? 'Saving…' : 'Save draft'}</Button>
            {canPublish && <Button size="sm" variant="primary" disabled={c.saving} onClick={publish}>Publish</Button>}
          </div>
        </>
      }
    >
      <div className="tw-ui mb-4">
        <ChipGroup<Tab>
          label="Manifest view"
          value={tab}
          onChange={switchTab}
          options={[{ value: 'summary', label: 'Summary' }, { value: 'edit', label: 'Edit' }, { value: 'json', label: 'JSON' }]}
        />
      </div>

      {c.loading ? (
        <p className="tw-ui py-16 text-center text-sm text-muted">Loading manifest…</p>
      ) : tab === 'summary' ? (
        <div className="tw-ui">
          <ManifestSummary manifest={c.manifest} partyMap={c.partyMap} electionMap={c.electionMap} />
        </div>
      ) : tab === 'edit' ? (
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <ErrorBoundary>
            <AllianceEditor alliances={c.manifest.alliances || []} contestingParties={c.contestingParties} partyMap={c.partyMap}
              onUpdate={(val) => c.updateManifest('alliances', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <TrackedEditor tracked={c.manifest.tracked || []} trackedOptions={c.trackedOptions} alliances={c.manifest.alliances || []} partyMap={c.partyMap}
              onUpdate={(val) => c.updateManifest('tracked', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <WatchlistEditor watchlists={c.manifest.watchlists || []} contestingParties={c.contestingParties} constituencies={c.constituencies} partyMap={c.partyMap}
              onUpdate={(val) => c.updateManifest('watchlists', val)} onSearchCandidates={searchCandidates} />
          </ErrorBoundary>
          <ErrorBoundary>
            <MilestonesEditor milestones={c.manifest.milestones || []} onUpdate={(val) => c.updateManifest('milestones', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <CompareHistoryEditor
              compareWith={c.manifest.compare_with || []}
              history={c.manifest.history || []}
              historyYears={c.manifest.history_years || []}
              elections={c.elections}
              electionMap={c.electionMap}
              onUpdateCompare={(val) => c.updateManifest('compare_with', val)}
              onUpdateHistory={(val) => c.updateManifest('history', val)}
              onUpdateHistoryYears={(val) => c.updateManifest('history_years', val)}
            />
          </ErrorBoundary>
          <ErrorBoundary>
            <VoteSplitsEditor voteSplits={c.manifest.vote_splits || []} contestingParties={c.contestingParties} alliances={c.manifest.alliances || []} partyMap={c.partyMap}
              onUpdate={(val) => c.updateManifest('vote_splits', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <GeoConfigEditor geo={c.manifest.geo} onUpdate={(val) => c.updateManifest('geo', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <LiveTabsEditor liveTabs={c.manifest.live_tabs || []} onUpdate={(val) => c.updateManifest('live_tabs', val)} />
          </ErrorBoundary>
          <ErrorBoundary>
            <RevisionEditor revision={c.manifest.revision} constituencies={c.constituencies} />
          </ErrorBoundary>
        </div>
      ) : (
        <div className="tw-ui flex min-h-[480px] flex-col overflow-hidden rounded-card border border-line">
          {jsonError && <p role="alert" className="border-b border-line bg-bad-soft px-4 py-2 text-xs text-bad-text">{jsonError}</p>}
          <textarea
            aria-label="Manifest JSON"
            spellCheck={false}
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value);
              try { JSON.parse(e.target.value); setJsonError(''); } catch (err) { setJsonError(err instanceof Error ? err.message : 'Invalid JSON'); }
            }}
            className="min-h-[480px] flex-1 resize-none bg-card p-4 font-mono text-[13px] text-ink focus:outline-none"
          />
        </div>
      )}
    </Sheet>
  );
}
```

- [ ] **Step 6: Create `admin/src/pages/Manifests.tsx`**

```tsx
import { useMemo, useState } from 'react';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { useEntityRoute } from '../hooks/useEntityRoute';
import { EntityPage } from '../components/entity/EntityPage';
import { NoElection } from '../components/entity/NoElection';
import { ElectionStatusBadge, electionTypeLabel } from '../components/entity/elections/ElectionPanel';
import { ManifestPanel } from '../components/entity/manifests/ManifestPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, SearchInput, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import type { Election } from '../types';

type TypeFilter = '' | 'LS' | 'VS';

const COLUMNS: Column<Election>[] = [
  { key: 'name', header: 'Election', cell: (e) => <span className="font-medium text-ink">{e.name}</span> },
  { key: 'type', header: 'Type', className: 'text-ink-2', cell: (e) => electionTypeLabel(e.type) },
  { key: 'year', header: 'Year', className: 'tabular-nums text-ink-2', cell: (e) => e.year },
  { key: 'status', header: 'Status', cell: (e) => <ElectionStatusBadge status={e.status} /> },
  { key: 'manifest', header: 'Manifest', cell: (e) => (e.manifest_url ? <Badge tone="ok">Published</Badge> : <Badge tone="muted">Not published</Badge>) },
];

/** PAGE: Manifests — one per election; the full-width manifest panel opens at /manifests/:electionId. */
export default function Manifests() {
  const { elections, loading, error, reload } = useElection();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/manifests', editorDirty);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TypeFilter>('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return elections.filter((e) => (!type || e.type === type) && (!q || e.name.toLowerCase().includes(q)));
  }, [elections, search, type]);
  const open = route.id ? elections.find((e) => e.id === route.id) ?? null : null;

  return (
    <EntityPage
      header={<PageHeader title="Manifests" count={elections.length} subtitle="One per election: what the public results page shows" />}
      toolbar={
        <Toolbar>
          <SearchInput label="Search elections" placeholder="Search by name…" value={search} onChange={setSearch} />
          <ChipGroup<TypeFilter>
            label="Type"
            value={type}
            onChange={setType}
            options={[{ value: '', label: 'All' }, { value: 'LS', label: 'Lok Sabha' }, { value: 'VS', label: 'Vidhan Sabha' }]}
          />
        </Toolbar>
      }
      table={
        <DataTable
          label="Manifests"
          columns={COLUMNS}
          rows={rows}
          rowKey={(e) => e.id}
          selectedKey={route.id}
          onRowClick={(e) => route.open(e.id)}
          loading={loading}
          empty={error || elections.length === 0
            ? <NoElection error={error} />
            : <EmptyState title="No elections match" description="Try a different search or type." />}
        />
      }
      panel={route.id ? (
        <ManifestPanel key={route.id} electionId={route.id} election={open} onClose={() => route.close()} onPublished={() => { void reload(); }} />
      ) : null}
    />
  );
}
```

- [ ] **Step 7: Mount it in `admin/src/App.tsx`.** Replace the two imports `import ManifestDetail from './pages/ManifestDetail';` and `import ManifestEditor from './pages/ManifestEditor';` with `import Manifests from './pages/Manifests';`. Then replace the `{/* Manifests */}` route block (three `<Route>` lines) with:

```tsx
                {/* Manifests: one per election; full-width panel at /manifests/:electionId */}
                <Route path="manifests/:id/edit" element={<EditRedirect base="/manifests" />} />
                <Route path="manifests/*" element={<ProtectedRoute roles={['SUPER_ADMIN', 'EDITOR']}><Manifests /></ProtectedRoute>} />
```

- [ ] **Step 8: Register the page as bare and add it to Tailwind.**
- In `Layout.tsx`, change `['/overrides', '/parties', '/elections', '/persons', '/candidates', '/constituencies']` to `['/overrides', '/parties', '/elections', '/persons', '/candidates', '/constituencies', '/manifests']`.
- In `tailwind.css`, add this line after `@source "../pages/Constituencies.tsx";`:

```css
@source "../pages/Manifests.tsx";
```

- [ ] **Step 9: Delete the old pages**

```bash
git rm admin/src/pages/ManifestDetail.tsx admin/src/pages/ManifestEditor.tsx
grep -rnE "pages/Manifest(Detail|Editor)|useParams" admin/src/hooks admin/src/App.tsx
```

Expected: the grep prints nothing. The hook no longer reads the URL.

- [ ] **Step 10: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/pages/Manifests.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 11: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 12: Manual check.** Open http://localhost:3081/manifests and click a row.
- The sheet covers the page body and the page header stays visible.
- On the Edit tab, the legacy buttons ("+ Add …", ✕ remove, section toggles) keep their legacy look. They must not be flattened by the `tw-ui` reset.
- On the JSON tab, an invalid edit disables "Save draft".
- As an EDITOR, there is no "Publish" button.

- [ ] **Step 13: Commit**

```bash
git add admin/src/pages/Manifests.tsx admin/src/pages/Manifests.test.tsx admin/src/components/entity/manifests admin/src/hooks/useManifestEditor.ts admin/src/App.tsx admin/src/components/Layout.tsx admin/src/theme/tailwind.css
git commit -m "admin: Manifests as election table + full-width panel (summary, editor, JSON)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: ⌘K command palette

Spec §1 says ⌘K jumps "to a seat, candidate, party or person in the selected election". decisions.md asks for seats, candidates and nav items, with the election switched when a result belongs to another election. This task covers all of them **without a backend change**:
- Seats come from `GET /search/constituencies?q=&election_id=<selected>`.
- Candidates come from `GET /search/candidates?q=`, across all elections, with the selected election's candidates listed first.
- Parties come from `getPartiesPaginated(1, 6, q)`.
- Persons come from `getPersons(1, 6, q)`.
- Pages are the role-filtered `NAV_GROUPS`.
- The `/search/*` endpoints return raw Prisma rows: candidates carry `parties`, not `party`, and constituencies carry `districts`. They get their own result types. The `q` parameter is optional server-side, so the client requires at least 2 characters.

**Files:**
- Create: `admin/src/services/search.service.ts`, `admin/src/hooks/useCommandSearch.ts`, `admin/src/components/shell/CommandPalette.tsx`
- Modify: `admin/src/components/shell/TopBar.tsx`, `admin/src/components/shell/ShortcutsDialog.tsx`
- Test: `admin/src/components/shell/palette.test.tsx`

`components/shell` is already in `@source`.

**Interfaces:**
- Consumes:
  - `useElection()` → `{ electionId, elections, setElectionId }`
  - `useAuth().hasRole`
  - `useShellStatus().editorDirty` and `confirmDiscardEdits`
  - `NAV_GROUPS`
  - `shortElectionName`
  - `getPartiesPaginated`, `getPersons`
- Produces:
  - Search services:
    - `searchSeats(q, electionId): Promise<SeatHit[]>`, where `SeatHit = { id; name; const_no; election_id; type }`.
    - `searchCandidatesAll(q): Promise<CandidateHit[]>`, where `CandidateHit = { id; name; election_id; const_id; party_id }`.
  - `useCommandSearch(query, electionId, elections, canSee)` → `{ items: CommandItem[]; loading }`, with `MIN_QUERY = 2`:
    - `CommandItem = { key; group: 'Pages'|'Seats'|'Candidates'|'Parties'|'Persons'; label; hint?; to; electionId? }`
    - debounced 250 ms
    - pages are shown even for an empty query
    - NOTA is dropped
  - `<CommandPalette open onOpenChange />`, a modal Radix Dialog with `tw-ui`. Picking an item:
    1. asks first when `editorDirty`
    2. closes the palette
    3. calls `setElectionId(item.electionId)` **before** navigating when the item's election differs
    4. navigates to `` `${item.to}?election=${eid}` ``
  - `TopBar`:
    - adds a search field button ("Search (⌘K)")
    - adds a global `⌘K` / `Ctrl+K` listener

- [ ] **Step 1: Write the failing test** `admin/src/components/shell/palette.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useEffect } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

const search = vi.hoisted(() => ({
  searchSeats: vi.fn(async (_q: string, _e: string): Promise<unknown[]> => []),
  searchCandidatesAll: vi.fn(async (_q: string): Promise<unknown[]> => []),
}));
vi.mock('../../services/search.service', () => search);
vi.mock('../../services/geo.service', () => ({
  getPartiesPaginated: vi.fn(async () => ({ success: true, data: [{ id: 'BJP', name: 'Bharatiya Janata Party' }], pagination: { page: 1, limit: 6, total: 1, totalPages: 1 } })),
}));
vi.mock('../../services/person.api', () => ({
  getPersons: vi.fn(async () => ({ success: true, data: [], pagination: { page: 1, limit: 6, total: 0, totalPages: 1 } })),
}));
const ctx = vi.hoisted(() => ({
  setElectionId: vi.fn(),
  elections: [
    { id: 'e1', name: 'Bihar Vidhan Sabha 2025', type: 'VS', year: 2025, status: 'Live', state_id: 1, tentative_next_date: null, manifest_url: null },
    { id: 'e2', name: 'Kerala Vidhan Sabha 2021', type: 'VS', year: 2021, status: 'Finalized', state_id: 2, tentative_next_date: null, manifest_url: null },
  ],
}));
vi.mock('../../context/ElectionContext', () => ({ useElection: () => ({ electionId: 'e1', elections: ctx.elections, setElectionId: ctx.setElectionId }) }));
vi.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u', name: 'Mannu K', role: 'EDITOR', email: 'x' }, logout: vi.fn(), hasRole: (...r: string[]) => r.includes('EDITOR') }),
}));
const shell = vi.hoisted(() => ({ editorDirty: false }));
vi.mock('../../context/ShellStatusContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../context/ShellStatusContext')>()),
  useShellStatus: () => ({ live: 'idle', setLive: () => {}, editorDirty: shell.editorDirty, setEditorDirty: () => {} }),
}));
import { CommandPalette } from './CommandPalette';
import { TopBar } from './TopBar';

const order: string[] = [];
function Where() {
  const { pathname, search: qs } = useLocation();
  useEffect(() => { order.push(`nav:${pathname}${qs}`); }, [pathname, qs]);
  return <output data-testid="where">{pathname + qs}</output>;
}
const renderPalette = (onOpenChange = vi.fn()) => render(
  <MemoryRouter initialEntries={['/parties?election=e1']}><CommandPalette open onOpenChange={onOpenChange} /><Where /></MemoryRouter>,
);
const input = () => screen.getByLabelText(/Search seats, candidates/);

beforeEach(() => { order.length = 0; shell.editorDirty = false; });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('CommandPalette', () => {
  it('finds seats in this election and candidates anywhere; a candidate from another election switches election, then opens', async () => {
    ctx.setElectionId.mockImplementation((id: string) => { order.push(`election:${id}`); });
    search.searchSeats.mockResolvedValue([{ id: 's142', name: 'Patna Sahib', const_no: 142, election_id: 'e1', type: 'GEN' }]);
    search.searchCandidatesAll.mockResolvedValue([
      { id: 'c7', name: 'Ravi Prasad', election_id: 'e2', const_id: 'k5', party_id: 'BJP' },
      { id: 'n1', name: 'NOTA', election_id: 'e1', const_id: 's1', party_id: 'NOTA' },
    ]);
    const onOpenChange = vi.fn();
    renderPalette(onOpenChange);
    fireEvent.change(input(), { target: { value: 'pat' } });
    expect(await screen.findByRole('option', { name: /142 Patna Sahib/ })).toBeTruthy();
    expect(search.searchSeats).toHaveBeenCalledWith('pat', 'e1');
    expect(screen.queryByRole('option', { name: /NOTA/ })).toBeNull();
    order.length = 0;
    fireEvent.click(screen.getByRole('option', { name: /Ravi Prasad/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(order).toEqual(['election:e2', 'nav:/candidates/c7?election=e2']);
  });

  it('a seat opens the constituency panel in the current election', async () => {
    search.searchSeats.mockResolvedValue([{ id: 'BR_VS2025_PATNA', name: 'Patna Sahib', const_no: 142, election_id: 'e1', type: 'GEN' }]);
    renderPalette();
    fireEvent.change(input(), { target: { value: 'patna' } });
    fireEvent.click(await screen.findByRole('option', { name: /142 Patna Sahib/ }));
    expect(ctx.setElectionId).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/constituencies/BR_VS2025_PATNA?election=e1');
  });

  it('with unsaved edits, picking a result asks first and cancel stays put', async () => {
    shell.editorDirty = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onOpenChange = vi.fn();
    renderPalette(onOpenChange);
    fireEvent.change(input(), { target: { value: 'par' } });
    fireEvent.click(screen.getByRole('option', { name: 'Parties' }));
    expect(confirm).toHaveBeenCalledWith('Discard unsaved changes?');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('where').textContent).toBe('/parties?election=e1');
  });

  it('one letter only filters pages (no API call); ↓ + Enter opens the highlighted page', async () => {
    renderPalette();
    fireEvent.change(input(), { target: { value: 'p' } });
    await new Promise((r) => setTimeout(r, 300));
    expect(search.searchSeats).not.toHaveBeenCalled();
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['Parties', 'Persons']);
    fireEvent.keyDown(input(), { key: 'ArrowDown' });
    fireEvent.keyDown(input(), { key: 'Enter' });
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/persons?election=e1'));
  });
});

describe('TopBar search', () => {
  it('⌘K / Ctrl+K and the search field open the palette', () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })));
    render(<MemoryRouter><TopBar /></MemoryRouter>);
    expect(screen.queryByLabelText(/Search seats, candidates/)).toBeNull();
    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByLabelText(/Search seats, candidates/)).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText(/Search seats, candidates/), { key: 'Escape' });
    expect(screen.queryByLabelText(/Search seats, candidates/)).toBeNull();
    fireEvent.keyDown(window, { key: 'K', ctrlKey: true });
    expect(screen.getByLabelText(/Search seats, candidates/)).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText(/Search seats, candidates/), { key: 'Escape' });
    fireEvent.click(screen.getByRole('button', { name: 'Search (⌘K)' }));
    expect(screen.getByLabelText(/Search seats, candidates/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/components/shell/palette.test.tsx`
Expected: FAIL with "Failed to resolve import './CommandPalette'".

- [ ] **Step 3: Create `admin/src/services/search.service.ts`**

```ts
import { apiFetch } from './api-client';

/** Raw rows from the public /search endpoints (Prisma shape, no DTO mapping — so not `Candidate`). */
export interface SeatHit { id: string; name: string; const_no: number; election_id: string; type: string }
export interface CandidateHit { id: string; name: string; election_id: string; const_id: string; party_id: string | null }

/** Seats by name in one election (max 50, server-side). */
export async function searchSeats(q: string, electionId: string): Promise<SeatHit[]> {
  const params = new URLSearchParams({ q });
  if (electionId) params.set('election_id', electionId);
  return (await apiFetch<SeatHit[]>(`/search/constituencies?${params.toString()}`)) || [];
}

/** Candidates by name across every election (max 50, server-side). */
export async function searchCandidatesAll(q: string): Promise<CandidateHit[]> {
  return (await apiFetch<CandidateHit[]>(`/search/candidates?${new URLSearchParams({ q }).toString()}`)) || [];
}
```

- [ ] **Step 4: Create `admin/src/hooks/useCommandSearch.ts`**

```ts
import { useEffect, useMemo, useState } from 'react';
import { NAV_GROUPS } from '../utils/navigation.config';
import { searchCandidatesAll, searchSeats, type CandidateHit, type SeatHit } from '../services/search.service';
import { getPartiesPaginated } from '../services/geo.service';
import { getPersons } from '../services/person.api';
import { shortElectionName } from '../components/shell/ElectionPicker';
import type { Election, Party, PersonWithStats } from '../types';

export type CommandGroup = 'Pages' | 'Seats' | 'Candidates' | 'Parties' | 'Persons';

export interface CommandItem {
  key: string;
  group: CommandGroup;
  label: string;
  hint?: string;
  /** Path without query; the palette adds `?election=`. */
  to: string;
  /** Election the record belongs to (seats, candidates). */
  electionId?: string;
}

export const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;
const LIMIT = 6;

/** Pages (always, filtered by the query) plus seats, candidates, parties and persons once the query has 2+ letters. */
export function useCommandSearch(query: string, electionId: string, elections: Election[], canSee: (roles: string[]) => boolean) {
  const q = query.trim();
  const [remote, setRemote] = useState<CommandItem[]>([]);
  const [loading, setLoading] = useState(false);

  const pages = useMemo<CommandItem[]>(() => {
    const lower = q.toLowerCase();
    return NAV_GROUPS.flatMap((g) => g.items)
      .filter((i) => canSee(i.roles) && (!lower || i.label.toLowerCase().includes(lower)))
      .map((i): CommandItem => ({ key: `page:${i.path}`, group: 'Pages', label: i.label, to: i.path }));
  }, [q, canSee]);

  useEffect(() => {
    if (q.length < MIN_QUERY) { setRemote([]); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const electionName = (eid: string) => {
        const e = elections.find((x) => x.id === eid);
        return e ? shortElectionName(e.name, e.type, e.year) : 'Other election';
      };
      const [seats, cands, parties, persons] = await Promise.all([
        electionId ? searchSeats(q, electionId).catch((): SeatHit[] => []) : Promise.resolve<SeatHit[]>([]),
        searchCandidatesAll(q).catch((): CandidateHit[] => []),
        getPartiesPaginated(1, LIMIT, q).then((r): Party[] => r.data).catch((): Party[] => []),
        getPersons(1, LIMIT, q).then((r): PersonWithStats[] => r.data).catch((): PersonWithStats[] => []),
      ]);
      if (cancelled) return;
      // The selected election's candidates first, then the rest.
      const rank = (c: CandidateHit) => (c.election_id === electionId ? 0 : 1);
      setRemote([
        ...seats.slice(0, LIMIT).map((s): CommandItem => ({
          key: `seat:${s.id}`, group: 'Seats', label: `${s.const_no} ${s.name}`, hint: s.type,
          to: `/constituencies/${encodeURIComponent(s.id)}`, electionId: s.election_id,
        })),
        ...cands.filter((c) => c.party_id !== 'NOTA' && c.name !== 'NOTA').sort((a, b) => rank(a) - rank(b)).slice(0, LIMIT)
          .map((c): CommandItem => ({
            key: `cand:${c.id}`, group: 'Candidates', label: c.name, hint: `${c.party_id ?? 'IND'} · ${electionName(c.election_id)}`,
            to: `/candidates/${encodeURIComponent(c.id)}`, electionId: c.election_id,
          })),
        ...parties.map((p): CommandItem => ({ key: `party:${p.id}`, group: 'Parties', label: p.name, hint: p.id, to: `/parties/${encodeURIComponent(p.id)}` })),
        ...persons.map((p): CommandItem => ({ key: `person:${p.id}`, group: 'Persons', label: p.name, hint: `${p.candidate_count} contests`, to: `/persons/${encodeURIComponent(p.id)}` })),
      ]);
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [q, electionId, elections]);

  return { items: [...pages, ...remote], loading };
}
```

- [ ] **Step 5: Create `admin/src/components/shell/CommandPalette.tsx`**

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useElection } from '../../context/ElectionContext';
import { confirmDiscardEdits, useShellStatus } from '../../context/ShellStatusContext';
import { MIN_QUERY, useCommandSearch, type CommandItem } from '../../hooks/useCommandSearch';
import { Kbd } from '../ui/Kbd';
import { cn } from '../ui/cn';

/** ⌘K: jump to a page, seat, candidate, party or person. Opening a record from another election switches it first. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { electionId, elections, setElectionId } = useElection();
  const { editorDirty } = useShellStatus();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const canSee = (roles: string[]) => roles.length === 0 || roles.some((r) => hasRole(r));
  const { items, loading } = useCommandSearch(query, electionId, elections, canSee);

  useEffect(() => { if (!open) setQuery(''); }, [open]);
  useEffect(() => { setActive(0); }, [query]);

  const go = (item: CommandItem) => {
    // Leaving an editor (record panel or seat) with unsaved edits asks first.
    if (!confirmDiscardEdits(editorDirty)) return;
    onOpenChange(false);
    const eid = item.electionId ?? electionId;
    // Switch first: setElectionId rewrites ?election= on the current URL; the navigation below then
    // carries the new path and the same election, so it is the last word.
    if (item.electionId && item.electionId !== electionId) setElectionId(item.electionId);
    navigate(eid ? `${item.to}?election=${encodeURIComponent(eid)}` : item.to);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && items[active]) { e.preventDefault(); go(items[active]); }
  };

  const groups = useMemo(() => {
    const out: { group: string; rows: { item: CommandItem; index: number }[] }[] = [];
    items.forEach((item, index) => {
      const g = out.find((x) => x.group === item.group);
      if (g) g.rows.push({ item, index });
      else out.push({ group: item.group, rows: [{ item, index }] });
    });
    return out;
  }, [items]);

  const tooShort = query.trim().length < MIN_QUERY;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="tw-ui fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content aria-describedby={undefined} className="tw-ui fixed left-1/2 top-24 z-50 w-[560px] -translate-x-1/2 overflow-hidden rounded-panel border border-line bg-card shadow-lg">
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search size={16} aria-hidden className="text-muted" />
            <input
              autoFocus
              aria-label="Search seats, candidates, parties, persons and pages"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search seats, candidates, parties, persons…"
              className="h-12 flex-1 bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
            <Kbd>Esc</Kbd>
          </div>
          <div role="listbox" aria-label="Results" className="max-h-96 overflow-y-auto p-2">
            {groups.map(({ group, rows }) => (
              <div key={group} role="group" aria-label={group} className="mb-1">
                <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted">{group}</div>
                {rows.map(({ item, index }) => (
                  <div
                    key={item.key}
                    role="option"
                    aria-selected={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-2 text-sm text-ink', index === active && 'bg-accent-soft')}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.hint && <span className="shrink-0 text-xs text-muted">{item.hint}</span>}
                  </div>
                ))}
              </div>
            ))}
            {items.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-muted">{tooShort ? 'Type at least 2 letters to search.' : loading ? 'Searching…' : 'No results.'}</p>
            )}
            {loading && items.length > 0 && <p className="px-2 py-1 text-xs text-muted">Searching…</p>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 6: Add the search field and the shortcut to `admin/src/components/shell/TopBar.tsx`.** Replace the file with:

```tsx
import { useEffect, useState } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShellStatus } from '../../context/ShellStatusContext';
import { ElectionPicker } from './ElectionPicker';
import { HealthDot } from './HealthDot';
import { ShortcutsDialog } from './ShortcutsDialog';
import { CommandPalette } from './CommandPalette';
import { Kbd } from '../ui/Kbd';
import { cn } from '../ui/cn';

const LIVE_PILL = {
  open: { text: 'Live updates on', cls: 'bg-ok-soft text-ok-text border-ok/30', dot: 'bg-ok' },
  connecting: { text: 'Connecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
  reconnecting: { text: 'Reconnecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
} as const;

export function TopBar() {
  const { user, logout, hasRole } = useAuth();
  const { live } = useShellStatus();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const initials = (user?.name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const pill = live === 'idle' ? null : LIVE_PILL[live];

  // ⌘K (macOS) / Ctrl+K anywhere opens the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
              <Menu.Item onSelect={logout} className="cursor-pointer rounded-control px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-subtle">
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

- [ ] **Step 7: List the new shortcuts in `admin/src/components/shell/ShortcutsDialog.tsx`.** Replace the `SHORTCUTS` array with:

```tsx
const SHORTCUTS: [string[], string][] = [
  [['⌘', 'K'], 'Search seats, candidates, parties, persons'],
  [['↑', '↓'], 'Move between seats (Live console)'],
  [['Enter'], 'Save seat / open the focused row'],
  [['Esc'], 'Discard seat edits / close the record panel'],
  [['/'], 'Jump to seat search'],
];
```

- [ ] **Step 8: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/components/shell/palette.test.tsx src/components/shell/shell.test.tsx`
Expected: PASS.

- [ ] **Step 9: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 10: Manual check.**
- Press ⌘K on `/overrides` with unsaved seat edits. Picking a result asks first.
- Type "pat". Seats from the selected election appear, followed by candidates.
- Pick a candidate from another election. The top-bar picker switches, and the candidate panel opens with its seat selected.

- [ ] **Step 11: Commit**

```bash
git add admin/src/services/search.service.ts admin/src/hooks/useCommandSearch.ts admin/src/components/shell/CommandPalette.tsx admin/src/components/shell/palette.test.tsx admin/src/components/shell/TopBar.tsx admin/src/components/shell/ShortcutsDialog.tsx
git commit -m "admin: ⌘K command palette (pages, seats, candidates, parties, persons)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 16: Remove the legacy election gate and picker

Every page that used them was replaced in Tasks 9–14. `AdminPageHeader` and `FieldError` stay, because the Phase 3 pages (Audit logs, Feedback, Users, System status) still import them. `admin.css` is not touched (see Global Constraints).

**Files:**
- Delete: `admin/src/components/common/AdminLandingCard.tsx`, `admin/src/components/ElectionPicker.tsx` (the legacy picker; the global one is `components/shell/ElectionPicker.tsx`)

- [ ] **Step 1: Check that nothing imports them**

```bash
grep -rlE "AdminLandingCard|components/ElectionPicker|'\.\./ElectionPicker'" admin/src | grep -vE "components/common/AdminLandingCard\.tsx|components/ElectionPicker\.tsx"
```

Expected: no output. The two files being deleted are excluded, and the global `components/shell/ElectionPicker` does not match. If anything prints, the file that prints is a page that Tasks 9–14 should have replaced. Fix that file. Do not keep the legacy component.

- [ ] **Step 2: Delete the files**

```bash
git rm admin/src/components/common/AdminLandingCard.tsx admin/src/components/ElectionPicker.tsx
```

- [ ] **Step 3: Verify that no old entity pages, routes or storage keys remain**

```bash
ls admin/src/pages
grep -rnE "pages/((Party|Person|Candidate|Constituency)(Manager|Detail|Edit)|ElectionManager|Manifest(Detail|Editor))" admin/src
grep -rnE "admin_cand_|admin_const_election" admin/src
grep -rn "AdminPageHeader" admin/src/pages
```

Expected:
- `ls` lists only: `AuditLogs.tsx Candidates.test.tsx Candidates.tsx Constituencies.test.tsx Constituencies.tsx Dashboard.tsx Elections.test.tsx Elections.tsx Feedback.tsx LiveConsole.test.tsx LiveConsole.tsx Login.tsx Manifests.test.tsx Manifests.tsx Parties.test.tsx Parties.tsx Persons.test.tsx Persons.tsx SystemStatus.test.tsx SystemStatus.tsx UserManager.tsx`.
- The second and third greps print nothing.
- The last grep prints only `AuditLogs.tsx`, `Feedback.tsx`, `SystemStatus.tsx` and `UserManager.tsx`.

- [ ] **Step 4: Full suite and build**

Run: `cd admin && npm test && npm run build`
Expected: all PASS. The build has no "Could not resolve" errors.

- [ ] **Step 5: Commit**

```bash
git commit -m "admin: remove the legacy election landing card and picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 17: Docs (FEATURES.md, CLAUDE.md, design notes)

**Files:**
- Modify: `docs/FEATURES.md`, `CLAUDE.md`, `docs/design/admin/NOTES.md`

- [ ] **Step 1: Add a feature entry to `docs/FEATURES.md`.** Put it directly after the `### Admin redesign: shell + Live Console (2026-10)` entry, in the same style:

```markdown
### Admin redesign: entity pages + ⌘K (2026-10)
- Elections, Parties, Persons, Candidates, Constituencies and Manifests share one pattern:
  - a page header with a count, a toolbar, and one table style (sticky header, selected row, empty state)
  - a right-hand record panel: a non-modal Radix Dialog rendered in place, 400px (Manifests: full width)
- URLs:
  - `/x/:id` opens a record and `/x/new` creates one
  - old `/x/:id/edit` links redirect
  - the query string (`?election=`) is kept
- Unsaved changes ("Discard unsaved changes?") are guarded on:
  - row switch, close, Esc
  - the sidebar (including the current section), the election picker and ⌘K
  - tab close
- The browser Back button is not guarded (BrowserRouter).
- Candidates and Constituencies use the global top-bar election. The per-page election pickers and the "select an election" landing cards are gone.
- Candidates:
  - The toolbar has a Seat select, Linked/Unlinked chips, and a name search.
  - Same-name link suggestions and the person search are in the panel.
  - The photo is read-only (it comes from the person).
- Constituencies:
  - pager (100 per page)
  - district/tag filters apply to the loaded page
  - bulk tag acts on the visible rows
- Elections:
  - Go live and Finalize ask first. Finalize is SUPER_ADMIN only.
  - New elections appear in the top-bar picker at once (`ElectionContext.reload`).
- Persons:
  - `?q=` search
  - Merge duplicates (SUPER_ADMIN) merges the found record **into** the open one
- Manifests: the full-width panel has Summary / Edit (existing editors) / JSON tabs, plus Save draft and Publish (SUPER_ADMIN).
- ⌘K / Ctrl+K palette:
  - finds pages, seats (selected election), candidates (all elections), parties and persons
  - opening a record from another election switches the election first
- Fixes:
  - Party/Person paging
  - merge direction (it used to delete the viewed person)
  - legacy `M`/`F` gender display and save
  - dead candidate photo field
  - `?q=` ignored on Persons
  - Constituencies capped at 100 rows
  - numeric 0 saved as null
  - NaN seat number
```

- [ ] **Step 2: Update the Admin line in `CLAUDE.md`.** Replace the line starting `- **Admin:** React + TypeScript (Vite) panel for managing elections, candidates, results, manifests, live overrides. Being redesigned` with:

```markdown
- **Admin:** React + TypeScript (Vite) panel for managing elections, candidates, results, manifests, live overrides. Being redesigned (spec `docs/superpowers/specs/2026-10-01-admin-redesign-design.md`): Tailwind v4 (preflight off) + Radix, legacy `admin.css` in a lower cascade layer. Tailwind only scans the paths listed via `@source` in `admin/src/theme/tailwind.css` — add a line for every new file/dir that uses classes. Global election selection via `ElectionContext`. Entity pages = `components/entity/EntityPage` + `components/ui/{DataTable,Sheet}`; records open at `/x/:id` via `useEntityRoute`, and every editor calls `useUnsavedGuard(dirty)`. Never put `tw-ui` around legacy `.btn`/`.form-input` markup (its reset sits above the legacy layer).
```

- [ ] **Step 3: Update `docs/design/admin/NOTES.md`.** Under `### Candidates (candidates.*)`, replace `- None outstanding.` with:

```markdown
- Built in Phase 2. The panel is 400px (decisions.md), not the spec's ~440px.
- The panel is a non-modal sheet in the page's flex row (as in the screen), not an overlay.
- There is no "New candidate" button: candidates come from the seeds and the ECI import.
```

Then add this section after `## Phase 1 follow-ups (carry into Phase 2)`:

```markdown
## Phase 2 follow-ups (carry into Phase 3)
- The browser Back button does not ask about unsaved panel edits (BrowserRouter has no `useBlocker`). Moving to a data router would fix it.
- The manifest editor (`components/manifest/*`) still uses legacy CSS and collapsible sections. Rebuild it with the Phase 3 `admin.css` removal.
- `useResourceList` searches on every keystroke (no debounce).
- The Candidates seat list comes from the public `/constituencies?election_id=` endpoint, and candidates per seat from `/candidates` (`take=1000`). There is no cross-seat candidate table without a backend paging change.
- ⌘K candidates come from `/search/candidates` (max 50 server-side, name-sorted). The palette shows 6, with the selected election first.
- Phase 1 follow-ups still open: HealthDot and Log out do not use the unsaved guard; Save / Discard / Cancel dialog instead of `window.confirm`.
```

- [ ] **Step 4: Final verification**

Run: `cd admin && npm test && npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/FEATURES.md CLAUDE.md docs/design/admin/NOTES.md
git commit -m "docs: admin redesign phase 2 (entity pages, side panel, ⌘K)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## Follow-up plans (not in this plan)

- **Phase 3:**
  - Dashboard, Login, the feedback bell, and the remaining pages (Feedback, Users, Audit logs, System status).
  - Rebuild the manifest editors without legacy CSS.
  - Delete `admin.css`, `AdminPageHeader`, `FieldError` and every inline `style={{}}`.
  - Optionally, a data router so the Back button can be guarded.
