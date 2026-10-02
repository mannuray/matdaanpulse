# Admin image upload (party symbols, person photos) — design

Date: 2026-10-02 · Status: approved in chat, awaiting spec review

## Problem

- The party record shows two raw URL inputs ("Logo URL", "ECI symbol URL"); the person record shows a "Photo URL" input. Admins should see and replace the image, never type a URL.
- Party symbols today are static SVGs committed in `frontend/public/symbols/{logos,eci}/`; the DB stores relative paths (`/symbols/logos/BJP.svg`) written by `seed_party_symbols.sql`. Person photos are a bare `persons.photo_url` text column. There is no upload anywhere.
- **Production bug:** the deployed admin cannot show any `/symbols/...` image. Dev proxies `/symbols` to the frontend (`admin/vite.config.ts`), but the admin's Vercel SPA fallback answers `admin.matdaanpulse.in/symbols/logos/BJP.svg` with `index.html`.

## Decisions

| # | Decision |
|---|----------|
| D1 | Real file upload (not paste-a-URL). |
| D2 | Storage: **Vercel Blob** (public store). |
| D3 | Upload happens on file pick (instant preview); the record changes only on **Save changes**. Cancel restores the previous URL. |
| D4 | Orphaned blobs (replaced, or uploaded then cancelled) are left in place — tiny and rare; no cleanup logic now. |
| D5 | No schema change. `parties.symbol_url`, `parties.eci_symbol_url`, `persons.photo_url` keep holding a URL; existing `/symbols/...` paths stay valid. |
| D6 | **Photo lives on the person only.** One photo per politician, shown for every contest. No `candidates.photo_url`. |
| D7 | Future live ECI ingestion may be a photo source: it fills `persons.photo_url` **only when empty** and never overwrites an admin-set photo. (Out of scope here; recorded so ingestion follows it.) A per-contest photo can be added later, non-breaking, if ever needed. |
| D8 | Relative `/symbols/...` paths are resolved in the admin by an `assetUrl()` helper against `VITE_PUBLIC_SITE_URL` (portable to the planned Cloudflare Pages move, unlike a Vercel rewrite). |

## Backend

**Endpoint** `POST /api/v1/admin/media` — `@Roles('SUPER_ADMIN', 'EDITOR')`, JWT, multipart (`@nestjs/platform-express` `FileInterceptor`, memory storage).

- Body: `file` (one file), `kind` ∈ `party-logo | party-eci | person-photo`, `owner_id` (party id or person uuid; used only in the path).
- Validation:
  - Types: PNG, JPEG, WebP, SVG. Check the bytes (magic numbers; for SVG, the text parses as `<svg` root) — not only the extension or client MIME.
  - Size: 1 MB for `party-*`, 2 MB for `person-photo`. Rejected with 400 / 413 and a clear message.
  - `owner_id` is any non-empty string up to 64 chars (party ids may contain punctuation, e.g. `JD(U)`). Only `blobPath` sanitises it for the path: every char outside `[A-Za-z0-9_-]` becomes `_` (`JD(U)` → `parties/JD_U_/logo.png`, `../x` → `___x`), so it can't traverse.
  - The SVG check is a linear regex (prolog, comments, a DOCTYPE with optional internal subset, then `<svg`) — no nested ambiguous repeats, so 4 KB of hostile input can't cause catastrophic backtracking.
- Storage: `put()` from `@vercel/blob`, `access: 'public'`, `addRandomSuffix: true`, correct `contentType`. A `put()` failure becomes 502 `MEDIA_0002` "Image storage failed" (`MediaStorageFailedException`, original error kept as `cause`: logged, never sent). Paths: `parties/<id>/logo.<ext>`, `parties/<id>/eci.<ext>`, `persons/<id>/photo.<ext>`.
- Response: `{ url, pathname, content_type, size }`.
- SVG safety: files are served from the Blob store's own domain (not an app origin) and both apps render them only via `<img>`, which never runs scripts in an SVG.
- Audit: no upload audit row (deviation from the first draft, which had `MEDIA_UPLOAD`). The field change is audited by the party/person update on Save; `RECORD_AUDIT_ACTIONS` drives "last edited by", and an upload that is cancelled must not show as an edit. Orphaned blobs (replaced, or uploaded then cancelled) are left in place.
- Config: `BLOB_READ_WRITE_TOKEN` (Render env, `.env.example`). Without it the endpoint returns 503 "Image upload is not configured" (`MediaNotConfiguredException`, a `BusinessException`, code `MEDIA_0001`; `HttpExceptionFilter` passes BusinessException 5xx code/message through to the client but still logs them as server errors, so a BusinessException's message and details must never hold internal details) — the rest of the API is unaffected.
- New module `backend/src/modules/media/` (controller, service, validator) so the storage call is mockable in one place.
- Persons/parties update DTOs keep accepting `photo_url` / `symbol_url` / `eci_symbol_url` unchanged (URL or relative path, or null to remove).

## Admin UI

### Shared pieces

- `utils/asset-url.ts` — `assetUrl(u)`: absolute URLs pass through; values starting with `/` are prefixed with `VITE_PUBLIC_SITE_URL` (default `http://localhost:3080`); empty → `''`. Used everywhere the admin renders a symbol or photo: Parties list, Persons list, party record, person record, candidate record header, `CandidateMasterCard`. The dev `/symbols` proxy in `vite.config.ts` is removed.
- `services/media.service.ts` — `uploadImage(file, kind, ownerId)` via `apiFetch` (multipart; the client must not set `Content-Type` itself).
- `hooks/useImageUpload.ts` — state machine `idle → uploading → idle | error`, returns the URL to put in the form. Client-side pre-checks mirror the server limits (type/size) to fail fast.
- `components/ui/ImageUpload.tsx` — the preview tile is itself the button: click opens the file picker (also accepts a file dropped on the tile); hover/focus dims it with a camera icon + "Replace". Empty: dashed box with an upload icon and "Upload". A small round ⓧ (lucide `X`, ~22 px, card background, border, shadow, half outside the top-right corner) removes the image, only when set, no confirm (Cancel undoes before Save). Uploading: spinner over the image (`role="status"` "Uploading"); the tile button is `aria-disabled` (not `disabled`, so focus stays) and ignores clicks/drops. Error text under the tile; the previous image stays on failure. Accessible names: "Replace ‹label›" / "Upload ‹label›", "Remove ‹label›"; the hidden file input is "‹label› file" with `tabIndex=-1`. No URL text field, no filename. Replaces `components/entity/parties/SymbolField.tsx` (deleted).

### Party record (`PartyRecord.tsx`)

Symbols card per Stitch `docs/design/admin/party-record.png`: two tiles side by side — **Party logo** and **ECI symbol** — each a click-to-replace preview with a corner ⓧ (see `ImageUpload`). Changes mark the page dirty like any field.

### Person record (`PersonRecord.tsx`)

- Header avatar grows 56 → ~72 px round and becomes a button (`components/record/PhotoButton.tsx`). Click opens the file picker directly; hover/focus dims it with a camera icon; with no photo it shows the initial. A corner ⓧ removes the photo (when set). Uploading/errors as in `ImageUpload`. Accessible names: "Change photo of ‹name›" / "Upload photo of ‹name›", "Remove photo of ‹name›"; the hidden input is "Photo file of ‹name›".
- The "Photo URL" field is removed from the Profile card.
- Staged photo marks the page dirty; Save sends `photo_url` with the other person fields.

### Candidate record (`CandidateRecord.tsx`, `useCandidateEdit.ts`)

- Header photo is the person's photo, the same `PhotoButton`, with the note *"Updates the photo on ‹person name›'s record — every contest shows it."* as a hover/focus tooltip (native `title`) and the button's `aria-describedby` (sr-only span).
- A staged photo marks the page dirty. **Save changes** saves the candidate fields first, then `PUT /admin/persons/:person_id` with only `photo_url`.
- If the candidate save succeeds and the photo save fails: the photo stays staged (page still dirty) with an inline error and Retry; nothing is silently dropped. If only the photo changed, only the person request is sent.
- `CandidateMasterCard` stays read-only and shows the same (saved) photo.

## Testing

- Backend: media validator unit tests (each type accepted, spoofed extension rejected, SVG check, size per kind, bad `owner_id`); controller test for roles and 503 without token; `@vercel/blob` mocked.
- Admin: `assetUrl` tests; `ImageUpload` / `PhotoButton` (click image → chooser, pick → uploading → preview, uploading ignores clicks, failure keeps old image + error, ⓧ remove absent when empty, drop, candidate note via title/aria-describedby); updated `usePartyEdit`, `usePersonEdit`, `useCandidateEdit` (photo-only save, candidate-ok/photo-fail keeps dirty), `Parties`/`Persons` tests that referenced the URL inputs.
- Manual: both record pages and the candidate page in the browser (screenshots), including a real upload against a Blob store, and the production `/symbols` fix verified on the deployed admin.

## Docs and config

- `.env.example`: `BLOB_READ_WRITE_TOKEN`, `VITE_PUBLIC_SITE_URL` (admin build env on Vercel = public site URL).
- `docs/FEATURES.md`: image upload feature; `CLAUDE.md`: media storage line in Tech Stack; `docs/DEPLOYMENT.md`: Blob store + env vars.

## Out of scope

- Per-contest (candidate) photos; ECI photo ingestion (see D7).
- Blob cleanup of orphans; image resizing/cropping.
- Public site changes (it already reads `person.photo_url`; Blob URLs are absolute and work as-is).
