# Bihar Persons & Leaders (Phase 1, Plan 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bihar 2010–2025 gets the same politician linked across elections, about 30–50 key leaders with credited photos
in our own storage, facts and a short bio, leaders and cabinet in every Bihar manifest linked by `person_id`, and
affidavit data for the winners.

**Architecture:**
- An `image_credits` table, exposed through the public person profile and a `/credits` list on the About page.
- An optional `person_id` on manifest watchlist entries. The admin picker stores it, and the frontend links seatless
  leaders to their person page.
- The data work (cross-election linking, leaders, affidavits) follows Plan 1's pattern: scripts in `scraper/src/bihar/`,
  committed JSON in `scraper/data/bihar/`, and generated run-once seeds that never undo admin work.

**Tech Stack:** NestJS + Prisma (backend), React MVVM + Tailwind (frontend), React + Radix (admin), TypeScript scripts with
vitest (scraper), `@vercel/blob`, Wikidata / Wikimedia Commons APIs, MyNeta (ADR) pages, PostgreSQL via psql.

**Spec:** `docs/superpowers/specs/2026-10-03-bihar-seeding-design.md`: §6 (image credits) and §7 (persons and leaders).
Plan 1 (`docs/superpowers/plans/2026-10-03-bihar-results-seeding.md`) is merged; reuse its modules (`names.ts`, `existing-seed.ts`,
`match.ts` `stableUuid`, `seed-run-once.ts` `runOnce`, `load.ts` `DATA_DIR`).

## Global Constraints

- Effort follows public profile: only Tier A leaders get a photo, bio and Wikipedia link. Everyone else gets nothing extra.
  No LLM reads a page per candidate. Claude's judgement is used once, to curate `leaders.json` (with a source per election).
- Photos live in **our Vercel Blob store** (`BLOB_READ_WRITE_TOKEN`, the same store as `POST /admin/media`) and are never
  hotlinked. Each is downloaded once. Free licences only: Wikidata P18 points to Commons, which hosts only free files. Record the
  source page, author and licence in `image_credits`.
- Bios are ours: generated from the curated roles (e.g. "Chief Minister of Bihar in the 2010, 2015, 2020 and 2025
  governments."). No Wikipedia text is copied.
- Every data seed is **run-once** (`runOnce`, `seed_runs`) and **fill-only** for person fields (`COALESCE(col, value)`), so
  admin edits always win. Never re-point a candidate whose person is curated (more than one candidacy) or appears in
  `person_merges`. `image_credits` inserts are idempotent (`ON CONFLICT (url) DO NOTHING`) and run every time.
- Auto-created person ids differ between databases. Seeds address a person through a candidate id:
  `(SELECT person_id FROM candidates WHERE id = '<candidate uuid>')`. Only leaders without any Bihar VS candidacy get a fixed id:
  `stableUuid('bihar-leader', <key>)`.
- The published manifest is `elections.manifest_url` (JSON text). The leaders seed rewrites only its `watchlists` key, once.
- New migration: `database/migrations/022_image_credits.sql`, idempotent. Keep `backend/prisma/schema.prisma` in sync and
  never `prisma db push`.
- Never write `candidates.metadata` / `persons.metadata`.
- Admin Tailwind scans `src/components`, `src/pages`, `src/context`, `src/App.tsx`. Frontend Tailwind scans `src/views`. The
  frontend MVVM import direction is enforced by `npm run lint`.
- Fetching: browser User-Agent for MyNeta, 2 s between requests, raw files cached under `scraper/data/raw/` (gitignored).
  Wikimedia APIs use the UA `MatdaanPulse/1.0 (mannu.ray@gmail.com)` (their policy asks for a contact).
- Commands: backend `cd backend && npx jest <path>`; frontend `cd frontend && npx vitest run <path> && npm run lint && npx tsc --noEmit -p .`;
  admin `cd admin && npx vitest run <path> && npx tsc --noEmit -p .`; scraper `cd scraper && npx vitest run <path> && npm run typecheck`.
- Local DB: `postgresql://admin:password123@localhost:3083/election_tracker`. Bihar election ids are in `scraper/src/bihar/years.ts`.

## Review Focus

1. **A leader's candidacies already belong to a curated person (seed_bihar_persons) or to a merge.** Expected: the linking
   seeds anchor on the curated person and never re-point a candidate away from a curated or merged person. Pinned in Task 5
   (SQL test) and Task 8 (emit test).
2. **The same common name in the same seat across years belongs to different people** ("Anil Kumar", IND). Expected: such
   groups are excluded (`review`) unless the party is the same in every year. Pinned in Task 5.
3. **Admin edits a manifest whose entry has a `person_id`, then types a different name.** Expected: the stale `person_id`
   is cleared, so an entry never links the wrong person. Pinned in Task 4.
4. **A Wikidata item has no image, or the Commons licence field is empty.** Expected: the profile is kept without a photo,
   and no image is ever stored without a credit. Pinned in Task 7.
5. **A MyNeta winner row whose seat or name does not match our winner** (ADR spelling, missing seats). Expected: no row is
   written for it, and it is reported. Affidavits never land on the wrong candidate. Pinned in Task 9.

---

## File Structure

| File | Responsibility |
|---|---|
| `database/migrations/022_image_credits.sql` | `image_credits` table |
| `backend/prisma/schema.prisma` | `image_credits` model |
| `backend/src/modules/credits/{credits.module,credits.controller,credits.service}.ts` (+ spec) | `GET /credits` (public, CDN-cacheable) |
| `backend/src/modules/candidates/persons.service.ts`, `dto/candidate-response.dto.ts` | `photo_credit` on the public person profile |
| `frontend/src/model/types/index.ts`, `model/api/credits.service.ts`, `viewmodels/about/useCreditsVM.ts`, `views/about/AboutView.tsx`, `views/person/PersonPageView.tsx`, `viewmodels/pages/usePersonPageVM.ts`, `i18n/locales/*.json` | Credits UI |
| `frontend/src/model/derive/leaders.ts`, `views/dashboard/LeadersStrip.tsx`, `viewmodels/tiles/useLeadersVM.ts` | `person_id` on leader entries/cards |
| `admin/src/types/index.ts`, `admin/src/components/manifest/WatchlistEditor.tsx`, `admin/src/components/entity/manifests/ManifestPanel.tsx`, `admin/src/services/person.api.ts` | Picker stores `person_id` |
| `scraper/src/bihar/links.ts`, `links-cli.ts` | Cross-election grouping → `seed_bihar_person_links_v2.sql` |
| `scraper/data/bihar/leaders.json` | Curated leaders (Claude, with sources; user-reviewed) |
| `scraper/src/bihar/profiles.ts`, `profiles-cli.ts` | Wikidata/Commons → Blob → `leader-profiles.json` |
| `scraper/src/bihar/leaders-seed.ts`, `leaders-cli.ts` | → `seed_bihar_leaders.sql` |
| `scraper/src/bihar/affidavits.ts`, `affidavits-cli.ts` | MyNeta winners → `affidavits-<year>.json` → `seed_bihar_affidavits.sql` |
| `database/setup.sh` | Order: … person regions → links v2 → leaders → affidavits |

---

### Task 1: `image_credits` table, `GET /credits`, `photo_credit` on the person profile

**Files:**
- Create: `database/migrations/022_image_credits.sql`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/modules/credits/credits.module.ts`, `credits.controller.ts`, `credits.service.ts`, `credits.service.spec.ts`
- Modify: `backend/src/app.module.ts` (import `CreditsModule`)
- Modify: `backend/src/modules/candidates/persons.service.ts` (`findWithCandidates`), `backend/src/modules/candidates/dto/candidate-response.dto.ts` (`PersonProfileDto`)
- Test: `backend/src/modules/candidates/persons.service.spec.ts`

**Interfaces:**
- Produces: table `image_credits(url text PK, source_url text NOT NULL, author text NULL, licence text NOT NULL, created_at timestamptz)`.
  `GET /api/v1/credits` → `{ url: string; source_url: string; author: string | null; licence: string; used_by: string | null }[]`
  (sorted by `used_by`, then `url`). Person profile gains `photo_credit: { source_url: string; author: string | null; licence: string } | null`.

- [ ] **Step 1: Migration**

```sql
-- 022: credits for images we host (person photos, party images): source page, author, licence (spec §6).
CREATE TABLE IF NOT EXISTS image_credits (
    url         text PRIMARY KEY,
    source_url  text NOT NULL,
    author      text,
    licence     text NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
);
```

Add to `schema.prisma`:

```prisma
model image_credits {
  url        String   @id
  source_url String
  author     String?
  licence    String
  created_at DateTime @default(now()) @db.Timestamptz(6)
}
```

Run: `DATABASE_URL=postgresql://admin:password123@localhost:3083/election_tracker database/setup.sh --schema-only` (applies 022), then
`cd backend && npx prisma generate`, then
`DIRECT_URL=$DATABASE_URL npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`.
Expected: the diff shows only the known expected drift (`candidates.person_id SET NOT NULL`; metadata drops), nothing about `image_credits`.

- [ ] **Step 2: Failing tests**

Append to `persons.service.spec.ts` inside `describe('PersonsService.findWithCandidates (public profile)')`, and extend `make2()`'s prisma mock with
`image_credits: { findUnique: jest.fn().mockResolvedValue(null) }`:

```ts
  it('adds the photo credit when the photo has one, and null otherwise', async () => {
    const { svc, prisma } = make2();
    expect((await svc.findWithCandidates('p1') as any).photo_credit).toBeNull();
    prisma.persons.findUnique.mockResolvedValue({ ...full, photo_url: 'https://blob.example/persons/Q1/photo.jpg' });
    prisma.image_credits.findUnique.mockResolvedValue({ url: 'https://blob.example/persons/Q1/photo.jpg', source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', author: 'A. Photographer', licence: 'CC BY-SA 4.0', created_at: new Date() });
    const json = JSON.parse(JSON.stringify(plainToInstance(PersonProfileDto, await svc.findWithCandidates('p1'), { excludeExtraneousValues: true })));
    expect(json.photo_credit).toEqual({ source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', author: 'A. Photographer', licence: 'CC BY-SA 4.0' });
  });
```

Create `backend/src/modules/credits/credits.service.spec.ts`:

```ts
import { CreditsService } from './credits.service';

describe('CreditsService.list', () => {
  it('lists credits with the person or party that uses each image', async () => {
    const prisma: any = {
      image_credits: { findMany: jest.fn().mockResolvedValue([
        { url: 'u2', source_url: 's2', author: null, licence: 'Public domain' },
        { url: 'u1', source_url: 's1', author: 'A', licence: 'CC BY 4.0' },
        { url: 'u3', source_url: 's3', author: 'B', licence: 'CC0' },
      ]) },
      persons: { findMany: jest.fn().mockResolvedValue([{ photo_url: 'u1', name: 'Tejashwi Prasad Yadav' }]) },
      parties: { findMany: jest.fn().mockResolvedValue([{ symbol_url: 'u2', eci_symbol_url: null, name: 'Rashtriya Janata Dal' }]) },
    };
    expect(await new CreditsService(prisma).list()).toEqual([
      { url: 'u3', source_url: 's3', author: 'B', licence: 'CC0', used_by: null },
      { url: 'u2', source_url: 's2', author: null, licence: 'Public domain', used_by: 'Rashtriya Janata Dal' },
      { url: 'u1', source_url: 's1', author: 'A', licence: 'CC BY 4.0', used_by: 'Tejashwi Prasad Yadav' },
    ]);
  });
});
```

(Sort rule: entries without `used_by` first, then by `used_by`, then by `url`. Plain `localeCompare` on `used_by ?? ''`.)

Run: `cd backend && npx jest src/modules/credits src/modules/candidates/persons.service.spec.ts`
Expected: FAIL (module missing; `photo_credit` undefined).

- [ ] **Step 3: Implement**

`credits.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreditRow { url: string; source_url: string; author: string | null; licence: string; used_by: string | null }

@Injectable()
export class CreditsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every hosted image's credit, with the person or party that shows it (About page). */
  async list(): Promise<CreditRow[]> {
    const credits = await this.prisma.image_credits.findMany({ select: { url: true, source_url: true, author: true, licence: true } });
    const urls = credits.map(c => c.url);
    const [persons, parties] = await Promise.all([
      this.prisma.persons.findMany({ where: { photo_url: { in: urls } }, select: { photo_url: true, name: true } }),
      this.prisma.parties.findMany({ where: { OR: [{ symbol_url: { in: urls } }, { eci_symbol_url: { in: urls } }] }, select: { symbol_url: true, eci_symbol_url: true, name: true } }),
    ]);
    const owner = new Map<string, string>();
    for (const p of parties) { if (p.symbol_url) owner.set(p.symbol_url, p.name); if (p.eci_symbol_url) owner.set(p.eci_symbol_url, p.name); }
    for (const p of persons) if (p.photo_url) owner.set(p.photo_url, p.name);
    return credits
      .map(c => ({ ...c, used_by: owner.get(c.url) ?? null }))
      .sort((a, b) => (a.used_by ?? '').localeCompare(b.used_by ?? '') || a.url.localeCompare(b.url));
  }
}
```

`credits.controller.ts` (public, same cache policy as the candidates controller):

```ts
import { Controller, Get } from '@nestjs/common';
import { CACHE_CONTROL, CacheControl } from '../../common/http/cache-control';
import { CreditsService } from './credits.service';

@Controller('credits')
@CacheControl(CACHE_CONTROL.PUBLIC)
export class CreditsController {
  constructor(private readonly credits: CreditsService) {}

  @Get()
  list() { return this.credits.list(); }
}
```

`credits.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CreditsController } from './credits.controller';
import { CreditsService } from './credits.service';

@Module({ controllers: [CreditsController], providers: [CreditsService] })
export class CreditsModule {}
```

Check how `CandidatesModule` gets `PrismaService` (global `PrismaModule` or explicit import) and do the same. Add `CreditsModule`
to `app.module.ts` `imports`.

In `persons.service.ts` `findWithCandidates`, before the final `return`:

```ts
    const credit = person.photo_url ? await this.prisma.image_credits.findUnique({ where: { url: person.photo_url } }) : null;
```

and add `photo_credit: credit ? { source_url: credit.source_url, author: credit.author, licence: credit.licence } : null,` to the
returned object. In `PersonProfileDto` add `@Expose() photo_credit: { source_url: string; author: string | null; licence: string } | null;`.

- [ ] **Step 4: Run**

Run: `cd backend && npx jest src/modules/credits src/modules/candidates && npx tsc --noEmit -p .`
Expected: PASS. Then `curl -s localhost:3082/api/v1/credits` (backend restarted) → `[]`.

- [ ] **Step 5: Commit**

```bash
git add database/migrations/022_image_credits.sql backend/prisma/schema.prisma backend/src/modules/credits backend/src/app.module.ts backend/src/modules/candidates
git commit -m "feat(credits): image_credits table, GET /credits, photo credit on the person profile"
```

---

### Task 2: Credits on the person page and the About page

**Files:**
- Modify: `frontend/src/model/types/index.ts` (`PersonDetail` gets `photo_credit`; new `ImageCredit`)
- Create: `frontend/src/model/api/credits.service.ts`, `frontend/src/viewmodels/about/useCreditsVM.ts`
- Modify: `frontend/src/viewmodels/pages/usePersonPageVM.ts`, `frontend/src/views/person/PersonPageView.tsx`, `frontend/src/views/about/AboutView.tsx`
- Modify: `frontend/src/i18n/locales/{en,hi,mr,ta}.json`
- Test: `frontend/src/viewmodels/__tests__/credits.test.tsx` (new), the existing person-page VM/view tests (extend)

**Interfaces:**
- Consumes: Task 1 responses.
- Produces: `interface ImageCredit { url: string; source_url: string; author: string | null; licence: string; used_by: string | null }`;
  `getCredits(): Promise<ImageCredit[]>`; `useCreditsVM(): { credits: ImageCredit[]; loading: boolean }`; person VM field
  `photoCredit: { source_url: string; author: string | null; licence: string } | null`.

- [ ] **Step 1: Failing tests**

Locate the person page VM test (`grep -rln usePersonPageVM frontend/src --include=*.test.tsx`) and add a case: a mocked `getPerson`
response with `photo_credit: { source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', author: 'A', licence: 'CC BY-SA 4.0' }` → the VM exposes
`photoCredit` equal to it, and `null` when absent. Add a view test to the person view tests: with `photoCredit` set, the page shows a
link named `Photo: A, CC BY-SA 4.0` pointing at the source URL.

Create `frontend/src/viewmodels/__tests__/credits.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import * as api from '../../model/api/credits.service';
import { useCreditsVM } from '../about/useCreditsVM';

describe('useCreditsVM', () => {
  it('loads the credits list', async () => {
    vi.spyOn(api, 'getCredits').mockResolvedValue([{ url: 'u', source_url: 's', author: 'A', licence: 'CC BY 4.0', used_by: 'X' }]);
    const { result } = renderHook(() => useCreditsVM());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.credits).toHaveLength(1);
  });
  it('shows an empty list when the request fails', async () => {
    vi.spyOn(api, 'getCredits').mockRejectedValue(new Error('down'));
    const { result } = renderHook(() => useCreditsVM());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.credits).toEqual([]);
  });
});
```

Run: `cd frontend && npx vitest run src/viewmodels/__tests__/credits.test.tsx` plus the person tests → FAIL.

- [ ] **Step 2: Implement**

`credits.service.ts`: follow `model/api/person.service.ts` (same fetch helper):
`export async function getCredits(): Promise<ImageCredit[]> { return (await <helper>('/credits')) ?? []; }`.

`useCreditsVM.ts`:

```ts
import { useEffect, useState } from 'react';
import { getCredits } from '../../model/api/credits.service';
import type { ImageCredit } from '../../model/types';

export function useCreditsVM(): { credits: ImageCredit[]; loading: boolean } {
  const [credits, setCredits] = useState<ImageCredit[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    getCredits().then(c => { if (live) setCredits(c); }).catch(() => { if (live) setCredits([]); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);
  return { credits, loading };
}
```

Person VM: `photoCredit: p?.photo_credit ?? null`. Person view: directly under the `<Avatar … size="fill">` (around
`PersonPageView.tsx:218`) render, when `vm.photoCredit`:

```tsx
<a href={vm.photoCredit.source_url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[11px] text-muted hover:text-accent">
  {t('person_photo_credit', { author: vm.photoCredit.author ?? t('person_photo_credit_unknown'), licence: vm.photoCredit.licence })}
</a>
```

About view: a new `<section aria-labelledby="about-credits">` after the data section (around `AboutView.tsx:232`) using
`useCreditsVM()` (the view takes VMs the way the page already wires `useFeedbackForm`; follow that wiring). Heading
`t('about_credits_title')`, a paragraph `t('about_credits_intro')` (ECI for results and symbols, ADR / MyNeta for affidavits,
Wikimedia Commons for photos), then, when `credits.length`, a list: `used_by ?? url`, author, licence, a link to `source_url`.
Hide the list (keep the intro) when empty.

i18n keys, all four locales (translate hi/mr/ta; keep `{{author}}`/`{{licence}}` placeholders):
- `person_photo_credit`: "Photo: {{author}}, {{licence}}"
- `person_photo_credit_unknown`: "unknown author"
- `about_credits_title`: "Credits"
- `about_credits_intro`: "Results and party symbols: Election Commission of India. Candidate affidavits: ADR / MyNeta. Photos: Wikimedia Commons contributors, credited below."

- [ ] **Step 3: Run**

Run: `cd frontend && npx vitest run src/viewmodels src/views && npm run lint && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): photo credit on the person page and a credits list on About"
```

---

### Task 3: `person_id` on manifest entries (frontend)

**Files:**
- Modify: `frontend/src/model/types/index.ts` (`ManifestLeader`, `ManifestCabinet`, `WatchlistEntry` gain `person_id?: string`)
- Modify: `frontend/src/model/derive/leaders.ts`, `frontend/src/views/dashboard/LeadersStrip.tsx`
- Test: `frontend/src/model/derive/__tests__/leaders.test.ts`, `frontend/src/views/__tests__/watchlist.test.tsx` (or the leaders strip test that exists)

**Interfaces:**
- Produces: `LeaderEntry.personId?: string`; `LeaderCard.personId: string | null`. `resolveLeaderSeats` leaves entries with a
  `personId` alone: their seat comes from the picker, and an empty seat means the leader didn't contest. Name matching stays only
  for entries without `personId`.

- [ ] **Step 1: Failing tests** (append to `leaders.test.ts`; adapt the fixture helpers already in that file)

```ts
  it('carries person_id from watchlist entries to the cards', () => {
    const manifest = { watchlists: [{ id: 'leaders', name: 'Leaders', entries: [{ name: 'Nitish Kumar', party_id: 'JDU', const_id: '', role: 'Chief Minister', person_id: 'p-nk' }] }] } as any;
    const [e] = collectLeaderEntries(manifest, []);
    expect(e.personId).toBe('p-nk');
    expect(deriveLeaderCards([e], new Map())[0].personId).toBe('p-nk');
  });
  it('never name-matches an entry that has a person_id', () => {
    const e = { name: 'Rajesh Singh', partyId: 'JDU', constId: '', personId: 'p1', custom: false };
    const results = [{ const_id: 'BR_VS10_1_X', party_id: 'JDU', candidate_name: 'Rajesh Singh', votes: 1, status: 'WON', margin: 1 }];
    expect(resolveLeaderSeats([e], results)[0].constId).toBe('');
  });
  it('custom watch cards have no person', () => {
    expect(deriveLeaderCards(collectLeaderEntries(null, [{ const_id: 'X', label: 'X' }]), new Map())[0].personId).toBeNull();
  });
```

In the leaders strip view test, render a card with `constId: ''` and `personId: 'p-nk'` and expect a link to `/person/p-nk` with
the leader's name. A card with a seat keeps its seat button.

Run: `cd frontend && npx vitest run src/model/derive/__tests__/leaders.test.ts src/views/__tests__` → FAIL.

- [ ] **Step 2: Implement**

- Types: add `person_id?: string;` to the three manifest entry interfaces.
- `leaders.ts`: `LeaderEntry` gets `personId?: string`. `collectLeaderEntries` maps `personId: x.person_id` for watchlists, leaders
  and cabinet (custom: none). `resolveLeaderSeats`: `if (e.constId || !e.partyId || e.personId) return e;`.
  `LeaderCard` gets `personId: string | null` (`e.personId ?? null`). Include `personId` in the dedupe key:
  `${e.constId}|${e.personId ?? e.name.toLowerCase()}`.
- `LeadersStrip.tsx`: when `!c.constId && c.personId`, render the card's main action as `<Link to={`/person/${c.personId}`}>`
  (react-router, the same `Link` the views already use; check with `grep -rn "from 'react-router" frontend/src/views | head -1`)
  in place of the seat button, with the same classes. Everything else unchanged.

- [ ] **Step 3: Run**

Run: `cd frontend && npx vitest run && npm run lint && npx tsc --noEmit -p .`
Expected: PASS (whole frontend suite: the leaders model feeds the party dialog too).

- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(frontend): manifest leaders carry person_id; seatless leaders link to their person page"
```

---

### Task 4: Admin picker stores `person_id`

**Files:**
- Modify: `admin/src/types/index.ts` (`ManifestLeader`, `ManifestCabinet`, `WatchlistEntry` gain `person_id?: string`)
- Modify: `admin/src/components/manifest/WatchlistEditor.tsx`, `admin/src/components/entity/manifests/ManifestPanel.tsx`
- Modify: `admin/src/services/person.api.ts` (add `searchPersons`)
- Test: `admin/src/components/manifest/manifest.test.tsx`

**Interfaces:**
- Produces: `searchPersons(q: string): Promise<{ id: string; name: string }[]>` → `GET /admin/persons/search?q=`.
  `WatchlistRow`/`WatchlistEditor` get an optional `onSearchPersons?: (q: string) => Promise<{ id: string; name: string }[]>`.
  Picking a candidate sets `{ name, party_id, const_id, person_id }`. Picking a person sets `{ name, person_id, const_id: '' }`.
  Typing clears `person_id`.

- [ ] **Step 1: Failing tests** (in `describe('WatchlistEditor')`, reuse its `WL`, `PARTIES`, `SEATS`, `partyMap` fixtures)

```tsx
  it('stores the picked candidate\'s person_id, and clears it when the name is retyped', async () => {
    const onUpdate = vi.fn();
    const cand = { id: 'c1', name: 'Tejashwi Prasad Yadav', party_id: 'RJD', const_id: 'BR_VS_179_RAGHOPUR', person_id: 'p-ty' } as unknown as Candidate;
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn().mockResolvedValue([cand])} onUpdate={onUpdate} />);
    const box = screen.getAllByRole('combobox')[0];
    await act(async () => { fireEvent.change(box, { target: { value: 'Tej' } }); });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Tejashwi Prasad Yadav/ }));
    expect(onUpdate.mock.calls.at(-1)![0][0].entries[0]).toMatchObject({ name: 'Tejashwi Prasad Yadav', party_id: 'RJD', const_id: 'BR_VS_179_RAGHOPUR', person_id: 'p-ty' });
    await act(async () => { fireEvent.change(box, { target: { value: 'Someone else' } }); });
    expect(onUpdate.mock.calls.at(-1)![0][0].entries[0].person_id).toBeUndefined();
  });
  it('offers persons for leaders without a seat and stores person_id with an empty seat', async () => {
    const onUpdate = vi.fn();
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn().mockResolvedValue([])}
      onSearchPersons={vi.fn().mockResolvedValue([{ id: 'p-nk', name: 'Nitish Kumar' }])} onUpdate={onUpdate} />);
    await act(async () => { fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Nitish' } }); });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Nitish Kumar/ }));
    expect(onUpdate.mock.calls.at(-1)![0][0].entries[0]).toMatchObject({ name: 'Nitish Kumar', person_id: 'p-nk', const_id: '' });
  });
```

(Check how the existing WatchlistEditor tests read `onUpdate` calls, i.e. whether the editor passes the whole watchlists array, and keep
these assertions consistent with that shape.)

Run: `cd admin && npx vitest run src/components/manifest/manifest.test.tsx` → FAIL.

- [ ] **Step 2: Implement**

- Types: `person_id?: string;` on the three entry types.
- `person.api.ts`: `export async function searchPersons(q: string) { return (await apiFetch<{ id: string; name: string }[]>(`/admin/persons/search?q=${encodeURIComponent(q)}`)) || []; }`
  (use the file's existing fetch helper).
- `WatchlistRow`: accept `onSearchPersons?`. In `handleSearch`: `onUpdate({ name: query, person_id: undefined });`. Then fetch both
  lists in parallel (`Promise.all([onSearchCandidates(query), onSearchPersons ? onSearchPersons(query) : Promise.resolve([])])`), keep the
  same stale-request guard, and store `persons` in state. Drop persons already present as a candidate result (`person_id` match), and keep at
  most 8. `handleSelect(c)` adds `person_id: c.person_id`. New `handleSelectPerson(p)` → `onUpdate({ name: p.name, person_id: p.id, const_id: '' })`.
  The listbox renders candidate options, then, when persons exist, a separator label "People (no seat in this election)" (`role="presentation"`)
  and person options (`role="option"`, `aria-selected={false}`, same classes, sub-line "Person"). `open` is true when either list is non-empty.
- `WatchlistEditor`: thread `onSearchPersons` to rows.
- `ManifestPanel.tsx:183`: `onSearchCandidates={q => searchCandidates(q, electionId)} onSearchPersons={searchPersons}`.

- [ ] **Step 3: Run**

Run: `cd admin && npx vitest run && npx tsc --noEmit -p .`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add admin/src
git commit -m "feat(admin): manifest watchlist picker stores person_id (candidates of the election, or a person without a seat)"
```

---

### Task 5: Cross-election person linking v2

**Files:**
- Create: `scraper/src/bihar/links.ts`, `scraper/src/bihar/links-cli.ts`
- Generate: `database/seed_bihar_person_links_v2.sql`, `scraper/data/bihar/links-review.json`
- Modify: `database/setup.sh` (after `seed_bihar_person_regions.sql`)
- Test: `scraper/src/bihar/__tests__/links.test.ts`

**Interfaces:**
- Consumes: `ElectionJson` (`vs-<year>.json`), `readExistingSeed` (candidate ids per year), `runOnce`, `normName`.
- Produces:
  - `interface Candidacy { candidateId: string; year: number; constNo: number; name: string; partyId: string }`
  - `interface LinkGroup { key: string; confidence: 'high' | 'medium' | 'review'; members: Candidacy[] }`
  - `linkKey(name: string): string` (upper case, alias part dropped, letters only)
  - `groupCandidacies(all: Candidacy[]): LinkGroup[]` (only groups with members in ≥ 2 different years)
  - `emitLinksSeed(groups: LinkGroup[]): string` (only `high` and `medium`)
  - `COMMON_NAMES` (same set as `scraper/src/analyse-candidates.ts`)

Rules (Review Focus 2):
- Group key = `linkKey(name)` + `constNo`. All four elections use the 2008 delimitation, so seat numbers are stable.
- `review` when: two members share a year (two different people), or the name is in `COMMON_NAMES` and the party is not the same for
  every member, or any member is `IND` with a common name.
- `high` when the party is the same for every member, otherwise `medium`.
- NOTA rows are never candidacies.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { groupCandidacies, linkKey, emitLinksSeed, type Candidacy } from '../links';

const c = (candidateId: string, year: number, constNo: number, name: string, partyId: string): Candidacy => ({ candidateId, year, constNo, name, partyId });

describe('linkKey', () => {
  it('drops alias parts, punctuation and case', () => {
    expect(linkKey('Dhirendra Pratap Singh alias Rinku singh')).toBe(linkKey('DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH'));
    expect(linkKey('Md. Kamran')).toBe('MD KAMRAN');
  });
});

describe('groupCandidacies', () => {
  it('links the same name in the same seat across years; party switch is medium', () => {
    const g = groupCandidacies([c('a', 2015, 9, 'Dhirendra Pratap Singh', 'IND'), c('b', 2020, 9, 'Dhirendra Pratap Singh', 'JDU'), c('x', 2020, 10, 'Dhirendra Pratap Singh', 'JDU')]);
    expect(g).toEqual([{ key: 'DHIRENDRA PRATAP SINGH|9', confidence: 'medium', members: [expect.objectContaining({ candidateId: 'a' }), expect.objectContaining({ candidateId: 'b' })] }]);
  });
  it('same party every year is high', () => {
    expect(groupCandidacies([c('a', 2010, 1, 'Rajesh Singh', 'JDU'), c('b', 2015, 1, 'RAJESH SINGH', 'JDU')])[0].confidence).toBe('high');
  });
  it('marks common names with different parties or IND, and same-year duplicates, for review', () => {
    expect(groupCandidacies([c('a', 2010, 5, 'Anil Kumar', 'IND'), c('b', 2020, 5, 'Anil Kumar', 'IND')])[0].confidence).toBe('review');
    expect(groupCandidacies([c('a', 2010, 5, 'Anil Kumar', 'BSP'), c('b', 2020, 5, 'Anil Kumar', 'RJD')])[0].confidence).toBe('review');
    expect(groupCandidacies([c('a', 2010, 5, 'Anil Kumar', 'BJP'), c('b', 2020, 5, 'Anil Kumar', 'BJP')])[0].confidence).toBe('high');
    expect(groupCandidacies([c('a', 2020, 7, 'Ram Prasad', 'IND'), c('b', 2020, 7, 'Ram Prasad', 'BSP'), c('d', 2025, 7, 'Ram Prasad', 'BSP')])[0].confidence).toBe('review');
  });
  it('drops single-year groups', () => {
    expect(groupCandidacies([c('a', 2010, 1, 'X Y', 'BJP')])).toEqual([]);
  });
});

describe('emitLinksSeed', () => {
  it('is run-once, links high/medium groups only, anchors on the most-linked person and never moves curated or merged persons', () => {
    const sql = emitLinksSeed([
      { key: 'A|1', confidence: 'high', members: [c('11111111-1111-1111-1111-111111111111', 2010, 1, 'A', 'BJP'), c('22222222-2222-2222-2222-222222222222', 2015, 1, 'A', 'BJP')] },
      { key: 'B|2', confidence: 'review', members: [c('33333333-3333-3333-3333-333333333333', 2010, 2, 'B', 'IND'), c('44444444-4444-4444-4444-444444444444', 2015, 2, 'B', 'IND')] },
    ]);
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_person_links_v2')");
    expect(sql).toContain("(1, '11111111-1111-1111-1111-111111111111'), (1, '22222222-2222-2222-2222-222222222222')");
    expect(sql).not.toContain('33333333-3333-3333-3333-333333333333');
    expect(sql).toContain('ORDER BY g, n DESC, cid');
    expect(sql).toContain('AND m.n = 1');
    expect(sql).toContain("pm.duplicate->>'id' = m.pid::text OR pm.keeper_ref = m.pid");
  });
});
```

Run: `cd scraper && npx vitest run src/bihar/__tests__/links.test.ts` → FAIL.

- [ ] **Step 2: Implement `links.ts`**

```ts
import type { RunOnceSeed } from '../seed-run-once';
import { runOnce } from '../seed-run-once';
import { normName } from './names';
import { q } from './sql';

export interface Candidacy { candidateId: string; year: number; constNo: number; name: string; partyId: string }
export interface LinkGroup { key: string; confidence: 'high' | 'medium' | 'review'; members: Candidacy[] }

export const COMMON_NAMES = new Set([
  'ANIL KUMAR', 'SUNIL KUMAR', 'RAJESH KUMAR', 'RAMESH KUMAR', 'MANOJ KUMAR', 'VIJAY KUMAR', 'SANJAY KUMAR', 'AJAY KUMAR',
  'RAJU KUMAR', 'MUKESH KUMAR', 'RAKESH KUMAR', 'SANTOSH KUMAR', 'ASHOK KUMAR', 'DINESH KUMAR', 'PANKAJ KUMAR', 'AMIT KUMAR',
  'RAVI KUMAR', 'MOHD ANWAR', 'RAM KUMAR', 'SHIV KUMAR',
]);

export const linkKey = (name: string) => normName(name.replace(/\s+(alias|urf|@)\s+.*$/i, '')).replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();

export function groupCandidacies(all: Candidacy[]): LinkGroup[] {
  const groups = new Map<string, Candidacy[]>();
  for (const x of all) {
    if (x.partyId === 'NOTA') continue;
    const key = `${linkKey(x.name)}|${x.constNo}`;
    groups.set(key, [...(groups.get(key) ?? []), x]);
  }
  const out: LinkGroup[] = [];
  for (const [key, members] of groups) {
    const years = new Set(members.map(m => m.year));
    if (years.size < 2) continue;
    const name = key.split('|')[0];
    const parties = new Set(members.map(m => m.partyId));
    const common = COMMON_NAMES.has(name);
    const review = years.size !== members.length || (common && (parties.size > 1 || parties.has('IND')));
    out.push({ key, confidence: review ? 'review' : parties.size === 1 ? 'high' : 'medium', members: [...members].sort((a, b) => a.year - b.year) });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

export function emitLinksSeed(groups: LinkGroup[]): string {
  const linked = groups.filter(g => g.confidence !== 'review');
  const rows = linked.flatMap((g, i) => g.members.map(m => `(${i + 1}, ${q(m.candidateId)})`));
  const seed: RunOnceSeed = {
    name: 'seed_bihar_person_links_v2',
    comment: [
      'Run once (seed_runs). Links the same politician across Bihar VS 2010-2025 (same name, same seat, two or more',
      'years; generated by scraper/src/bihar/links-cli.ts from the ECI data). Each group anchors on its most-linked',
      'person; only candidates whose person is an auto-created single-candidacy person outside the merge log move,',
      'so curated persons and admin merges/splits are never undone. The orphan trigger deletes the emptied persons.',
    ],
    body: [
      'CREATE TEMP TABLE link_groups (g int, cid uuid) ON COMMIT DROP;',
      `INSERT INTO link_groups (g, cid) VALUES\n${rows.join(', ')};`,
      'WITH members AS (',
      '  SELECT lg.g, c.id AS cid, c.person_id AS pid, (SELECT count(*) FROM candidates c2 WHERE c2.person_id = c.person_id) AS n',
      '  FROM link_groups lg JOIN candidates c ON c.id = lg.cid',
      '), anchor AS (',
      '  SELECT DISTINCT ON (g) g, pid FROM members ORDER BY g, n DESC, cid',
      ')',
      'UPDATE candidates c SET person_id = a.pid',
      'FROM members m JOIN anchor a ON a.g = m.g',
      'WHERE c.id = m.cid AND m.pid <> a.pid AND m.n = 1',
      "  AND NOT EXISTS (SELECT 1 FROM person_merges pm WHERE pm.duplicate->>'id' = m.pid::text OR pm.keeper_ref = m.pid);",
    ],
  };
  return runOnce(seed).join('\n');
}
```

Formatting note: the test expects the VALUES rows joined by `', '` on one line, which keeps the file short.

- [ ] **Step 3: Implement `links-cli.ts`**

```ts
/** Build seed_bihar_person_links_v2.sql + links-review.json. Usage: npx ts-node src/bihar/links-cli.ts */
import * as fs from 'fs';
import * as path from 'path';
import { DATA_DIR } from './load';
import { readExistingSeed } from './existing-seed';
import { candidateIds, type Plan } from './emit';
import { emitLinksSeed, groupCandidacies, type Candidacy } from './links';
import type { ElectionJson, Year } from './types';

const DB_DIR = path.resolve(__dirname, '../../../database');
const all: Candidacy[] = [];
for (const y of [2010, 2015, 2020, 2025] as Year[]) {
  const json: ElectionJson = JSON.parse(fs.readFileSync(path.join(DATA_DIR, `vs-${y}.json`), 'utf8'));
  const seed = readExistingSeed(fs.readFileSync(path.join(DB_DIR, `seed_bihar_vs_${y}.sql`), 'utf8'));
  // The committed year seed already holds every candidate: each one matches itself, so candidateIds gives the seeded ids.
  const byConst = new Map(seed.constituencies.map(k => [k.constNo, k.id]));
  const plan: Plan = { json, seed, matches: json.seats.map(s => ({ constId: byConst.get(s.constNo)!, matched: [], unmatchedOld: [], deleted: [] })) };
  const seededIds = new Map(seed.candidates.map(c => [`${c.constId}|${c.name}|${c.partyId}`, c.id]));
  for (const s of json.seats) for (const c of s.candidates) {
    const id = seededIds.get(`${byConst.get(s.constNo)}|${c.name}|${c.partyId}`) ?? candidateIds(plan).get(`${s.constNo}:${c.serial}`)!.candidateId;
    all.push({ candidateId: id, year: y, constNo: s.constNo, name: c.name, partyId: c.partyId });
  }
}
const groups = groupCandidacies(all);
fs.writeFileSync(path.join(DB_DIR, 'seed_bihar_person_links_v2.sql'), emitLinksSeed(groups) + '\n');
fs.writeFileSync(path.join(DATA_DIR, 'links-review.json'), JSON.stringify(groups.filter(g => g.confidence === 'review'), null, 1) + '\n');
const count = (c: string) => groups.filter(g => g.confidence === c).length;
console.log(`groups: ${count('high')} high, ${count('medium')} medium, ${count('review')} review (not linked)`);
```

Every seeded candidate exists in the year seed with a unique `(const_id, name, party_id)` key, except the rare IND duplicate names in
one seat. The fallback to `candidateIds` covers those, and Step 4 checks that every id exists in the seed.

- [ ] **Step 4: Run, check, wire**

Run: `cd scraper && npx vitest run src/bihar/__tests__/links.test.ts && npm run typecheck && npx ts-node src/bihar/links-cli.ts`.
Expected: counts printed, with high + medium likely in the hundreds to low thousands. Check that every UUID in the seed exists in a year seed:
`grep -o "'[0-9a-f-]\{36\}'" database/seed_bihar_person_links_v2.sql | sort -u | tr -d "'" | while read id; do grep -q "$id" database/seed_bihar_vs_20*.sql || echo "missing $id"; done | head`
→ no output. Look over 10 random `medium` groups (`node -e` over the groups) for plausibility, and record the counts in the commit message.

`setup.sh`: after `run seed_bihar_person_regions.sql` add `run seed_bihar_person_links_v2.sql`, with the echo line
`echo "==> Seeds: Bihar person links v2 / leaders / affidavits (run-once; must follow Bihar persons)"` placed before it.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/bihar/links.ts scraper/src/bihar/links-cli.ts scraper/src/bihar/__tests__/links.test.ts scraper/data/bihar/links-review.json database/seed_bihar_person_links_v2.sql database/setup.sh
git commit -m "feat(seed): link Bihar politicians across 2010-2025 (run-once, never undoes curated persons or merges)"
```

---

### Task 6: Curate `leaders.json` (research, user review gate)

**Files:**
- Create: `scraper/data/bihar/leaders.json`, `scraper/src/bihar/leaders-data.ts` (types + validator), `scraper/src/bihar/__tests__/leaders-data.test.ts`

**Interfaces:**
- Produces:

```ts
export interface LeaderPerson {
  key: string;                       // kebab-case, unique, e.g. "nitish-kumar"
  name: string;                      // display name for manifests, e.g. "Nitish Kumar"
  wikidata: string | null;           // e.g. "Q1355342"
  candidacies: { year: number; const_id: string }[];   // Bihar VS candidacies that are this person (may be empty: MLC)
}
export interface LeaderRole { key: string; role: string; party_id: string }
export interface LeadersFile {
  people: LeaderPerson[];
  elections: Record<'2010' | '2015' | '2020' | '2025', { leaders: LeaderRole[]; cabinet: LeaderRole[]; sources: string[] }>;
}
export function validateLeaders(f: LeadersFile, seats: Record<string, Set<string>>): string[]; // seats: year → const_ids in the year seed
```

Validation errors: duplicate `key`; a role referencing an unknown `key`; a `const_id` not in that year's seed; an election with no
`sources`; a person with neither `wikidata` nor candidacies; more than 60 people.

- [ ] **Step 1: Failing test, then validator** (`leaders-data.test.ts`)

```ts
import { describe, it, expect } from 'vitest';
import { validateLeaders, type LeadersFile } from '../leaders-data';

const base = (): LeadersFile => ({
  people: [{ key: 'nitish-kumar', name: 'Nitish Kumar', wikidata: 'Q1', candidacies: [] }, { key: 'tejashwi-yadav', name: 'Tejashwi Yadav', wikidata: 'Q2', candidacies: [{ year: 2015, const_id: 'BR_VS15_128_RAGHOPUR' }] }],
  elections: {
    '2010': { leaders: [{ key: 'nitish-kumar', role: 'Chief Minister', party_id: 'JDU' }], cabinet: [], sources: ['https://en.wikipedia.org/wiki/X'] },
    '2015': { leaders: [{ key: 'tejashwi-yadav', role: 'Deputy Chief Minister', party_id: 'RJD' }], cabinet: [], sources: ['https://en.wikipedia.org/wiki/Y'] },
    '2020': { leaders: [], cabinet: [], sources: ['s'] }, '2025': { leaders: [], cabinet: [], sources: ['s'] },
  },
});
const seats = { '2015': new Set(['BR_VS15_128_RAGHOPUR']), '2010': new Set<string>(), '2020': new Set<string>(), '2025': new Set<string>() };

describe('validateLeaders', () => {
  it('accepts a consistent file', () => { expect(validateLeaders(base(), seats)).toEqual([]); });
  it('reports unknown keys, unknown seats, missing sources and duplicates', () => {
    const f = base();
    f.elections['2010'].cabinet.push({ key: 'nobody', role: 'Minister', party_id: 'JDU' });
    f.people[1].candidacies.push({ year: 2020, const_id: 'BR_VS20_999_X' });
    f.elections['2020'].sources = [];
    f.people.push({ ...f.people[0] });
    expect(validateLeaders(f, seats)).toEqual(expect.arrayContaining([
      expect.stringMatching(/unknown person "nobody"/), expect.stringMatching(/BR_VS20_999_X/), expect.stringMatching(/2020: no sources/), expect.stringMatching(/duplicate key "nitish-kumar"/),
    ]));
  });
});
```

Implement `validateLeaders` to satisfy it (straight checks; messages as matched above). Run the test → PASS.

- [ ] **Step 2: Research and write `leaders.json`**

For each of the four elections, read the Wikipedia articles on the Bihar government formed after it (the Nitish Kumar ministries
of Nov 2010, Nov 2015, Nov 2020 and Nov 2025; search "Nitish Kumar ministry" plus the year), and on the Leader of the Opposition
in the Bihar Legislative Assembly. Use WebFetch and keep the article URLs in `sources`.
- `leaders`: Chief Minister, Deputy Chief Minister(s), Leader of the Opposition and the main opposition face (e.g. the
  Mahagathbandhan's CM candidate), as they stood right after that election.
- `cabinet`: cabinet ministers **who contested that VS election** (they have a seat), at most 12 per election, preferring
  the senior portfolios (home, finance, health, education, roads, rural development, water resources, agriculture). Role = the
  portfolio ("Minister of Finance").
- `people`: everyone referenced, with the Wikidata QID (Wikidata search API: `wbsearchentities`, check the description
  says Indian politician / Bihar) and every Bihar VS candidacy 2010–2025. Find these with
  `node -e` over `scraper/data/bihar/vs-<year>.json` + `readExistingSeed` (name similarity ≥ 0.6, same party or the party they
  were in that year). Seatless leaders (Legislative Council members) have `candidacies: []`.
- Aim for 30–50 people in total. Facts must come from the sources. Where an article is unclear, leave the person out instead of guessing.

Validate with a short script (`npx ts-node -e` calling `validateLeaders` with year → const_id sets from `readExistingSeed`).
Expected: `[]`.

- [ ] **Step 3: User review gate.** Show the user: the number of people, each election's `leaders` and `cabinet` (name, role,
  seat), and the sources. Apply their corrections. **Do not continue to Task 7 before the user approves the list.**

- [ ] **Step 4: Commit**

```bash
git add scraper/data/bihar/leaders.json scraper/src/bihar/leaders-data.ts scraper/src/bihar/__tests__/leaders-data.test.ts
git commit -m "data(bihar): curated leaders and cabinets 2010-2025 (sourced, reviewed)"
```

---

### Task 7: Leader profiles: Wikidata + Commons → Vercel Blob

**Files:**
- Modify: `scraper/package.json` (dependency `@vercel/blob`, same major as the backend: `^2.8.0`)
- Create: `scraper/src/bihar/profiles.ts`, `scraper/src/bihar/profiles-cli.ts`
- Generate: `scraper/data/bihar/leader-profiles.json`
- Test: `scraper/src/bihar/__tests__/profiles.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Credit { source_url: string; author: string | null; licence: string }
export interface Profile { key: string; wikidata: string; date_of_birth: string | null; gender: 'M' | 'F' | 'O' | null; wikipedia_url: string | null; photo_url: string | null; credit: Credit | null }
export function readEntity(entity: unknown): { image: string | null; dob: string | null; gender: 'M' | 'F' | 'O' | null; enwiki: string | null };
export function readImageInfo(page: unknown): { thumbUrl: string; credit: Credit } | null;   // null when the licence is missing
export function stripHtml(s: string): string;
```

`leader-profiles.json` = `Record<key, Profile>`. A profile with a `photo_url` is never refetched (download once). Blob path:
`persons/<QID>/photo.<ext>`, `access: 'public'`, `addRandomSuffix: false`, `allowOverwrite: true`, `contentType` from the response.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { readEntity, readImageInfo, stripHtml } from '../profiles';

describe('readEntity', () => {
  it('reads image, birth date, sex and the English Wikipedia link', () => {
    const e = { claims: {
      P18: [{ mainsnak: { datavalue: { value: 'Tejaswi Yadav 2023.jpg' } } }],
      P569: [{ mainsnak: { datavalue: { value: { time: '+1988-11-09T00:00:00Z' } } } }],
      P21: [{ mainsnak: { datavalue: { value: { id: 'Q6581097' } } } }],
    }, sitelinks: { enwiki: { title: 'Tejashwi Yadav' } } };
    expect(readEntity(e)).toEqual({ image: 'Tejaswi Yadav 2023.jpg', dob: '1988-11-09', gender: 'M', enwiki: 'https://en.wikipedia.org/wiki/Tejashwi_Yadav' });
  });
  it('tolerates missing claims and year-only dates', () => {
    expect(readEntity({ claims: { P569: [{ mainsnak: { datavalue: { value: { time: '+1951-00-00T00:00:00Z' } } } }] } }))
      .toEqual({ image: null, dob: null, gender: null, enwiki: null });
  });
});

describe('readImageInfo', () => {
  const page = { imageinfo: [{ thumburl: 'https://upload.wikimedia.org/x.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
    extmetadata: { LicenseShortName: { value: 'CC BY-SA 4.0' }, Artist: { value: '<a href="//commons.wikimedia.org/wiki/User:A">A. Photographer</a>' } } }] };
  it('reads the thumbnail and the credit, stripping HTML from the author', () => {
    expect(readImageInfo(page)).toEqual({ thumbUrl: 'https://upload.wikimedia.org/x.jpg', credit: { source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg', author: 'A. Photographer', licence: 'CC BY-SA 4.0' } });
  });
  it('refuses an image without a licence', () => {
    const p = JSON.parse(JSON.stringify(page)); delete p.imageinfo[0].extmetadata.LicenseShortName;
    expect(readImageInfo(p)).toBeNull();
  });
});

describe('stripHtml', () => {
  it('removes tags and entities', () => { expect(stripHtml('<b>Govt&nbsp;of Bihar</b> &amp; IPRD')).toBe('Govt of Bihar & IPRD'); });
});
```

Run: `cd scraper && npx vitest run src/bihar/__tests__/profiles.test.ts` → FAIL.

- [ ] **Step 2: Implement `profiles.ts`**

```ts
export interface Credit { source_url: string; author: string | null; licence: string }
export interface Profile { key: string; wikidata: string; date_of_birth: string | null; gender: 'M' | 'F' | 'O' | null; wikipedia_url: string | null; photo_url: string | null; credit: Credit | null }

type Any = Record<string, any>;
const first = (claims: Any, p: string) => claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
const SEX: Record<string, 'M' | 'F' | 'O'> = { Q6581097: 'M', Q6581072: 'F', Q1097630: 'O', Q48270: 'O' };

export const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

export function readEntity(entity: unknown) {
  const e = entity as Any;
  const time: string | undefined = first(e.claims, 'P569')?.time;
  const m = time ? /^\+(\d{4})-(\d{2})-(\d{2})T/.exec(time) : null;
  const dob = m && m[2] !== '00' && m[3] !== '00' ? `${m[1]}-${m[2]}-${m[3]}` : null;
  const title: string | undefined = e.sitelinks?.enwiki?.title;
  return {
    image: (first(e.claims, 'P18') as string | undefined) ?? null,
    dob,
    gender: SEX[first(e.claims, 'P21')?.id as string] ?? null,
    enwiki: title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}` : null,
  };
}

export function readImageInfo(page: unknown): { thumbUrl: string; credit: Credit } | null {
  const ii = (page as Any)?.imageinfo?.[0];
  const licence = ii?.extmetadata?.LicenseShortName?.value as string | undefined;
  if (!ii?.thumburl || !ii?.descriptionurl || !licence) return null;
  const artist = ii.extmetadata?.Artist?.value as string | undefined;
  return { thumbUrl: ii.thumburl, credit: { source_url: ii.descriptionurl, author: artist ? stripHtml(artist) || null : null, licence: stripHtml(licence) } };
}
```

(`encodeURIComponent` keeps the expected `Tejashwi_Yadav`; titles with apostrophes etc. stay valid URLs.)

- [ ] **Step 3: Implement `profiles-cli.ts`**

```ts
/**
 * Fetch Tier A leader profiles (Wikidata + Commons), upload photos once to our Vercel Blob store, write leader-profiles.json.
 * Usage: BLOB_READ_WRITE_TOKEN=… npx ts-node src/bihar/profiles-cli.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { put } from '@vercel/blob';
import { DATA_DIR } from './load';
import { readEntity, readImageInfo, type Profile } from './profiles';
import type { LeadersFile } from './leaders-data';

const UA = 'MatdaanPulse/1.0 (mannu.ray@gmail.com)';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const json = async (url: string) => { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json() as Promise<any>; };

(async () => {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error('BLOB_READ_WRITE_TOKEN is not set');
  const leaders: LeadersFile = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'leaders.json'), 'utf8'));
  const file = path.join(DATA_DIR, 'leader-profiles.json');
  const out: Record<string, Profile> = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const p of leaders.people) {
    if (!p.wikidata || out[p.key]?.photo_url) continue;
    const ent = readEntity(Object.values((await json(`https://www.wikidata.org/wiki/Special:EntityData/${p.wikidata}.json`)).entities)[0]);
    let photo_url: string | null = null, credit = null;
    if (ent.image) {
      await sleep(1000);
      const pages = (await json(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&titles=${encodeURIComponent(`File:${ent.image}`)}`)).query.pages;
      const info = readImageInfo(Object.values(pages)[0]);
      if (info) {
        const img = await fetch(info.thumbUrl, { headers: { 'User-Agent': UA } });
        if (!img.ok) throw new Error(`${img.status} ${info.thumbUrl}`);
        const type = img.headers.get('content-type') ?? 'image/jpeg';
        const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
        const blob = await put(`persons/${p.wikidata}/photo.${ext}`, Buffer.from(await img.arrayBuffer()), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: type, token });
        photo_url = blob.url; credit = info.credit;
      } else console.warn(`  ${p.key}: image has no licence metadata; skipped`);
    }
    out[p.key] = { key: p.key, wikidata: p.wikidata, date_of_birth: ent.dob, gender: ent.gender, wikipedia_url: ent.enwiki, photo_url, credit };
    console.log(`${p.key}: ${photo_url ? 'photo' : 'no photo'}${ent.dob ? `, born ${ent.dob}` : ''}`);
    fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n'); // after each person: a crash never loses an upload
    await sleep(1000);
  }
})().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4: Run**

Run: `cd scraper && npm i --save @vercel/blob@^2.8.0 && npx vitest run src/bihar/__tests__/profiles.test.ts && npm run typecheck`,
then `set -a; . ./.env; set +a; npx ts-node src/bihar/profiles-cli.ts` (the scraper `.env` has `BLOB_READ_WRITE_TOKEN`).
Expected: one line per leader. Open two photo URLs in a browser (or `curl -sI <url>` → 200, `image/*`). Re-run → nothing refetched.

- [ ] **Step 5: Commit**

```bash
git add scraper/package.json scraper/package-lock.json scraper/src/bihar/profiles.ts scraper/src/bihar/profiles-cli.ts scraper/src/bihar/__tests__/profiles.test.ts scraper/data/bihar/leader-profiles.json
git commit -m "feat(scraper): Bihar leader profiles from Wikidata/Commons, photos in our Blob store with credits"
```

---

### Task 8: Leaders seed: link candidacies, fill profiles, credits, manifests

**Files:**
- Create: `scraper/src/bihar/leaders-seed.ts`, `scraper/src/bihar/leaders-cli.ts`
- Generate: `database/seed_bihar_leaders.sql`
- Modify: `database/setup.sh` (after the links v2 seed)
- Test: `scraper/src/bihar/__tests__/leaders-seed.test.ts`

**Interfaces:**
- Consumes: `LeadersFile` (Task 6), `Profile` (Task 7), `readExistingSeed`, `stableUuid`, `runOnce`, `q`, `similarity`, `YEARS`.
- Produces:
  - `interface ResolvedPerson { key: string; name: string; candidateIds: string[]; fixedId: string | null; profile: Profile | null }`.
    `fixedId` is set only when `candidateIds` is empty.
  - `personExpr(p: ResolvedPerson): string` → `'<fixedId>'::uuid` or `(SELECT person_id FROM candidates WHERE id = '<first candidate id>')`.
  - `bioFor(key: string, f: LeadersFile): string | null`, e.g. "Chief Minister of Bihar in the 2010, 2015, 2020 and 2025
    governments." (roles grouped by role text, years joined with commas and "and"; leaders first, then cabinet; null when no roles).
  - `emitLeadersSeed(f: LeadersFile, people: ResolvedPerson[], electionIds: Record<string, string>): string`.

Seed layout:
- `always` (every run, idempotent): `INSERT INTO persons (id, name) VALUES (fixed ids…) ON CONFLICT (id) DO NOTHING;` and
  `INSERT INTO image_credits (url, source_url, author, licence) VALUES … ON CONFLICT (url) DO NOTHING;`.
- run-once body:
  1. Linking: for each person with ≥ 2 candidacies, re-point the others to the first candidacy's person, only when their person has
     one candidacy and is outside the merge log (same SQL guard as Task 5, per person).
  2. Fill-only: `UPDATE persons SET photo_url = COALESCE(photo_url, …), date_of_birth = COALESCE(date_of_birth, …::date), gender = COALESCE(gender, …),
     wikipedia_url = COALESCE(wikipedia_url, …), bio = COALESCE(bio, …), state_id = COALESCE(state_id, 5) WHERE id = <personExpr>;`
  3. Manifests: per election, `UPDATE elections SET manifest_url = (manifest_url::jsonb || jsonb_build_object('watchlists', jsonb_build_array(<leaders list>, <cabinet list>)))::text WHERE id = '<id>' AND manifest_url IS NOT NULL;`.
     Each list: `jsonb_build_object('id','leaders','name','Leaders','entries', jsonb_build_array(jsonb_build_object('name', <name>, 'party_id', <party>, 'const_id', <seat of that year's candidacy or ''>, 'role', <role>, 'person_id', (<personExpr>)::text), …))`,
     and the same for `'cabinet','Cabinet'`. Omit a list that has no entries.
- Name `seed_bihar_leaders`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { bioFor, emitLeadersSeed, personExpr, type ResolvedPerson } from '../leaders-seed';
import type { LeadersFile } from '../leaders-data';

const f: LeadersFile = {
  people: [{ key: 'nk', name: 'Nitish Kumar', wikidata: 'Q1', candidacies: [] }, { key: 'ty', name: 'Tejashwi Yadav', wikidata: 'Q2', candidacies: [{ year: 2015, const_id: 'BR_VS15_128_RAGHOPUR' }, { year: 2020, const_id: 'BR_VS20_128_RAGHOPUR' }] }],
  elections: {
    '2010': { leaders: [{ key: 'nk', role: 'Chief Minister', party_id: 'JDU' }], cabinet: [], sources: ['s'] },
    '2015': { leaders: [{ key: 'nk', role: 'Chief Minister', party_id: 'JDU' }, { key: 'ty', role: 'Deputy Chief Minister', party_id: 'RJD' }], cabinet: [], sources: ['s'] },
    '2020': { leaders: [{ key: 'nk', role: 'Chief Minister', party_id: 'JDU' }, { key: 'ty', role: 'Leader of the Opposition', party_id: 'RJD' }], cabinet: [], sources: ['s'] },
    '2025': { leaders: [], cabinet: [], sources: ['s'] },
  },
};
const people: ResolvedPerson[] = [
  { key: 'nk', name: 'Nitish Kumar', candidateIds: [], fixedId: 'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa', profile: { key: 'nk', wikidata: 'Q1', date_of_birth: '1951-03-01', gender: 'M', wikipedia_url: 'https://en.wikipedia.org/wiki/Nitish_Kumar', photo_url: 'https://blob/persons/Q1/photo.jpg', credit: { source_url: 'https://commons/File:N.jpg', author: "O'Brien", licence: 'CC BY 4.0' } } },
  { key: 'ty', name: 'Tejashwi Yadav', candidateIds: ['11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'], fixedId: null, profile: null },
];
const ids = { '2010': 'e10', '2015': 'e15', '2020': 'e20', '2025': 'e25' };

describe('leaders seed', () => {
  it('writes bios from the curated roles', () => {
    expect(bioFor('nk', f)).toBe('Chief Minister of Bihar in the 2010, 2015 and 2020 governments.');
    expect(bioFor('ty', f)).toBe('Deputy Chief Minister of Bihar in the 2015 government; Leader of the Opposition after the 2020 election.');
  });
  it('addresses persons through a candidate, or a fixed id when seatless', () => {
    expect(personExpr(people[0])).toBe("'aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa'::uuid");
    expect(personExpr(people[1])).toBe("(SELECT person_id FROM candidates WHERE id = '11111111-1111-1111-1111-111111111111')");
  });
  it('emits always-idempotent inserts, a guarded link, fill-only updates and manifest watchlists', () => {
    const sql = emitLeadersSeed(f, people, ids);
    const always = sql.slice(0, sql.indexOf('\\if :seed_apply'));
    expect(always).toContain("INSERT INTO persons (id, name) VALUES\n  ('aaaaaaaa-aaaa-5aaa-8aaa-aaaaaaaaaaaa', 'Nitish Kumar')\nON CONFLICT (id) DO NOTHING;");
    expect(always).toContain("('https://blob/persons/Q1/photo.jpg', 'https://commons/File:N.jpg', 'O''Brien', 'CC BY 4.0')");
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_leaders')");
    expect(sql).toContain("WHERE c.id IN ('22222222-2222-2222-2222-222222222222')");
    expect(sql).toContain('(SELECT count(*) FROM candidates c2 WHERE c2.person_id = c.person_id) = 1');
    expect(sql).toContain("photo_url = COALESCE(photo_url, 'https://blob/persons/Q1/photo.jpg')");
    expect(sql).toContain("date_of_birth = COALESCE(date_of_birth, '1951-03-01'::date)");
    expect(sql).toContain("'person_id', ((SELECT person_id FROM candidates WHERE id = '11111111-1111-1111-1111-111111111111'))::text");
    expect(sql).toContain("'const_id', 'BR_VS20_128_RAGHOPUR'");
    expect(sql).toContain("WHERE id = 'e20' AND manifest_url IS NOT NULL;");
    expect(sql).not.toMatch(/WHERE id = 'e25'/); // no entries that year
    expect(sql).not.toMatch(/metadata/);
  });
});
```

Bio rule (pinned by the test):
- Group a person's roles by role text and order the groups by first year.
- Leader roles that are government posts (Chief Minister, Deputy Chief Minister, Minister …) read "<role> of Bihar in the <years> government(s)".
- "Leader of the Opposition" reads "Leader of the Opposition after the <years> election(s)".
- Cabinet roles read "<role> in the <years> government(s)".
- Join the parts with "; " and end with ".".
- Years are joined as "2010, 2015 and 2020". The word is singular for one year.

Run: `cd scraper && npx vitest run src/bihar/__tests__/leaders-seed.test.ts` → FAIL.

- [ ] **Step 2: Implement `leaders-seed.ts`** to satisfy the tests:
  - `personExpr`, `bioFor`, `emitLeadersSeed` with the layout above.
  - Use `q()` for every literal.
  - Use `runOnce({ name: 'seed_bihar_leaders', comment: [...], always: [...], body: [...] })`.
  - Link statement per person:
    `UPDATE candidates c SET person_id = <personExpr> WHERE c.id IN (<other ids>) AND c.person_id <> <personExpr> AND (SELECT count(*) FROM candidates c2 WHERE c2.person_id = c.person_id) = 1 AND NOT EXISTS (SELECT 1 FROM person_merges pm WHERE pm.duplicate->>'id' = c.person_id::text OR pm.keeper_ref = c.person_id);`.
  - The entry's `const_id` is that person's candidacy for that year, or `''`.

- [ ] **Step 3: Implement `leaders-cli.ts`**: load `leaders.json`, `leader-profiles.json` and the year seeds (`readExistingSeed`). Resolve each
  person's `candidacies` to candidate ids: the year seed's candidate in that `const_id` whose name best matches the person (`similarity`, ≥ 0.5; fail
  loudly otherwise). `fixedId = stableUuid('bihar-leader', key)` when there are no candidacies. Election ids come from `YEARS`. Write
  `database/seed_bihar_leaders.sql` and print counts (people, linked candidacies, photos, manifest entries per year).

- [ ] **Step 4: Run, wire, verify on a scratch DB**

Run: `cd scraper && npx vitest run src/bihar && npm run typecheck && npx ts-node src/bihar/leaders-cli.ts`.
`setup.sh`: after `run seed_bihar_person_links_v2.sql` add `run seed_bihar_leaders.sql`.
Scratch check:
```bash
B=postgresql://admin:password123@localhost:3083
psql -X -q $B/postgres -c "DROP DATABASE IF EXISTS et_leaders" -c "CREATE DATABASE et_leaders"
DATABASE_URL=$B/et_leaders database/setup.sh >/dev/null
psql -X $B/et_leaders -At -c "SELECT count(*) FILTER (WHERE photo_url IS NOT NULL), count(*) FILTER (WHERE bio IS NOT NULL) FROM persons" \
  -c "SELECT e.year, jsonb_array_length(w->'entries') FROM elections e, jsonb_array_elements(e.manifest_url::jsonb->'watchlists') w WHERE e.state_id=5 AND e.type='VS' ORDER BY 1" \
  -c "SELECT count(*) FROM image_credits"
DATABASE_URL=$B/et_leaders database/setup.sh >/dev/null   # second run: no error, nothing changes
psql -X -q $B/postgres -c "DROP DATABASE et_leaders"
```
Expected: photo and bio counts match the profiles and people; each year lists its watchlists; the second run succeeds.
Also check one leader with `curl -s localhost:3082/api/v1/candidates/persons/<id>` after upgrading the local DB in Task 10.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/bihar/leaders-seed.ts scraper/src/bihar/leaders-cli.ts scraper/src/bihar/__tests__/leaders-seed.test.ts database/seed_bihar_leaders.sql database/setup.sh
git commit -m "feat(seed): Bihar leaders: linked candidacies, credited photos, bios, manifest leaders/cabinet by person_id"
```

---

### Task 9: Winners' affidavits from MyNeta

**Files:**
- Create: `scraper/src/bihar/affidavits.ts`, `scraper/src/bihar/affidavits-cli.ts`
- Generate: `scraper/data/bihar/affidavits-{2010,2015,2020,2025}.json`, `database/seed_bihar_affidavits.sql`
- Modify: `database/setup.sh` (after the leaders seed)
- Test: `scraper/src/bihar/__tests__/affidavits.test.ts`

**Interfaces:**
- Consumes: `parseRupeeAmount` from `scraper/src/adapters/myneta-adapter.ts` (check its exact signature; it turns "Rs 2,01,83,564 ~ 2 Crore+" into 20183564),
  `readExistingSeed`, `vs-<year>.json` (winners), `similarity`, `splitAcName`, `normName`, `runOnce`, `q`.
- Produces:
  - `MYNETA_SLUGS = { 2010: 'bih2010', 2015: 'bihar2015', 2020: 'bihar2020', 2025: 'Bihar2025' }`
  - `interface WinnerRow { name: string; constituency: string; party: string; criminalCases: number | null; education: string | null; assets: number | null; liabilities: number | null; sourceUrl: string }`
  - `parseWinners(html: string, sourceUrl: string): WinnerRow[]`. Rows come from the "show_winners" table, with `sourceUrl` set to that candidate's `candidate.php?candidate_id=…` page.
  - `interface Affidavit { candidateId: string; constNo: number; criminalCases: number | null; assets: number | null; liabilities: number | null; education: string | null; source: string }`
  - `matchWinners(rows: WinnerRow[], seats: { constNo: number; name: string; winner: { candidateId: string; name: string } }[]): { matched: Affidavit[]; unmatched: string[] }`.
    The seat is matched by the normalised constituency name (reservation marker stripped). The winner's name similarity must be ≥ 0.5, otherwise the row is unmatched.
  - `emitAffidavitsSeed(byYear: Record<string, Affidavit[]>): string`: run-once `seed_bihar_affidavits`, fill-only (`COALESCE`) on
    `candidates.assets/liabilities/criminal_cases`, and `persons.education` through the candidate.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { parseWinners, matchWinners, emitAffidavitsSeed } from '../affidavits';

const HTML = `<table><tr><th>Sno</th><th>Candidate</th><th>Constituency ∇</th><th>Party</th><th>Criminal Case</th><th>Education</th><th>Total Assets</th><th>Liabilities</th></tr>
<tr><td>1</td><td><a href="candidate.php?candidate_id=9784">Manoj Manzil</a></td><td>AGIAON (SC)</td><td>CPI(ML)(L)</td><td>30</td><td>Graduate</td><td>Rs&nbsp;3,16,500 ~ 3&nbsp;Lacs+</td><td>Rs&nbsp;0 ~</td></tr>
<tr><td>2</td><td><a href="candidate.php?candidate_id=12606">Narendra Narayan Yadav</a></td><td>ALAMNAGAR</td><td>JD(U)</td><td>1</td><td>Graduate</td><td>Rs&nbsp;2,01,83,564 ~ 2&nbsp;Crore+</td><td>Rs&nbsp;84,303 ~ 84&nbsp;Thou+</td></tr></table>`;
const SRC = 'https://myneta.info/bihar2020/index.php?action=show_winners&sort=default';

describe('affidavits', () => {
  it('parses the winners table', () => {
    expect(parseWinners(HTML, SRC)).toEqual([
      { name: 'Manoj Manzil', constituency: 'AGIAON (SC)', party: 'CPI(ML)(L)', criminalCases: 30, education: 'Graduate', assets: 316500, liabilities: 0, sourceUrl: 'https://myneta.info/bihar2020/candidate.php?candidate_id=9784' },
      { name: 'Narendra Narayan Yadav', constituency: 'ALAMNAGAR', party: 'JD(U)', criminalCases: 1, education: 'Graduate', assets: 20183564, liabilities: 84303, sourceUrl: 'https://myneta.info/bihar2020/candidate.php?candidate_id=12606' },
    ]);
  });
  it('matches by seat name and winner name, and reports the rest', () => {
    const seats = [
      { constNo: 195, name: 'Agiaon', winner: { candidateId: 'c195', name: 'Manoj Manjil' } },
      { constNo: 70, name: 'Alamnagar', winner: { candidateId: 'c70', name: 'Someone Else Entirely' } },
    ];
    const r = matchWinners(parseWinners(HTML, SRC), seats);
    expect(r.matched).toEqual([{ candidateId: 'c195', constNo: 195, criminalCases: 30, assets: 316500, liabilities: 0, education: 'Graduate', source: 'https://myneta.info/bihar2020/candidate.php?candidate_id=9784' }]);
    expect(r.unmatched).toEqual(['ALAMNAGAR: Narendra Narayan Yadav (winner in our data: Someone Else Entirely)']);
  });
  it('emits a run-once fill-only seed', () => {
    const sql = emitAffidavitsSeed({ 2020: [{ candidateId: '11111111-1111-1111-1111-111111111111', constNo: 195, criminalCases: 30, assets: 316500, liabilities: 0, education: 'Graduate', source: 's' }] });
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_affidavits')");
    expect(sql).toContain('assets = COALESCE(c.assets, v.assets::bigint)');
    expect(sql).toContain("('11111111-1111-1111-1111-111111111111', 30, 316500, 0, 'Graduate')");
    expect(sql).toContain('education = COALESCE(p.education, v.education)');
  });
});
```

Run → FAIL.

- [ ] **Step 2: Implement `affidavits.ts`.** Use cheerio:
  - Find the table whose header row's cells start with `Sno|Candidate`.
  - Map columns by header text (Candidate, Constituency, Party, Criminal Case, Education, Total Assets, Liabilities).
  - Resolve the candidate link against the source URL with `new URL(href, sourceUrl).toString()`.
  - Numbers: `parseRupeeAmount` for money, `Number()` for criminal cases. `Rs 0 ~` → 0; blank or "Nil" → null.
  - `matchWinners`: key = `normName(splitAcName(x).name)` on both sides.
  - The seed: one `UPDATE candidates c SET … FROM (VALUES …) v(id, criminal_cases, assets, liabilities, education) WHERE c.id = v.id::uuid`
    with `COALESCE`, then `UPDATE persons p SET education = COALESCE(p.education, v.education) FROM (VALUES …) v(id, …) JOIN candidates c ON c.id = v.id::uuid WHERE p.id = c.person_id`.

- [ ] **Step 3: Implement `affidavits-cli.ts`**:
  - For each year, fetch `https://myneta.info/<slug>/index.php?action=show_winners&sort=default` into `scraper/data/raw/myneta/<slug>-winners.html`
    if it isn't cached (browser UA, 2 s between requests).
  - Build `seats` from `vs-<year>.json` (the WON candidate per seat), plus the year seed's constituency names and candidate ids
    (matched by `const_id` + name + party, as in Task 5's CLI).
  - Run `matchWinners`, and write `affidavits-<year>.json` (`{ matched, unmatched }`) and `database/seed_bihar_affidavits.sql`.
  - Print matched/unmatched counts per year.

- [ ] **Step 4: Run and wire**

Run: `cd scraper && npx vitest run src/bihar && npm run typecheck && npx ts-node src/bihar/affidavits-cli.ts`.
Expected: about 200–227 matched per year (MyNeta lacks some winners), and few unmatched (each listed; inspect them).
`setup.sh`: after `run seed_bihar_leaders.sql` add `run seed_bihar_affidavits.sql`.

- [ ] **Step 5: Commit**

```bash
git add scraper/src/bihar/affidavits.ts scraper/src/bihar/affidavits-cli.ts scraper/src/bihar/__tests__/affidavits.test.ts scraper/data/bihar/affidavits-*.json database/seed_bihar_affidavits.sql database/setup.sh
git commit -m "feat(seed): Bihar winners' affidavits from MyNeta (run-once, fill-only)"
```

---

### Task 10: Verify end to end, upgrade the local DB, docs

**Files:**
- Modify: `docs/FEATURES.md`, `CLAUDE.md` (seed order, Key Data Files), `docs/DEPLOYMENT.md` §5.0a, `docs/SEEDING_NEXT_PHASE.md`

- [ ] **Step 1: Two-DB check**

Run: `scraper/src/bihar/two-db-check.sh`. Expected: all `same`. The Plan 3 seeds don't change constituencies, candidates' tracked
columns or results, and `setup.sh` re-runs cleanly. Then a fresh-DB spot check (as in Task 8 Step 4) for linked person counts:
`SELECT count(*) FROM persons p WHERE (SELECT count(*) FROM candidates c WHERE c.person_id = p.id) > 1` is higher than before
(record before/after).

- [ ] **Step 2: Upgrade the local DB and look at it**

Back up first: `pg_dump --no-owner --no-privileges postgresql://admin:password123@localhost:3083/election_tracker | gzip > <scratchpad>/election_tracker-before-plan3.sql.gz`.
Then run `DATABASE_URL=… database/setup.sh` and restart the backend. Check:
- `curl -s localhost:3082/api/v1/credits | head -c 400` lists the photos with `used_by`.
- A leader's person page API (`/api/v1/candidates/persons/<id>`) shows `photo_url`, `photo_credit`, `bio`, and several candidacies.
- `/api/v1/elections/<bihar 2020 id>/manifest` has the `leaders` and `cabinet` watchlists with `person_id`.
- With the frontend dev server running (`cd frontend && npm run dev`), open the Bihar 2020 dashboard: the Key Leaders strip shows the leaders, a seatless leader links to the person page, the person page shows the photo with its credit line, and About shows Credits.

- [ ] **Step 3: Docs**
- `docs/FEATURES.md`: add "Bihar persons and leaders" under the Bihar results data section. Cover the linking v2 rules, `leaders.json` (curated,
  sourced, user-reviewed), the profiles pipeline (Wikidata/Commons → Blob, credits), the seeds and their order, the credits UI,
  `person_id` in manifests, and MyNeta affidavits (winners only; ADR doesn't cover every winner).
- `CLAUDE.md` seed order: after `seed_bihar_person_regions.sql` add `seed_bihar_person_links_v2.sql` → `seed_bihar_leaders.sql` → `seed_bihar_affidavits.sql`.
  Mention migration 022 `image_credits` and `GET /credits`.
- `docs/DEPLOYMENT.md` §5.0a: the new run-once seeds and what they change on production (links only auto single-candidacy persons; fill-only fields; manifests'
  `watchlists` rewritten once, so a manifest draft being edited at deploy time should be published first).
- `docs/SEEDING_NEXT_PHASE.md` §2: persons, photos and leaders done for Bihar (date).

- [ ] **Step 4: Commit**

```bash
git add docs/FEATURES.md CLAUDE.md docs/DEPLOYMENT.md docs/SEEDING_NEXT_PHASE.md
git commit -m "docs: Bihar persons, leaders, photos (credited), affidavits"
```
