# Admin Image Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins replace party symbols and person photos by uploading files (stored in Vercel Blob) instead of typing URLs; the deployed admin shows `/symbols/...` images again.

**Architecture:** One backend endpoint `POST /api/v1/admin/media` validates the bytes and `put()`s them to Vercel Blob, returning a public URL. The admin uploads on file pick and stores the returned URL in the existing form field (`symbol_url`, `eci_symbol_url`, `photo_url`); the record changes only on Save. No schema change. Relative `/symbols/...` paths are resolved by `assetUrl()` against the public site.

**Tech Stack:** NestJS 10 + `@nestjs/platform-express` (multer) + `@vercel/blob`; React + Vite + Tailwind v4 + Radix (`@radix-ui/react-dropdown-menu`); Jest (backend), Vitest + Testing Library (admin).

**Spec:** `docs/superpowers/specs/2026-10-02-admin-image-upload-design.md`

## Global Constraints

- Allowed image types: PNG, JPEG, WebP, SVG — checked on the bytes, not the extension or client MIME.
- Size limits: 1 MB (1 048 576 bytes) for `party-logo` / `party-eci`; 2 MB (2 097 152 bytes) for `person-photo`.
- Roles: `SUPER_ADMIN`, `EDITOR`.
- Blob paths: `parties/<id>/logo.<ext>`, `parties/<id>/eci.<ext>`, `persons/<id>/photo.<ext>`, `access: 'public'`, `addRandomSuffix: true`.
- Without `BLOB_READ_WRITE_TOKEN` the endpoint answers 503 "Image upload is not configured".
- Upload on pick; the record changes only on **Save changes**; Cancel restores the previous URL; orphan blobs are left.
- Photo lives on the person only (no `candidates.photo_url`).
- No URL text input for images anywhere in the admin.
- Admin Tailwind classes only in `src/components`, `src/pages`, `src/context`, `src/App.tsx`.
- Sentence case for all UI copy. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Deviation from spec (recorded):** no `MEDIA_UPLOAD` audit row. `RECORD_AUDIT_ACTIONS` drives "last edited by"; an upload that is then cancelled must not show as an edit. The field change is audited by the existing party/person update on Save. Update the spec's Audit line in Task 7.

## Review Focus

1. A file renamed to `.png` that is really HTML/JS → rejected with 400 (validator test in Task 1).
2. An SVG that starts with an XML declaration, a comment, or a BOM (real seed files) → accepted (Task 1 test uses `frontend/public/symbols/logos/BJP.svg` and prefixed variants).
3. Upload fails (network / 413 / 503) → the previous image stays, the error text is shown, the form is not dirtied (Task 3 test).
4. Candidate page: candidate fields save but the person photo save fails → page stays dirty for the photo only, inline error, nothing lost; a second Save retries just the photo (Task 6 test).
5. `FormData` POST through `apiFetch` must not carry `Content-Type: application/json` (Task 3 test) — otherwise multer sees no file.

---

### Task 1: Backend media upload endpoint

**Files:**
- Create: `backend/src/modules/media/media-validation.ts`
- Create: `backend/src/modules/media/media-validation.spec.ts`
- Create: `backend/src/modules/media/media.service.ts`
- Create: `backend/src/modules/media/media.service.spec.ts`
- Create: `backend/src/modules/media/media.module.ts`
- Create: `backend/src/modules/media/dto/upload-media.dto.ts`
- Create: `backend/src/modules/admin/controllers/admin-media.controller.ts`
- Create: `backend/src/modules/admin/controllers/admin-media.controller.spec.ts`
- Modify: `backend/src/modules/admin/admin.module.ts` (import `MediaModule`, add `AdminMediaController`)
- Modify: `backend/package.json` (deps `@vercel/blob`, devDeps `@types/multer`)
- Modify: `.env.example` (add `BLOB_READ_WRITE_TOKEN=` with a comment)

**Interfaces:**
- Produces: `POST /api/v1/admin/media` multipart fields `file`, `kind`, `owner_id` → `{ url: string; pathname: string; content_type: string; size: number }` (wrapped by the global response interceptor as usual; the admin `apiFetch` unwraps `data`).
- Errors: 400 bad type / missing file / bad kind / bad owner_id; 413 too large; 503 not configured.

- [ ] **Step 1: Install deps**

Run: `cd backend && npm install @vercel/blob && npm install -D @types/multer`
Check `@vercel/blob` loads from CommonJS: `node -e "console.log(typeof require('@vercel/blob').put)"` → `function`. If it is ESM-only, pin the newest version that ships CJS and note it in the commit.

- [ ] **Step 2: Write the failing validator tests** — `media-validation.spec.ts`

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { sniffImage, validateUpload, MAX_BYTES, blobPath } from './media-validation';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const svg = (s: string) => Buffer.from(s, 'utf8');
const seedSvg = readFileSync(join(__dirname, '../../../../frontend/public/symbols/logos/BJP.svg'));
const file = (buffer: Buffer) => ({ buffer, size: buffer.length });

describe('sniffImage', () => {
  it.each([
    ['png', PNG, 'image/png'],
    ['jpg', JPG, 'image/jpeg'],
    ['webp', WEBP, 'image/webp'],
  ])('detects %s', (ext, buf, type) => expect(sniffImage(buf)).toEqual({ ext, contentType: type }));

  it('detects a real seed SVG', () => expect(sniffImage(seedSvg)?.ext).toBe('svg'));
  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    '﻿<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n<svg viewBox="0 0 1 1"/>',
    '   \n<svg>',
  ])('accepts SVG with prolog variants: %#', (s) => expect(sniffImage(svg(s))).toEqual({ ext: 'svg', contentType: 'image/svg+xml' }));

  it.each([
    ['html', svg('<!doctype html><html><script>alert(1)</script>')],
    ['js', svg('alert(1)')],
    ['empty', Buffer.alloc(0)],
    ['svg-after-html', svg('<html><svg></svg></html>')],
  ])('rejects %s', (_n, buf) => expect(sniffImage(buf)).toBeNull());
});

describe('validateUpload', () => {
  it('returns type and path for a valid party logo', () => {
    expect(validateUpload(file(PNG), 'party-logo', 'BJP')).toEqual({ ext: 'png', contentType: 'image/png', path: 'parties/BJP/logo.png' });
  });
  it('person photo path', () => {
    expect(validateUpload(file(JPG), 'person-photo', '6a14c00a-1b2c-4d5e-8f90-123456789abc').path)
      .toBe('persons/6a14c00a-1b2c-4d5e-8f90-123456789abc/photo.jpg');
  });
  it('rejects a missing file', () => expect(() => validateUpload(undefined, 'party-logo', 'BJP')).toThrow(BadRequestException));
  it('rejects a spoofed type', () => expect(() => validateUpload(file(svg('<html>')), 'party-eci', 'BJP')).toThrow(/PNG, JPEG, WebP or SVG/));
  it('rejects an unknown kind', () => expect(() => validateUpload(file(PNG), 'banner' as any, 'BJP')).toThrow(BadRequestException));
  it.each(['../x', 'a/b', '', 'x'.repeat(65)])('rejects owner id %p', (id) =>
    expect(() => validateUpload(file(PNG), 'party-logo', id)).toThrow(BadRequestException));
  it('size limit is per kind', () => {
    const big = { buffer: PNG, size: MAX_BYTES['party-logo'] + 1 };
    expect(() => validateUpload(big, 'party-logo', 'BJP')).toThrow(PayloadTooLargeException);
    expect(validateUpload(big, 'person-photo', 'p1').ext).toBe('png');
  });
  it('blobPath', () => expect(blobPath('party-eci', 'AAP', 'svg')).toBe('parties/AAP/eci.svg'));
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd backend && npx jest src/modules/media/media-validation.spec.ts`
Expected: FAIL — cannot find module `./media-validation`.

- [ ] **Step 4: Implement** — `media-validation.ts`

```ts
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export const MEDIA_KINDS = ['party-logo', 'party-eci', 'person-photo'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const MB = 1024 * 1024;
export const MAX_BYTES: Record<MediaKind, number> = { 'party-logo': MB, 'party-eci': MB, 'person-photo': 2 * MB };
/** Multer's hard cap: the largest per-kind limit (the per-kind check runs after). */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(MAX_BYTES));

export const OWNER_ID = /^[A-Za-z0-9_-]{1,64}$/;

export interface ImageType { ext: 'png' | 'jpg' | 'webp' | 'svg'; contentType: string }

// XML prolog, comments and a doctype may come before the <svg> root (seed files have them).
const SVG_ROOT = /^(?:<\?xml[^>]*>\s*|<!--[\s\S]*?-->\s*|<!DOCTYPE[^>]*>\s*)*<svg[\s>/]/i;

/** The image type from the file's bytes, or null when it is not PNG, JPEG, WebP or SVG. */
export function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  const head = buf.subarray(0, 4096).toString('utf8').replace(/^﻿/, '').trimStart();
  if (SVG_ROOT.test(head)) return { ext: 'svg', contentType: 'image/svg+xml' };
  return null;
}

const NAMES: Record<MediaKind, string> = { 'party-logo': 'logo', 'party-eci': 'eci', 'person-photo': 'photo' };
export function blobPath(kind: MediaKind, ownerId: string, ext: string): string {
  return `${kind === 'person-photo' ? 'persons' : 'parties'}/${ownerId}/${NAMES[kind]}.${ext}`;
}

/** Checks an uploaded file for its kind; throws 400/413 with a message the admin shows as-is. */
export function validateUpload(
  file: { buffer: Buffer; size: number } | undefined,
  kind: MediaKind,
  ownerId: string,
): ImageType & { path: string } {
  if (!MEDIA_KINDS.includes(kind)) throw new BadRequestException(`Unknown image kind "${kind}"`);
  if (!OWNER_ID.test(ownerId ?? '')) throw new BadRequestException('Invalid owner id');
  if (!file || !file.buffer?.length) throw new BadRequestException('Choose an image file');
  if (file.size > MAX_BYTES[kind]) {
    throw new PayloadTooLargeException(`Image is too large (max ${MAX_BYTES[kind] / MB} MB)`);
  }
  const type = sniffImage(file.buffer);
  if (!type) throw new BadRequestException('Use a PNG, JPEG, WebP or SVG image');
  return { ...type, path: blobPath(kind, ownerId, type.ext) };
}
```

- [ ] **Step 5: Run validator tests** — `npx jest src/modules/media/media-validation.spec.ts` → PASS.

- [ ] **Step 6: Failing service + controller tests**

`media.service.spec.ts`:

```ts
import { ServiceUnavailableException } from '@nestjs/common';
jest.mock('@vercel/blob', () => ({ put: jest.fn() }));
import { put } from '@vercel/blob';
import { MediaService } from './media.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const config = (token?: string) => ({ get: jest.fn(() => token) }) as any;

describe('MediaService', () => {
  afterEach(() => jest.clearAllMocks());

  it('503 when BLOB_READ_WRITE_TOKEN is missing (before touching the file)', async () => {
    await expect(new MediaService(config()).upload(undefined, 'party-logo', 'BJP')).rejects.toThrow(ServiceUnavailableException);
    expect(put).not.toHaveBeenCalled();
  });

  it('puts a public, randomly suffixed blob with the sniffed content type', async () => {
    (put as jest.Mock).mockResolvedValue({ url: 'https://x.public.blob.vercel-storage.com/parties/BJP/logo-abc.png', pathname: 'parties/BJP/logo-abc.png' });
    const out = await new MediaService(config('tok')).upload({ buffer: PNG, size: PNG.length }, 'party-logo', 'BJP');
    expect(put).toHaveBeenCalledWith('parties/BJP/logo.png', PNG, { access: 'public', addRandomSuffix: true, contentType: 'image/png', token: 'tok' });
    expect(out).toEqual({ url: 'https://x.public.blob.vercel-storage.com/parties/BJP/logo-abc.png', pathname: 'parties/BJP/logo-abc.png', content_type: 'image/png', size: PNG.length });
  });
});
```

`admin-media.controller.spec.ts` (roles + delegation, same Reflector pattern as `admin-record-detail.spec.ts`):

```ts
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { AdminMediaController } from './admin-media.controller';

describe('AdminMediaController', () => {
  it('is limited to SUPER_ADMIN and EDITOR', () => {
    const roles = new Reflector().get(ROLES_KEY, AdminMediaController.prototype.upload);
    expect(roles).toEqual(['SUPER_ADMIN', 'EDITOR']);
  });
  it('passes the file, kind and owner id to the service', async () => {
    const media = { upload: jest.fn().mockResolvedValue({ url: 'u' }) };
    const file = { buffer: Buffer.from('x'), size: 1 } as any;
    await new AdminMediaController(media as any).upload(file, { kind: 'person-photo', owner_id: 'p1' });
    expect(media.upload).toHaveBeenCalledWith(file, 'person-photo', 'p1');
  });
});
```

Run: `npx jest src/modules/media src/modules/admin/controllers/admin-media.controller.spec.ts` → FAIL (modules missing).

- [ ] **Step 7: Implement service, DTO, module, controller**

`media.service.ts`:

```ts
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { put } from '@vercel/blob';
import { validateUpload, type MediaKind } from './media-validation';

export interface UploadedMedia { url: string; pathname: string; content_type: string; size: number }

/** Admin image uploads (party symbols, person photos) to Vercel Blob. The record stores the returned URL on Save. */
@Injectable()
export class MediaService {
  constructor(private readonly config: ConfigService) {}

  async upload(file: { buffer: Buffer; size: number } | undefined, kind: MediaKind, ownerId: string): Promise<UploadedMedia> {
    const token = this.config.get<string>('BLOB_READ_WRITE_TOKEN');
    if (!token) throw new ServiceUnavailableException('Image upload is not configured');
    const { path, contentType } = validateUpload(file, kind, ownerId);
    const blob = await put(path, file!.buffer, { access: 'public', addRandomSuffix: true, contentType, token });
    return { url: blob.url, pathname: blob.pathname, content_type: contentType, size: file!.size };
  }
}
```

`dto/upload-media.dto.ts`:

```ts
import { IsIn, Matches } from 'class-validator';
import { MEDIA_KINDS, OWNER_ID, type MediaKind } from '../media-validation';

export class UploadMediaDto {
  @IsIn(MEDIA_KINDS as unknown as string[]) kind: MediaKind;
  @Matches(OWNER_ID) owner_id: string;
}
```

`media.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { MediaService } from './media.service';

@Module({ providers: [MediaService], exports: [MediaService] })
export class MediaModule {}
```

`admin-media.controller.ts`:

```ts
import { Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MediaService } from '../../media/media.service';
import { MAX_UPLOAD_BYTES } from '../../media/media-validation';
import { UploadMediaDto } from '../../media/dto/upload-media.dto';

@Controller('admin/media')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminMediaController {
  constructor(private readonly media: MediaService) {}

  /** One image (party logo / ECI symbol / person photo). Memory storage; per-kind limits are checked by the service. */
  @Post()
  @Roles('SUPER_ADMIN', 'EDITOR')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(@UploadedFile() file: Express.Multer.File | undefined, @Body() body: UploadMediaDto) {
    return this.media.upload(file, body.kind, body.owner_id);
  }
}
```

Register in `admin.module.ts`: add `MediaModule` to `imports`, `AdminMediaController` to `controllers`.

- [ ] **Step 8: Run all backend tests + build**

Run: `cd backend && npx jest && npm run build` → all PASS, build OK.

- [ ] **Step 9: Live smoke check** (backend dev server on 3082, an admin JWT from `POST /api/v1/auth/login`):

```bash
curl -s -X POST localhost:3082/api/v1/admin/media -H "Authorization: Bearer $TOKEN" \
  -F kind=party-logo -F owner_id=BJP -F file=@frontend/public/symbols/logos/BJP.svg
```
Expected without a token configured: 503 `Image upload is not configured`. Also confirm a 3 MB file returns 413 (multer cap) and a `.png`-named text file returns 400.

- [ ] **Step 10: Add `.env.example` entry and commit**

```
# Vercel Blob read-write token for admin image uploads (party symbols, person photos). Unset = uploads return 503.
BLOB_READ_WRITE_TOKEN=
```

```bash
git add backend .env.example
git commit -m "feat(api): admin image upload to Vercel Blob (POST /admin/media)"
```

---

### Task 2: `assetUrl()` — fix `/symbols` images in the deployed admin

**Files:**
- Create: `admin/src/utils/asset-url.ts`, `admin/src/utils/asset-url.test.ts`
- Modify: `admin/src/pages/Parties.tsx:43-44`, `admin/src/pages/Persons.tsx:36`, `admin/src/components/entity/candidates/CandidateRecord.tsx:110`, `admin/src/components/entity/candidates/CandidateMasterCard.tsx:50`, `admin/src/components/entity/parties/SymbolField.tsx:10`, `admin/src/components/entity/persons/PersonRecord.tsx:83` — wrap every `src={…}` image URL in `assetUrl(…)`.
- Modify: `admin/vite.config.ts` — remove the `'/symbols'` proxy entry.
- Modify: `.env.example` — `VITE_PUBLIC_SITE_URL` (admin build env).

**Interfaces:**
- Produces: `assetUrl(u: string | null | undefined): string` from `admin/src/utils/asset-url.ts`.

- [ ] **Step 1: Failing test** — `asset-url.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { assetUrl, resolveAssetUrl } from './asset-url';

describe('assetUrl', () => {
  it('passes absolute URLs through', () => expect(assetUrl('https://x.blob.vercel-storage.com/a.png')).toBe('https://x.blob.vercel-storage.com/a.png'));
  it('empty for null/blank', () => { expect(assetUrl(null)).toBe(''); expect(assetUrl('')).toBe(''); expect(assetUrl(undefined)).toBe(''); });
  it('prefixes site-relative paths with the public site', () =>
    expect(resolveAssetUrl('/symbols/logos/BJP.svg', 'https://www.matdaanpulse.in/')).toBe('https://www.matdaanpulse.in/symbols/logos/BJP.svg'));
  it('leaves other values alone', () => expect(resolveAssetUrl('data:image/png;base64,xx', 'https://s')).toBe('data:image/png;base64,xx'));
});
```

- [ ] **Step 2: Run** `cd admin && npx vitest run src/utils/asset-url.test.ts` → FAIL.

- [ ] **Step 3: Implement** — `asset-url.ts`

```ts
const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'http://localhost:3080';

/** `base` + a site-relative path ("/symbols/…"); absolute and data: URLs unchanged. */
export function resolveAssetUrl(u: string | null | undefined, base: string): string {
  if (!u) return '';
  return u.startsWith('/') ? `${base.replace(/\/+$/, '')}${u}` : u;
}

/**
 * Where an image field points. Seeded party symbols are paths on the public site (/symbols/logos/X.svg), which the
 * admin's own host does not serve; uploads are absolute Blob URLs.
 */
export const assetUrl = (u: string | null | undefined) => resolveAssetUrl(u, PUBLIC_SITE_URL);
```

- [ ] **Step 4: Apply at every image site** listed under Files, e.g. `Parties.tsx`: `<img src={assetUrl(p.symbol_url || p.eci_symbol_url)} … />`. Run `grep -rn "<img" admin/src --include=*.tsx` afterwards: every `src` that renders a symbol or photo uses `assetUrl`. Remove the `/symbols` proxy from `vite.config.ts`.

- [ ] **Step 5: Run** `cd admin && npx vitest run && npx tsc -b --noEmit` (or `npm run build`) → PASS.

- [ ] **Step 6: `.env.example`**

```
# Admin build: public site origin, used to show site-relative images (/symbols/...) in the admin.
VITE_PUBLIC_SITE_URL=http://localhost:3080
```

- [ ] **Step 7: Commit** — `git commit -m "fix(admin): show /symbols images outside dev via assetUrl"`

---

### Task 3: Admin upload plumbing + `ImageUpload` component

**Files:**
- Modify: `admin/src/services/api-client.ts` (no JSON `Content-Type` for `FormData` bodies)
- Create: `admin/src/services/media.service.ts`
- Create: `admin/src/utils/image-file.ts` (client pre-check)
- Create: `admin/src/hooks/useImageUpload.ts`
- Create: `admin/src/components/ui/ImageUpload.tsx`
- Test: `admin/src/services/media.service.test.ts`, `admin/src/components/ui/ImageUpload.test.tsx`

**Interfaces:**
- Consumes: `assetUrl` (Task 2).
- Produces:
  - `type MediaKind = 'party-logo' | 'party-eci' | 'person-photo'`
  - `uploadImage(file: File, kind: MediaKind, ownerId: string): Promise<UploadedImage>`; `UploadedImage = { url: string; pathname: string; content_type: string; size: number }`
  - `checkImageFile(file: File, kind: MediaKind): string | null` (error message or null)
  - `useImageUpload(kind: MediaKind, ownerId: string, onUploaded: (url: string) => void): { uploading: boolean; error: string | null; upload: (file: File) => Promise<void>; clearError: () => void }`
  - `<ImageUpload label kind ownerId url onChange showFilename? />` — `onChange(url: string)`; `''` means removed.
  - `fileNameOf(url: string): string` exported from `ImageUpload.tsx`.

- [ ] **Step 1: Failing tests**

`media.service.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
vi.mock('./auth.service', () => ({ getToken: () => 'tok', handleUnauthorized: vi.fn() }));
import { uploadImage } from './media.service';
import { checkImageFile } from '../utils/image-file';

afterEach(() => vi.restoreAllMocks());

describe('uploadImage', () => {
  it('posts multipart without a JSON content type, with auth', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, data: { url: 'https://b/x.png' } }), { status: 201 }));
    const out = await uploadImage(new File(['x'], 'x.png', { type: 'image/png' }), 'party-logo', 'BJP');
    expect(out.url).toBe('https://b/x.png');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/admin\/media$/);
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
    expect(headers.Authorization).toBe('Bearer tok');
    const fd = init.body as FormData;
    expect(fd.get('kind')).toBe('party-logo');
    expect(fd.get('owner_id')).toBe('BJP');
  });
});

describe('checkImageFile', () => {
  it('rejects non-images and oversize files per kind', () => {
    expect(checkImageFile(new File(['x'], 'a.gif', { type: 'image/gif' }), 'party-logo')).toMatch(/PNG, JPEG, WebP or SVG/);
    const big = new File([new Uint8Array(1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    expect(checkImageFile(big, 'party-logo')).toMatch(/1 MB/);
    expect(checkImageFile(big, 'person-photo')).toBeNull();
  });
});
```

`ImageUpload.test.tsx`:

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
vi.mock('../../services/media.service', () => ({ uploadImage: vi.fn() }));
import { uploadImage } from '../../services/media.service';
import { ImageUpload, fileNameOf } from './ImageUpload';
import { ApiError } from '../../services/api-client';

afterEach(() => vi.clearAllMocks());
const png = () => new File(['x'], 'logo.png', { type: 'image/png' });

describe('ImageUpload', () => {
  it('uploads the picked file and reports the new URL', async () => {
    vi.mocked(uploadImage).mockResolvedValue({ url: 'https://b/new.png', pathname: 'p', content_type: 'image/png', size: 1 });
    const onChange = vi.fn();
    render(<ImageUpload label="Party logo" kind="party-logo" ownerId="BJP" url="/symbols/logos/BJP.svg" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Upload Party logo'), { target: { files: [png()] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://b/new.png'));
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), 'party-logo', 'BJP');
  });

  it('keeps the old image and shows the error when the upload fails', async () => {
    vi.mocked(uploadImage).mockRejectedValue(new ApiError('Image is too large (max 1 MB)', 413));
    const onChange = vi.fn();
    render(<ImageUpload label="Party logo" kind="party-logo" ownerId="BJP" url="https://b/old.png" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Upload Party logo'), { target: { files: [png()] } });
    expect(await screen.findByText('Image is too large (max 1 MB)')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://b/old.png');
  });

  it('rejects a wrong type before uploading', async () => {
    render(<ImageUpload label="Party logo" kind="party-logo" ownerId="BJP" url="" onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Upload Party logo'), { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } });
    expect(await screen.findByText(/PNG, JPEG, WebP or SVG/)).toBeTruthy();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('Remove clears the URL; no Remove when empty', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ImageUpload label="ECI symbol" kind="party-eci" ownerId="BJP" url="https://b/x.svg" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove ECI symbol' }));
    expect(onChange).toHaveBeenCalledWith('');
    rerender(<ImageUpload label="ECI symbol" kind="party-eci" ownerId="BJP" url="" onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Remove ECI symbol' })).toBeNull();
  });

  it('accepts a dropped file', async () => {
    vi.mocked(uploadImage).mockResolvedValue({ url: 'https://b/d.png', pathname: 'p', content_type: 'image/png', size: 1 });
    const onChange = vi.fn();
    render(<ImageUpload label="Party logo" kind="party-logo" ownerId="BJP" url="" onChange={onChange} />);
    fireEvent.drop(screen.getByTestId('image-drop'), { dataTransfer: { files: [png()] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://b/d.png'));
  });

  it('fileNameOf strips the Blob random suffix-free path to its last segment', () => {
    expect(fileNameOf('/symbols/logos/BJP.svg')).toBe('BJP.svg');
    expect(fileNameOf('https://x.public.blob.vercel-storage.com/parties/BJP/logo-Ab12.png')).toBe('logo-Ab12.png');
  });
});
```

Run: `cd admin && npx vitest run src/services/media.service.test.ts src/components/ui/ImageUpload.test.tsx` → FAIL.

- [ ] **Step 2: `apiFetch` — FormData bodies**

In `api-client.ts`, replace the headers line:

```ts
  // A FormData body sets its own multipart Content-Type (with the boundary); never override it.
  const headers: Record<string, string> = options?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
```

- [ ] **Step 3: `utils/image-file.ts`**

```ts
import type { MediaKind } from '../services/media.service';

const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MB = 1024 * 1024;
const MAX: Record<MediaKind, number> = { 'party-logo': MB, 'party-eci': MB, 'person-photo': 2 * MB };

/** Same limits as the server (which checks the bytes too); an error message, or null when the file may be sent. */
export function checkImageFile(file: File, kind: MediaKind): string | null {
  if (!TYPES.includes(file.type)) return 'Use a PNG, JPEG, WebP or SVG image';
  if (file.size > MAX[kind]) return `Image is too large (max ${MAX[kind] / MB} MB)`;
  return null;
}
```

- [ ] **Step 4: `services/media.service.ts`**

```ts
import { apiFetch } from './api-client';

export type MediaKind = 'party-logo' | 'party-eci' | 'person-photo';
export interface UploadedImage { url: string; pathname: string; content_type: string; size: number }

/** Uploads one image; the caller puts the returned URL in the record's form (saved with the record). */
export function uploadImage(file: File, kind: MediaKind, ownerId: string): Promise<UploadedImage> {
  const body = new FormData();
  body.append('kind', kind);
  body.append('owner_id', ownerId);
  body.append('file', file);
  return apiFetch<UploadedImage>('/admin/media', { method: 'POST', body });
}
```

- [ ] **Step 5: `hooks/useImageUpload.ts`**

```ts
import { useCallback, useState } from 'react';
import { uploadImage, type MediaKind } from '../services/media.service';
import { checkImageFile } from '../utils/image-file';

/** Upload-on-pick: checks the file, uploads it, then hands the URL to the form. A failure leaves the form untouched. */
export function useImageUpload(kind: MediaKind, ownerId: string, onUploaded: (url: string) => void) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    const invalid = checkImageFile(file, kind);
    if (invalid) { setError(invalid); return; }
    setError(null);
    setUploading(true);
    try {
      const { url } = await uploadImage(file, kind, ownerId);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [kind, ownerId, onUploaded]);

  return { uploading, error, upload, clearError: () => setError(null) };
}
```

- [ ] **Step 6: `components/ui/ImageUpload.tsx`**

```tsx
import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from './Button';
import { cn } from './cn';
import { assetUrl } from '../../utils/asset-url';
import { useImageUpload } from '../../hooks/useImageUpload';
import type { MediaKind } from '../../services/media.service';

export const fileNameOf = (url: string) => url.split('?')[0].split('/').filter(Boolean).pop() ?? '';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

/**
 * Image field with no URL text: preview tile, Replace (file picker, or drop a file on the tile), Remove.
 * Upload happens on pick; `onChange` gets the new URL ('' = removed) and the record saves it with Save changes.
 */
export function ImageUpload({ label, kind, ownerId, url, onChange, showFilename = true }: {
  label: string; kind: MediaKind; ownerId: string; url: string; onChange: (url: string) => void; showFilename?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const { uploading, error, upload, clearError } = useImageUpload(kind, ownerId, onChange);
  const pick = (files: FileList | null | undefined) => { const f = files?.[0]; if (f) void upload(f); };

  return (
    <div className="flex min-w-0 flex-col items-center gap-2 rounded-card border border-line p-3 text-center">
      <div className="text-xs font-medium text-ink-2">{label}</div>
      <div
        data-testid="image-drop"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer?.files); }}
        className={cn('relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-card border bg-card p-1.5',
          over ? 'border-accent ring-2 ring-accent/30' : 'border-line')}
      >
        {url ? <img src={assetUrl(url)} alt={label} className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted">None</span>}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-card/70" aria-label="Uploading">
            <Loader2 size={18} className="animate-spin text-accent" aria-hidden />
          </span>
        )}
      </div>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label={`Upload ${label}`}
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      <div className="flex gap-1.5">
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => { clearError(); input.current?.click(); }}>
          {url ? 'Replace' : 'Upload'}
        </Button>
        {url && <Button variant="ghost" size="sm" disabled={uploading} aria-label={`Remove ${label}`} onClick={() => { clearError(); onChange(''); }}>Remove</Button>}
      </div>
      {showFilename && url && (
        <span title={url} className="max-w-full truncate rounded-control bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-muted">{fileNameOf(url)}</span>
      )}
      {error && <p role="alert" className="text-xs text-bad-text">{error}</p>}
    </div>
  );
}
```

(Check `lucide-react` is the admin's icon package — it is used in `CandidateMasterCard` (`ArrowRight`). Check `Button` supports `variant="outline" | "ghost"` and `size="sm"` — `SymbolField` uses both. Note: `img` has `alt={label}` so the test's `getByRole('img')` finds it.)

- [ ] **Step 7: Run tests** — `npx vitest run src/services src/components/ui` → PASS. Full `npx vitest run` → PASS.

- [ ] **Step 8: Commit** — `git commit -m "feat(admin): ImageUpload with upload-on-pick"`

---

### Task 4: Party record — Symbols card per Stitch

**Files:**
- Modify: `admin/src/components/entity/parties/PartyRecord.tsx:116-120`
- Delete: `admin/src/components/entity/parties/SymbolField.tsx`
- Test: `admin/src/pages/Parties.test.tsx` (update any assertions on "Logo URL" / "ECI symbol URL" inputs)

**Interfaces:**
- Consumes: `<ImageUpload>` (Task 3). `form.symbol_url` / `form.eci_symbol_url` / `set()` from `usePartyEdit` unchanged; the party id for `ownerId` is the record's `id` prop/route param already in `PartyRecord`.

- [ ] **Step 1: Failing test** in `Parties.test.tsx` (open a party record as existing tests do):

```tsx
it('symbols card shows image tiles, no URL inputs', async () => {
  renderAt('/parties/BJP');
  expect(await screen.findByText('Party logo')).toBeTruthy();
  expect(screen.getByText('ECI symbol')).toBeTruthy();
  expect(screen.queryByLabelText('Logo URL')).toBeNull();
  expect(screen.queryByLabelText('ECI symbol URL')).toBeNull();
  expect(screen.getByLabelText('Upload Party logo')).toBeTruthy();
});
```

Run → FAIL.

- [ ] **Step 2: Implement** — replace the Symbols card body:

```tsx
<RecordCard title="Symbols">
  <div className="grid grid-cols-2 gap-3">
    <ImageUpload label="Party logo" kind="party-logo" ownerId={id} url={form.symbol_url} onChange={(symbol_url) => set({ symbol_url })} />
    <ImageUpload label="ECI symbol" kind="party-eci" ownerId={id} url={form.eci_symbol_url} onChange={(eci_symbol_url) => set({ eci_symbol_url })} />
  </div>
  {(fieldErrors.symbol_url || fieldErrors.eci_symbol_url) && (
    <p className="mt-2 text-xs text-bad-text">{fieldErrors.symbol_url || fieldErrors.eci_symbol_url}</p>
  )}
</RecordCard>
```

Delete `SymbolField.tsx` and its import. Fix any test that typed into the URL inputs: set the form via the hook instead, or assert via the tile.

- [ ] **Step 3: Run** `npx vitest run` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "feat(admin): party symbols as image tiles"`

---

### Task 5: Person record — clickable header photo

**Files:**
- Create: `admin/src/components/record/PhotoButton.tsx`
- Create: `admin/src/components/record/PhotoButton.test.tsx`
- Modify: `admin/src/components/entity/persons/PersonRecord.tsx:81-85` (leading) and `:131-133` (remove Photo URL field)
- Test: `admin/src/pages/Persons.test.tsx` (drop "Photo URL" input assertions)

**Interfaces:**
- Consumes: `useImageUpload` (Task 3), `assetUrl` (Task 2), `@radix-ui/react-dropdown-menu` (see `components/shell/TopBar.tsx` for the menu styling to copy).
- Produces: `<PhotoButton name: string; ownerId: string; url: string; onChange: (url: string) => void; note?: string; error?: string | null />` — 72 px round photo; menu items **Upload photo**, **Remove** (only when `url`); `note` shown as muted text at the top of the menu; `error` (or the upload error) shown below the photo as `role="alert"`.

- [ ] **Step 1: Failing test** — `PhotoButton.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
vi.mock('../../services/media.service', () => ({ uploadImage: vi.fn() }));
import { uploadImage } from '../../services/media.service';
import { PhotoButton } from './PhotoButton';

afterEach(() => vi.clearAllMocks());

describe('PhotoButton', () => {
  it('shows the initial without a photo and the image with one', () => {
    const { rerender } = render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="" onChange={vi.fn()} />);
    expect(screen.getByText('N')).toBeTruthy();
    rerender(<PhotoButton name="Nitish Kumar" ownerId="p1" url="https://b/p.jpg" onChange={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Nitish Kumar' }).getAttribute('src')).toBe('https://b/p.jpg');
  });

  it('upload from the hidden input reports the URL', async () => {
    vi.mocked(uploadImage).mockResolvedValue({ url: 'https://b/new.jpg', pathname: 'p', content_type: 'image/jpeg', size: 1 });
    const onChange = vi.fn();
    render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Upload photo of Nitish Kumar'), { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://b/new.jpg'));
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), 'person-photo', 'p1');
  });

  it('menu: Remove clears; note is shown', async () => {
    const onChange = vi.fn();
    render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="https://b/p.jpg" onChange={onChange} note="Updates every contest" />);
    await userEvent.click(screen.getByRole('button', { name: 'Change photo of Nitish Kumar' }));
    expect(await screen.findByText('Updates every contest')).toBeTruthy();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows an external error', () => {
    render(<PhotoButton name="N" ownerId="p1" url="" onChange={vi.fn()} error="Photo not saved" />);
    expect(screen.getByRole('alert').textContent).toBe('Photo not saved');
  });
});
```

(If `@testing-library/user-event` is not installed, check `shell.test.tsx` for how the TopBar menu is opened in tests and use the same approach — Radix menus open on `pointerdown` + `keydown`, which `fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false })` triggers.)

Run → FAIL.

- [ ] **Step 2: Implement** — `PhotoButton.tsx`

```tsx
import { useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Camera, Loader2 } from 'lucide-react';
import { assetUrl } from '../../utils/asset-url';
import { useImageUpload } from '../../hooks/useImageUpload';

const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';
const ITEM = 'flex cursor-pointer select-none items-center rounded-control px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-subtle';

/** Record-header person photo: click for Upload photo / Remove. Upload happens on pick; the page saves the URL. */
export function PhotoButton({ name, ownerId, url, onChange, note, error }: {
  name: string; ownerId: string; url: string; onChange: (url: string) => void; note?: string; error?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const up = useImageUpload('person-photo', ownerId, onChange);
  const shownError = up.error ?? error ?? null;
  return (
    <div className="flex flex-col items-center gap-1">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={`Change photo of ${name}`} disabled={up.uploading}
            className="group relative flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full border border-line bg-subtle text-xl font-semibold text-ink-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
            <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
              {url ? <img src={assetUrl(url)} alt={name} className="h-full w-full object-cover" /> : name.charAt(0)}
            </span>
            <span aria-hidden className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-card text-ink-2 shadow-sm group-hover:text-accent">
              {up.uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content align="start" sideOffset={6} className="z-50 min-w-[200px] max-w-[260px] rounded-card border border-line bg-card p-1 shadow-lg">
            {note && <p className="px-2.5 py-1.5 text-xs text-muted">{note}</p>}
            <DropdownMenu.Item className={ITEM} onSelect={() => { up.clearError(); input.current?.click(); }}>
              {url ? 'Upload new photo' : 'Upload photo'}
            </DropdownMenu.Item>
            {url && <DropdownMenu.Item className={ITEM} onSelect={() => { up.clearError(); onChange(''); }}>Remove</DropdownMenu.Item>}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      <input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label={`Upload photo of ${name}`}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void up.upload(f); e.target.value = ''; }} />
      {shownError && <p role="alert" className="max-w-[160px] text-center text-[11px] text-bad-text">{shownError}</p>}
    </div>
  );
}
```

Note for the test "menu: Remove": with a photo the upload item reads "Upload new photo"; the Remove assertion is unaffected.

- [ ] **Step 3: Use in `PersonRecord.tsx`** — `leading`:

```tsx
leading={person && (
  <PhotoButton name={person.name} ownerId={id} url={form.photo_url} error={fieldErrors.photo_url}
    onChange={(photo_url) => set({ photo_url })} />
)}
```

Remove the `Photo URL` `<Field>` from the Profile card. Update `Persons.test.tsx` if it asserted that input.

- [ ] **Step 4: Run** `npx vitest run` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): person photo as clickable header image"`

---

### Task 6: Candidate record — header photo updates the person on Save

**Files:**
- Modify: `admin/src/hooks/useCandidateEdit.ts` (form gains `photo_url`; save splits candidate / person; `photoError`)
- Modify: `admin/src/components/entity/candidates/CandidateRecord.tsx:108-112` (leading → `PhotoButton`)
- Test: `admin/src/hooks/useCandidateEdit.test.tsx`

**Interfaces:**
- Consumes: `PhotoButton` (Task 5), `updatePerson(id, { photo_url })` from `services/person.api`.
- Produces: `useCandidateEdit` additionally returns `photoError: string | null`; `CandidateEditForm` gains `photo_url: string` (the person's photo, `''` when none). `CandidateForm` (create) is unchanged.

- [ ] **Step 1: Failing tests** in `useCandidateEdit.test.tsx` (extend the existing mocks: add `updatePerson: vi.fn(async () => ({}))` to the `../services/person.api` mock, and make the mocked `getCandidate` return `person_id: 'p1', person: { id: 'p1', name: 'Hari Narayan Singh', photo_url: 'https://b/old.jpg' }`):

```tsx
it('photo only: updates the person, not the candidate', async () => {
  const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
  await waitFor(() => expect(result.current.form.photo_url).toBe('https://b/old.jpg'));
  act(() => result.current.setForm({ ...result.current.form, photo_url: 'https://b/new.jpg' }));
  expect(result.current.dirty).toBe(true);
  await act(() => result.current.handleSave());
  expect(updateCandidate).not.toHaveBeenCalled();
  expect(updatePerson).toHaveBeenCalledWith('p1', { photo_url: 'https://b/new.jpg' });
});

it('removing the photo sends null', async () => {
  const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
  await waitFor(() => expect(result.current.form.photo_url).toBe('https://b/old.jpg'));
  act(() => result.current.setForm({ ...result.current.form, photo_url: '' }));
  await act(() => result.current.handleSave());
  expect(updatePerson).toHaveBeenCalledWith('p1', { photo_url: null });
});

it('fields only: never touches the person', async () => {
  const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
  await waitFor(() => expect(result.current.candidate).not.toBeNull());
  act(() => result.current.setForm({ ...result.current.form, age: '61' }));
  await act(() => result.current.handleSave());
  expect(updateCandidate).toHaveBeenCalled();
  expect(vi.mocked(updateCandidate).mock.calls[0][1]).not.toHaveProperty('photo_url');
  expect(updatePerson).not.toHaveBeenCalled();
});

it('candidate saved, photo failed: stays dirty for the photo only; next Save retries just the photo', async () => {
  vi.mocked(updatePerson).mockRejectedValueOnce(new ApiError('Network down', 500));
  const { result } = renderHook(() => useCandidateEdit('c1'), { wrapper });
  await waitFor(() => expect(result.current.candidate).not.toBeNull());
  act(() => result.current.setForm({ ...result.current.form, age: '61', photo_url: 'https://b/new.jpg' }));
  let ok: boolean | undefined;
  await act(async () => { ok = await result.current.handleSave(); });
  expect(ok).toBe(false);
  expect(result.current.photoError).toMatch(/Network down/);
  expect(result.current.dirty).toBe(true);
  expect(result.current.form.photo_url).toBe('https://b/new.jpg');
  vi.mocked(updateCandidate).mockClear();
  await act(() => result.current.handleSave());
  expect(updateCandidate).not.toHaveBeenCalled();
  expect(updatePerson).toHaveBeenLastCalledWith('p1', { photo_url: 'https://b/new.jpg' });
  expect(result.current.photoError).toBeNull();
});
```

(Import `updatePerson` from `../services/person.api`, `updateCandidate` from `../services/candidate.service`, `ApiError` from `../services/api-client`; match the existing file's mock shapes. Note that after the successful retry the hook reloads the candidate; make the second `getCandidate` resolve with `photo_url: 'https://b/new.jpg'` or assert before reload.)

Run → FAIL.

- [ ] **Step 2: Implement in `useCandidateEdit.ts`**

```ts
/** The record page's form: the create fields, the Incumbent toggle, and the person's photo (saved on the person). */
export interface CandidateEditForm extends CandidateForm {
  is_incumbent: boolean;
  photo_url: string;
}
const EMPTY_FORM: CandidateEditForm = { name: '', party_id: '', is_incumbent: false, photo_url: '', ...EMPTY_AFFIDAVIT };
```

In `toForm` add `photo_url: c.person?.photo_url || ''`. Replace the comment above the form state with: `// photo_url is the person's photo: shown and edited here, saved with PUT /admin/persons/:id.` Add `const [photoError, setPhotoError] = useState<string | null>(null);` and import `updatePerson` from `../services/person.api`.

`handleSave`:

```ts
  const handleSave = async () => {
    if (!id || !form.name.trim() || !candidateNumbersValid(form)) return false;
    const submitted = form;
    const base = saved;
    const { photo_url: _p, ...fields } = submitted;
    const { photo_url: _b, ...baseFields } = base;
    const fieldsChanged = JSON.stringify(fields) !== JSON.stringify(baseFields);
    const photoChanged = submitted.photo_url !== base.photo_url;
    setSaving(true);
    setFieldErrors({});
    setPhotoError(null);
    try {
      if (fieldsChanged) {
        try {
          // Only the keys the backend accepts (it refuses metadata, gender, education, person_id…).
          await updateCandidate(id, {
            name: submitted.name,
            party_id: submitted.party_id || INDEPENDENT,
            is_incumbent: submitted.is_incumbent,
            ...candidateAffidavit(submitted),
          });
        } catch (err) {
          setFieldErrors(fieldErrorMap(err));
          toastError(err, 'Failed to update profile');
          return false;
        }
      }
      if (photoChanged && candidate?.person_id) {
        try {
          await updatePerson(candidate.person_id, { photo_url: submitted.photo_url || null });
        } catch (err) {
          // The candidate fields (if any) are saved; only the photo stays unsaved, so Save retries just that.
          setSaved({ ...submitted, photo_url: base.photo_url });
          setPhotoError(err instanceof Error && err.message ? `Photo not saved: ${err.message}` : 'Photo not saved');
          toastError(err, 'Failed to save photo');
          return false;
        }
      }
      toast(photoChanged && !fieldsChanged ? 'Photo updated' : 'Candidate profile updated');
      // The submitted values are now the saved baseline; edits typed while saving stay dirty.
      setSaved(submitted);
      try {
        const c = await getCandidate(id);
        setCandidate(c);
        if (JSON.stringify(formRef.current) === JSON.stringify(submitted)) {
          const next = toForm(c);
          setForm(next);
          setSaved(next);
        }
      } catch { /* saved fine; the list refresh and next open will show server state */ }
      return true;
    } finally {
      setSaving(false);
    }
  };
```

`reset` also clears `photoError`: `const reset = () => { setForm(saved); setFieldErrors({}); setPhotoError(null); };`. Return `photoError`. Check the candidate create path (`CandidateForm`, create dialog) does not use `CandidateEditForm` / `EMPTY_FORM`; if it does, keep create untouched (no `photo_url` sent).

Check `updatePerson`'s `PersonUpdate` type accepts `photo_url: null` (`Person.photo_url` should be `string | null`); widen it if not.

- [ ] **Step 3: `CandidateRecord.tsx` leading**

```tsx
leading={c && (
  <PhotoButton
    name={c.person?.name ?? c.name}
    ownerId={c.person_id}
    url={form.photo_url}
    note={`Updates the photo on ${c.person?.name ?? c.name}'s record — every contest shows it.`}
    error={ed.photoError}
    onChange={(photo_url) => ed.setForm({ ...form, photo_url })}
  />
)}
```

(Use whatever local `set`/`setForm` helper the file already uses for other fields.) `CandidateMasterCard` stays read-only (it shows `person.photo_url` via `assetUrl` since Task 2).

- [ ] **Step 4: Run** `npx vitest run` → PASS; `npm run build` → OK.
- [ ] **Step 5: Commit** — `git commit -m "feat(admin): candidate header photo saves to the person"`

---

### Task 7: Docs, env, browser verification

**Files:**
- Modify: `docs/FEATURES.md` (admin image upload entry: kinds, limits, upload-on-pick/save-on-Save, photo on person only, ECI ingestion rule D7)
- Modify: `CLAUDE.md` (Tech Stack → Backend: "admin image uploads → Vercel Blob (`POST /admin/media`, `BLOB_READ_WRITE_TOKEN`; unset = 503)"; Admin: "images via `components/ui/ImageUpload` / `components/record/PhotoButton`; render image URLs through `utils/asset-url.ts`")
- Modify: `docs/DEPLOYMENT.md` (Blob store; Render env `BLOB_READ_WRITE_TOKEN`; admin build env `VITE_PUBLIC_SITE_URL=https://www.matdaanpulse.in`)
- Modify: `docs/superpowers/specs/2026-10-02-admin-image-upload-design.md` (Audit line → "no upload audit row; the field change is audited on Save" — see Global Constraints deviation)

- [ ] **Step 1: Write the docs above.**
- [ ] **Step 2: Full test + build** — `cd backend && npx jest && npm run build`; `cd admin && npx vitest run && npm run build`. All pass.
- [ ] **Step 3: Browser check** (backend 3082, admin 3081, frontend 3080 running; log in as admin):
  - `/parties/BJP`: two tiles with the seeded SVGs visible (via `assetUrl`), no URL inputs; Replace with a PNG → without a token, the tile shows "Image upload is not configured" and the old image stays; Remove → page shows Unsaved changes, Cancel restores.
  - `/persons/<id>`: 72 px photo/initial with camera badge; menu works; no Photo URL field.
  - A candidate page: header photo menu shows the "every contest" note.
  - If the user provides a `BLOB_READ_WRITE_TOKEN` for local `.env`, do one real upload end to end and confirm the saved URL renders on the public site's candidate table.
  - Take screenshots for the user.
- [ ] **Step 4: Commit** — `git commit -m "docs: admin image upload"`
