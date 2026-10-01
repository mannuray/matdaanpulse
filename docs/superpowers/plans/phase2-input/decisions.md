# Phase 2 decisions already made (controller)

- Branch: feat/admin-redesign-phase2 (from main after Phase 1 merge).
- Candidates stay constituency-scoped: backend findAll has take=1000 and no pagination. Toolbar: global election (top bar) + Seat select (searchable) + All/Linked/Unlinked chips + name search within the seat. Default seat = first by const_no. No backend changes for candidates.
- Manifests: page lists elections (one manifest each: name, type, year, status, draft/published badge) in the standard table; clicking opens a FULL-WIDTH sheet hosting the manifest editor. Keep the existing editor internals (components/manifest/*, ManifestSection, JSON tab) inside the sheet with minimal restyle; their legacy CSS keeps working (legacy layer). Read-only summary (old ManifestDetail) becomes the sheet's default "Summary" tab; "Edit" tab = editor. Save draft / Publish (SUPER_ADMIN, confirm) in the sheet footer.
- Side panel = Radix Dialog as a right sheet, 400px, NON-MODAL (modal={false}, no overlay; table stays visible and scrollable), Esc closes (with unsaved guard). URL is /x/:id; /x/:id/edit redirects to /x/:id. Closing navigates to /x (preserving query string).
- Unsaved-change guard: reuse ShellStatusContext editorDirty/setEditorDirty + confirmDiscardEdits (already guards sidebar + election picker + beforeunload pattern in LiveConsole). Generalise beforeunload into a small hook `useUnsavedGuard(dirty)` used by Live Console and every panel.
- All entity pages use the global election from useElection() where they need one (Candidates, Constituencies); remove AdminLandingCard and the per-page ElectionPicker/localStorage election keys. If no election: EmptyState linking to /elections.
- Bug fixes to include (each with a regression test):
  1. usePersonEdit merge calls mergePersons(id, sourceId) but signature is (sourceId, targetId) and backend deletes source → the person being viewed is deleted. Correct: mergePersons(sourceId=duplicate, targetId=current).
  2. useResourceList.loadPage does not setPage → Party/Person paging broken.
  3. Person list gender mapping 'M'/'F' vs form 'Male'/'Female'/'Other' → show stored value (map M/F legacy too).
  4. CandidateEdit never saves photo_url — photo_url belongs to the person; decide: candidate panel shows person photo read-only; remove the dead photo_url field (do not send).
  5. Persons list ignores ?q= → read ?q= as initial search (Candidates "Find" link then works; in the panel it becomes the person search).
  6. Constituency list unreachable past 100 rows → add pager; district/tag filters stay client-side but labelled "on this page" OR move to server if the API supports it (check backend admin constituencies endpoint; prefer server if params exist, else keep client and label).
  7. Constituency numeric fields `Number(x) || null` turns 0 into null; const_no NaN unguarded → fix.
- Elections: no detail page; panel = the create/edit form (5 fields) + Go live (EDITOR+, add confirm) + Finalize (SUPER_ADMIN, existing confirm dialog kept as modal). "New election" opens the panel in create mode at /elections/new.
- Parties: "New party" opens panel at /parties/new (id, name, abbreviation, colour); existing parties panel = full edit form (11 fields) single-column + logo/ECI symbol cards. Show candidate_count.
- Persons: no create in UI (unchanged). Panel = edit form (7 fields) + election history list + Merge duplicates (SUPER_ADMIN).
- ⌘K command search: Radix Dialog palette opened by ⌘K/Ctrl+K and the top-bar search field; searches seats (`/search/constituencies`) and candidates (`/search/candidates`) — check backend search controller params — plus static nav items; results navigate to /constituencies/:id, /candidates/:id (setting election via setElectionId if the result's election differs), or the page.
- Remove: old *Detail/*Edit pages, AdminLandingCard, AdminPageHeader (if unused), ElectionPicker component (legacy), their routes (redirects instead), and any now-unused legacy CSS classes ONLY if trivially safe — full admin.css removal is Phase 3.
- Styling: Tailwind + Radix only, tokens from admin/src/theme/tailwind.css, `tw-ui` class on page roots and every Radix portal (scoped control reset), add @source lines for every new dir/file. Reference design: docs/design/admin/candidates.png/.html.
- Testing: vitest + Testing Library per hook and page; keep existing tests green; `npm test && npm run build` per task; backend tests only if backend touched.
- Docs: FEATURES.md entry, CLAUDE.md admin line, NOTES.md.
