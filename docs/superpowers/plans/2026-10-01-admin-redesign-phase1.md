# Admin Redesign Phase 1 — Shell + Live Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the admin shell with the new grouped sidebar + top bar (global election picker), and rebuild the Live Console as the split view with auto margin, editable rounds, one-call "Save seat" and soft seat locks.

**Architecture:**
- Tailwind v4 (utilities only, preflight off) and Radix primitives go into `admin/`, with the existing `admin.css` moved into a lower `legacy` cascade layer, so old pages keep working inside the new shell.
- Pure seat logic lives in `admin/src/utils/seat-math.ts`; hooks own the state; presentational components live in `admin/src/components/{ui,shell,live}`.
- The backend gets a Redis-backed `SeatLockService`, three endpoints under `/admin/live/locks`, a `seat-lock` SSE event, and rounds in `getLiveResults`.

**Tech Stack:**
- Admin: React 18, Vite 5, Tailwind CSS v4 (`@tailwindcss/vite`), Radix (`dialog`, `select`, `dropdown-menu`), `lucide-react`, `clsx` + `tailwind-merge`, Vitest + Testing Library.
- Backend: NestJS, ioredis, Jest.

**Spec:** `docs/superpowers/specs/2026-10-01-admin-redesign-design.md` (§1 Shell, §3 Live Console, §5 Visual rules, §6 Architecture). Reference screens: `docs/design/admin/live-console.png` + `.html`, plus the fix list in `docs/design/admin/NOTES.md`.

## Global Constraints

- Colours exactly: sidebar `#1e293b`, page `#f8fafc`, subtle `#f1f5f9`, card `#ffffff`, ink `#0f172a` / `#475569` / `#94a3b8`, accent `#4f46e5` / hover `#4338ca` / soft `#eef2ff`, border `#e2e8f0` / strong `#cbd5e1`, success `#10b981` (soft `#ecfdf5`, text `#065f46`), warning `#f59e0b` (soft `#fffbeb`, text `#92400e`), danger `#f43f5e` (soft `#fff1f2`, text `#9f1239`).
- Font Inter. Radius 6px for controls, 10px for cards, 16px for panels. Light shadows only.
- Sentence case for every label, heading and button. No ALL CAPS, no `uppercase` class.
- No accordions or click-to-expand for core info.
- Tailwind preflight stays **off** (legacy pages depend on browser defaults + `admin.css`).
- Status colours: Won = success, Leading = accent, Pending = muted, Trailing/Lost = secondary text.
- Margin convention: leader margin = leader votes − runner-up votes. Every other candidate's margin = leader votes − their votes (always ≥ 0). NOTA (`party_id === 'NOTA'`) is never the leader.
- Lock TTL 120 s, heartbeat every 45 s, Redis key `lock:seat:{electionId}:{constId}`. These are constants; there is no env var.
- No Prisma schema or SQL migration change in this phase.
- Roles: lock endpoints are `SUPER_ADMIN`, `EDITOR` (same as the overrides).
- Verification commands:
  - admin: `cd admin && npm test && npm run build`
  - backend: `cd backend && npm test`

## Review Focus

1. **↑/↓ inside a votes input** must not change the seat. Votes inputs are `type="text" inputMode="numeric"`, and seat navigation only fires when focus is not in an input/select. Pinned in Task 13.
2. **An SSE-driven reload while the editor has unsaved edits** must keep the edits and show "changed elsewhere". Pinned in Task 10.
3. **Tie at the top / all-zero votes / NOTA with most votes:**
   - with a tie or no votes, nobody leads and Declare won is disabled
   - NOTA is never the leader
   
   Pinned in Task 6.
4. **Typed or pasted "61,204" or " 61204 "** parses to 61204, and "61.2" or "-5" are rejected inline. Pinned in Task 6.
5. **Lock lifecycle:**
   - Switching seats releases the old lock.
   - Closing the tab sends a keepalive release.
   - Redis down means locking is "unavailable" but saving still works.
   - A take-over makes the previous holder read-only.
   
   Pinned in Tasks 5 and 11.

## File map

**Backend**
- Modify `backend/src/modules/results/results.service.ts`: add `current_round`, `total_rounds` to `getLiveResults`.
- Modify `backend/src/modules/redis/redis.service.ts`: add `isPubReady`, `acquireOwned`, `releaseOwned`, `forceSet`, `getMany`.
- Create `backend/src/modules/live/seat-lock.service.ts` (+ `.spec.ts`).
- Create `backend/src/modules/live/dto/seat-lock.dto.ts`.
- Create `backend/src/modules/live/seat-lock.controller.ts`.
- Modify `backend/src/modules/live/live.module.ts`.
- Modify `backend/src/common/exceptions/error-codes.ts` and `result.exception.ts`: add `SEAT_LOCKED`, `LOCKS_UNAVAILABLE`.

**Admin**
- Modify `admin/package.json`, `admin/vite.config.ts`, `admin/src/main.tsx`.
- Create `admin/src/theme/tailwind.css` and `admin/src/theme/legacy.css`.
- Create `admin/src/components/ui/{cn.ts,Button.tsx,Badge.tsx,Kbd.tsx,ui.test.tsx}`.
- Create `admin/src/utils/seat-math.ts` (+ `.test.ts`).
- Modify `admin/src/types/index.ts` (`LiveConstituency` rounds, `SeatLock`).
- Modify `admin/src/services/election.service.ts`:
  - add `bulkOverride`, `getSeatLocks`, `acquireSeatLock`, `releaseSeatLock`
  - add SSE `onSeatLock` and `onStatus`
- Create `admin/src/context/ElectionContext.tsx` (+ `.test.tsx`).
- Create `admin/src/context/ShellStatusContext.tsx`.
- Create `admin/src/components/shell/{Sidebar.tsx,TopBar.tsx,ElectionPicker.tsx,HealthDot.tsx,ShortcutsDialog.tsx,shell.test.tsx}`.
- Modify `admin/src/utils/navigation.config.ts` (groups + lucide icons) and `admin/src/components/Layout.tsx`.
- Create `admin/src/hooks/useSeatEditor.ts` (+ `.test.ts`).
- Create `admin/src/hooks/useSeatLock.ts` (+ `.test.ts`).
- Rewrite `admin/src/hooks/useLiveConsole.ts` (+ `useLiveConsole.test.ts`).
- Create `admin/src/components/live/{SeatList.tsx,SeatEditor.tsx,LiveHeader.tsx}`.
- Rewrite `admin/src/pages/LiveConsole.tsx` (+ `LiveConsole.test.tsx`).

**Docs**
- Modify `docs/FEATURES.md` and `CLAUDE.md`.

---

### Task 1: Tailwind v4 + Radix setup with a legacy layer

**Files:**
- Modify: `admin/package.json`, `admin/vite.config.ts`, `admin/src/main.tsx`
- Create: `admin/src/theme/tailwind.css`, `admin/src/theme/legacy.css`, `admin/src/components/ui/cn.ts`

**Interfaces:**
- Produces: `cn(...classes)` from `admin/src/components/ui/cn.ts`, plus Tailwind colour tokens: `bg-sidebar`, `bg-page`, `bg-subtle`, `bg-card`, `text-ink`, `text-ink-2`, `text-muted`, `bg-accent`, `bg-accent-hover`, `bg-accent-soft`, `border-line`, `border-line-strong`, `ok`/`ok-soft`/`ok-text`, `warn`/`warn-soft`/`warn-text`, `bad`/`bad-soft`/`bad-text`, radius `rounded-control`/`rounded-card`/`rounded-panel`.

- [ ] **Step 1: Install dependencies**

```bash
cd admin
npm install tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3 clsx@^2.1.1 tailwind-merge@^3.7.0 lucide-react @radix-ui/react-dialog @radix-ui/react-select @radix-ui/react-dropdown-menu
```

- [ ] **Step 2: Add the Vite plugin and Vitest config.** Replace `admin/vite.config.ts` with:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3081,
    proxy: {
      '/symbols': 'http://localhost:3080',
    },
  },
  test: { exclude: ['node_modules/**', 'dist/**'], css: false },
});
```

- [ ] **Step 3: Create `admin/src/theme/tailwind.css`.** This mirrors `frontend/src/theme/studio.css`: utilities only, no preflight, and an explicit `@source` list.

```css
@layer legacy, theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities) source(none);
/* Tailwind only scans these paths — add an @source line for every new file/dir that uses classes. */
@source "../components/ui";
@source "../components/shell";
@source "../components/live";
@source "../components/Layout.tsx";
@source "../pages/LiveConsole.tsx";

@theme {
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

- [ ] **Step 4: Create `admin/src/theme/legacy.css`**

```css
@layer legacy, theme, base, components, utilities;
@import "./admin.css" layer(legacy);
```

- [ ] **Step 5: Wire the CSS into `admin/src/main.tsx`.** Replace `import './theme/admin.css';` with:

```ts
import './theme/tailwind.css';
import './theme/legacy.css';
```

- [ ] **Step 6: Create `admin/src/components/ui/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Join class names; later Tailwind classes win over conflicting earlier ones. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 7: Verify that the build and the existing tests still pass**

Run: `cd admin && npm test && npm run build`
Expected: all existing tests PASS. The build succeeds, and `dist/assets/*.css` contains `--color-accent`.

- [ ] **Step 8: Manual check.** Run `npm run dev` and open http://localhost:3081. The old pages must look unchanged (admin.css still applies from the legacy layer).

- [ ] **Step 9: Commit**

```bash
git add admin/package.json admin/package-lock.json admin/vite.config.ts admin/src/main.tsx admin/src/theme admin/src/components/ui/cn.ts
git commit -m "admin: add Tailwind v4 + Radix, move admin.css to legacy layer"
```

---

### Task 2: UI primitives (Button, Badge, Kbd)

**Files:**
- Create: `admin/src/components/ui/Button.tsx`, `Badge.tsx`, `Kbd.tsx`
- Test: `admin/src/components/ui/ui.test.tsx`

**Interfaces:**
- Consumes: `cn` (Task 1).
- Produces:
  - `<Button variant="primary"|"success"|"outline"|"ghost"|"danger" size="sm"|"md">` (a native button, forwards props)
  - `<Badge tone="accent"|"ok"|"warn"|"bad"|"muted">`
  - `<StatusPill status="LEADING"|"WON"|"TRAILING"|"LOST"|"PENDING">` (renders sentence case: "Leading", "Won", "Trailing", "Lost", "Pending")
  - `<Kbd>`

- [ ] **Step 1: Write the failing test** `admin/src/components/ui/ui.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from './Button';
import { StatusPill } from './Badge';

afterEach(cleanup);

describe('ui primitives', () => {
  it('Button defaults to type="button" and applies the variant', () => {
    render(<Button variant="primary">Save seat</Button>);
    const btn = screen.getByRole('button', { name: 'Save seat' });
    expect(btn.getAttribute('type')).toBe('button');
    expect(btn.className).toContain('bg-accent');
  });

  it('StatusPill renders sentence case labels', () => {
    render(<><StatusPill status="LEADING" /><StatusPill status="WON" /><StatusPill status="PENDING" /></>);
    expect(screen.getByText('Leading')).toBeTruthy();
    expect(screen.getByText('Won')).toBeTruthy();
    expect(screen.getByText('Pending')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/components/ui/ui.test.tsx`
Expected: FAIL with "Failed to resolve import './Button'".

- [ ] **Step 3: Implement** `Button.tsx`

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'success' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
  success: 'bg-ok text-white hover:brightness-95 shadow-sm',
  outline: 'border border-line-strong bg-card text-ink hover:bg-subtle',
  ghost: 'text-ink-2 hover:bg-subtle hover:text-ink',
  danger: 'border border-bad/40 bg-card text-bad-text hover:bg-bad-soft',
};
const SIZES: Record<Size, string> = { sm: 'h-7 px-2.5 text-xs', md: 'h-9 px-4 text-sm' };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-control font-medium whitespace-nowrap transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...props}
    />
  );
});
```

`Badge.tsx`

```tsx
import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Tone = 'accent' | 'ok' | 'warn' | 'bad' | 'muted';
const TONES: Record<Tone, string> = {
  accent: 'bg-accent-soft text-accent',
  ok: 'bg-ok-soft text-ok-text',
  warn: 'bg-warn-soft text-warn-text',
  bad: 'bg-bad-soft text-bad-text',
  muted: 'bg-subtle text-ink-2',
};

export function Badge({ tone = 'muted', className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-control px-2 py-0.5 text-[11px] font-medium whitespace-nowrap', TONES[tone], className)} {...props} />;
}

export type PillStatus = 'LEADING' | 'WON' | 'TRAILING' | 'LOST' | 'PENDING';
const PILL: Record<PillStatus, { tone: Tone; label: string }> = {
  LEADING: { tone: 'accent', label: 'Leading' },
  WON: { tone: 'ok', label: 'Won' },
  TRAILING: { tone: 'muted', label: 'Trailing' },
  LOST: { tone: 'muted', label: 'Lost' },
  PENDING: { tone: 'muted', label: 'Pending' },
};

export function StatusPill({ status, className }: { status: PillStatus; className?: string }) {
  const p = PILL[status];
  return <Badge tone={p.tone} className={className}>{p.label}</Badge>;
}
```

`Kbd.tsx`

```tsx
import type { ReactNode } from 'react';

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-line bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-ink-2">{children}</kbd>;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/components/ui/ui.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add admin/src/components/ui
git commit -m "admin: Button, Badge/StatusPill, Kbd primitives"
```

---

### Task 3: Backend: return rounds in live results

**Files:**
- Modify: `backend/src/modules/results/results.service.ts` (the `getLiveResults` function, ~line 236)
- Test: `backend/src/modules/results/live-results.spec.ts` (create)

**Interfaces:**
- Produces: each item of `GET /admin/elections/:id/live-results` also has `current_round: number | null`, `total_rounds: number | null`.

- [ ] **Step 1: Write the failing test** `backend/src/modules/results/live-results.spec.ts`

```ts
import { ResultsService } from './results.service';

describe('ResultsService.getLiveResults', () => {
  it('includes the constituency round fields', async () => {
    const prisma = {
      constituencies: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', name: 'Patna Sahib', const_no: 142, type: 'GEN', current_round: 4, total_rounds: 24, results: [] },
        ]),
      },
    };
    const svc = Object.create(ResultsService.prototype) as ResultsService;
    (svc as any).prisma = prisma;
    const out = await svc.getLiveResults('e1');
    expect(out[0]).toMatchObject({ const_id: 'c1', current_round: 4, total_rounds: 24 });
    expect(prisma.constituencies.findMany.mock.calls[0][0].select).toMatchObject({ current_round: true, total_rounds: true });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd backend && npx jest src/modules/results/live-results.spec.ts`
Expected: FAIL, because `current_round` is undefined and the select does not include `current_round`.

- [ ] **Step 3: Implement.** In `getLiveResults`, add to the top-level `select`:

```ts
        current_round: true,
        total_rounds: true,
```

and in the returned mapping add, after `const_type: co.type,`:

```ts
      current_round: co.current_round ?? null,
      total_rounds: co.total_rounds ?? null,
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd backend && npx jest src/modules/results/live-results.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/results
git commit -m "backend: include current/total rounds in admin live results"
```

---

### Task 4: Backend: atomic Redis lock primitives

**Files:**
- Modify: `backend/src/modules/redis/redis.service.ts`
- Test: `backend/src/modules/redis/redis-locks.spec.ts` (create)

**Interfaces:**
- Produces (on `RedisService`):
  - `isPubReady(): boolean`
  - `acquireOwned(key: string, owner: string, value: string, ttlSeconds: number): Promise<string | null>`: returns `null` on success (key was free, or already owned by `owner` and is now refreshed). Otherwise it returns the current holder's stored value.
  - `releaseOwned(key: string, owner: string): Promise<boolean>`: deletes only when the stored value's `user_id` equals `owner`.
  - `forceSet(key: string, value: string, ttlSeconds: number): Promise<string | null>`: sets unconditionally and returns the previous value.
  - `getMany(pattern: string): Promise<string[]>`: SCAN + MGET of the values.
- The stored value is JSON with a `user_id` field. The Lua scripts compare `cjson.decode(value).user_id`.

- [ ] **Step 1: Write the failing test** `backend/src/modules/redis/redis-locks.spec.ts`

```ts
import { RedisService } from './redis.service';

function makeService(pub: Record<string, unknown>) {
  const config = { get: (_k: string, d: unknown) => d };
  const svc = new RedisService(config as any, {} as any);
  (svc as any).pub = { status: 'ready', ...pub };
  return svc;
}

describe('RedisService lock primitives', () => {
  it('isPubReady reflects the pub connection status', () => {
    expect(makeService({ status: 'ready' }).isPubReady()).toBe(true);
    expect(makeService({ status: 'reconnecting' }).isPubReady()).toBe(false);
  });

  it('acquireOwned returns null when the script reports success', async () => {
    const evalFn = jest.fn().mockResolvedValue(null);
    const svc = makeService({ eval: evalFn });
    await expect(svc.acquireOwned('k', 'u1', '{"user_id":"u1"}', 120)).resolves.toBeNull();
    expect(evalFn).toHaveBeenCalledWith(expect.stringContaining('cjson.decode'), 1, 'k', 'u1', '{"user_id":"u1"}', '120');
  });

  it('acquireOwned returns the holder value when someone else owns it', async () => {
    const svc = makeService({ eval: jest.fn().mockResolvedValue('{"user_id":"u2"}') });
    await expect(svc.acquireOwned('k', 'u1', '{"user_id":"u1"}', 120)).resolves.toBe('{"user_id":"u2"}');
  });

  it('releaseOwned is true only when the script deleted the key', async () => {
    const svc = makeService({ eval: jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(0) });
    await expect(svc.releaseOwned('k', 'u1')).resolves.toBe(true);
    await expect(svc.releaseOwned('k', 'u1')).resolves.toBe(false);
  });

  it('forceSet returns the previous value', async () => {
    const svc = makeService({ get: jest.fn().mockResolvedValue('old'), set: jest.fn().mockResolvedValue('OK') });
    await expect(svc.forceSet('k', 'new', 120)).resolves.toBe('old');
    expect((svc as any).pub.set).toHaveBeenCalledWith('k', 'new', 'EX', 120);
  });

  it('getMany scans the pattern and returns non-null values', async () => {
    const scan = jest.fn().mockResolvedValueOnce(['5', ['a']]).mockResolvedValueOnce(['0', ['b']]);
    const mget = jest.fn().mockResolvedValue(['va', null]);
    const svc = makeService({ scan, mget });
    await expect(svc.getMany('lock:*')).resolves.toEqual(['va']);
    expect(mget).toHaveBeenCalledWith('a', 'b');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd backend && npx jest src/modules/redis/redis-locks.spec.ts`
Expected: FAIL with "svc.isPubReady is not a function".

- [ ] **Step 3: Implement.** Add these methods to `RedisService`, after `delByPattern`:

```ts
  /** True when the command connection is up. `pub` has no offline queue, so callers check this to fail fast. */
  isPubReady(): boolean {
    return this.pub.status === 'ready';
  }

  /**
   * Take or refresh an owned key atomically. The value is JSON with a `user_id`.
   * Returns null on success, otherwise the current holder's value.
   */
  async acquireOwned(key: string, owner: string, value: string, ttlSeconds: number): Promise<string | null> {
    const script = `
      local cur = redis.call('GET', KEYS[1])
      if cur then
        local ok, parsed = pcall(cjson.decode, cur)
        if not ok or parsed.user_id ~= ARGV[1] then return cur end
      end
      redis.call('SET', KEYS[1], ARGV[2], 'EX', tonumber(ARGV[3]))
      return false`;
    const res = await this.pub.eval(script, 1, key, owner, value, String(ttlSeconds));
    return typeof res === 'string' ? res : null;
  }

  /** Delete an owned key only if `owner` still holds it. */
  async releaseOwned(key: string, owner: string): Promise<boolean> {
    const script = `
      local cur = redis.call('GET', KEYS[1])
      if not cur then return 0 end
      local ok, parsed = pcall(cjson.decode, cur)
      if ok and parsed.user_id == ARGV[1] then return redis.call('DEL', KEYS[1]) end
      return 0`;
    return (await this.pub.eval(script, 1, key, owner)) === 1;
  }

  /** Overwrite a key (take-over) and return what was there. */
  async forceSet(key: string, value: string, ttlSeconds: number): Promise<string | null> {
    const prev = await this.pub.get(key);
    await this.pub.set(key, value, 'EX', ttlSeconds);
    return prev;
  }

  /** Values of every key matching `pattern` (SCAN, never KEYS). */
  async getMany(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    do {
      const [next, batch] = await this.pub.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      keys.push(...batch);
    } while (cursor !== '0');
    if (keys.length === 0) return [];
    const values = await this.pub.mget(...keys);
    return values.filter((v): v is string => typeof v === 'string');
  }
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd backend && npx jest src/modules/redis`
Expected: PASS (the new file plus the existing redis specs).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/redis
git commit -m "backend: atomic owned-key primitives on RedisService"
```

---

### Task 5: Backend: SeatLockService, endpoints, SSE event

**Files:**
- Create: `backend/src/modules/live/seat-lock.service.ts`, `backend/src/modules/live/seat-lock.controller.ts`, `backend/src/modules/live/dto/seat-lock.dto.ts`
- Modify: `backend/src/modules/live/live.module.ts`, `backend/src/common/exceptions/error-codes.ts`, `backend/src/common/exceptions/result.exception.ts`
- Test: `backend/src/modules/live/seat-lock.service.spec.ts`

**Interfaces:**
- Consumes: the `RedisService` methods from Task 4, `LivePublisher.publish`, `AuditLogService.create`, `PrismaService.constituencies.findFirst`.
- Produces (HTTP, all `JwtAuthGuard` + `RolesGuard`, `@Roles('SUPER_ADMIN','EDITOR')`):
  - `GET /admin/live/locks?election_id=<uuid>` → `SeatLock[]`
  - `POST /admin/live/locks` body `{ election_id, const_id, take_over?: boolean }` → `SeatLock` (200). When someone else holds the seat it returns 409 with code `RESULT_6002` and `details: { lock: SeatLock }`.
  - `POST /admin/live/locks/release` body `{ election_id, const_id }` → 204
  - When Redis is not ready, every endpoint returns 503 with code `RESULT_6003`.
- `SeatLock = { const_id: string; user_id: string; user_name: string; acquired_at: string }`
- SSE: `{ type: 'seat-lock', data: { const_id: string, lock: SeatLock | null } }` on the election channel.
- Audit on take-over: `action: 'SEAT_LOCK_TAKEOVER'`, `entityType: 'constituency'`, `entityId: const_id`, `oldValue: previous lock`, `newValue: new lock`.

- [ ] **Step 1: Add the error codes and exceptions.** In `error-codes.ts` under `// Result (6xxx)` add:

```ts
  SEAT_LOCKED: 'RESULT_6002',
  LOCKS_UNAVAILABLE: 'RESULT_6003',
```

Append to `result.exception.ts`:

```ts
export class SeatLockedException extends BusinessException {
  constructor(lock: Record<string, unknown>) {
    super(ErrorCodes.SEAT_LOCKED, 'Seat is being edited by someone else', HttpStatus.CONFLICT, { lock });
  }
}

export class LocksUnavailableException extends BusinessException {
  constructor() {
    super(ErrorCodes.LOCKS_UNAVAILABLE, 'Seat locking is unavailable (Redis down)', HttpStatus.SERVICE_UNAVAILABLE);
  }
}
```

- [ ] **Step 2: Create the DTOs** `backend/src/modules/live/dto/seat-lock.dto.ts`

```ts
import { IsBoolean, IsOptional } from 'class-validator';
import { IsUuidLike } from '../../../common/validation/uuid-like';

export class SeatLockQuery {
  @IsUuidLike()
  election_id!: string;
}

export class SeatLockRelease {
  @IsUuidLike()
  election_id!: string;

  @IsUuidLike()
  const_id!: string;
}

export class SeatLockAcquire extends SeatLockRelease {
  @IsOptional()
  @IsBoolean()
  take_over?: boolean;
}
```

- [ ] **Step 3: Write the failing service test** `backend/src/modules/live/seat-lock.service.spec.ts`

```ts
import { SeatLockService, SEAT_LOCK_TTL_SECONDS } from './seat-lock.service';

function make(over: Partial<Record<string, jest.Mock>> = {}, ready = true) {
  const redis = {
    isPubReady: jest.fn(() => ready),
    acquireOwned: jest.fn().mockResolvedValue(null),
    releaseOwned: jest.fn().mockResolvedValue(true),
    forceSet: jest.fn().mockResolvedValue(null),
    getMany: jest.fn().mockResolvedValue([]),
    ...over,
  };
  const live = { publish: jest.fn().mockResolvedValue(undefined) };
  const audit = { create: jest.fn().mockResolvedValue({}) };
  const prisma = { constituencies: { findFirst: jest.fn().mockResolvedValue({ id: 'c1' }) } };
  const svc = new SeatLockService(redis as any, live as any, audit as any, prisma as any);
  return { svc, redis, live, audit, prisma };
}
const me = { id: 'u1', name: 'Mannu K' };

describe('SeatLockService', () => {
  it('acquires a free seat, publishes seat-lock, uses the TTL constant', async () => {
    const { svc, redis, live } = make();
    const lock = await svc.acquire('e1', 'c1', me, false);
    expect(lock).toMatchObject({ const_id: 'c1', user_id: 'u1', user_name: 'Mannu K' });
    expect(redis.acquireOwned).toHaveBeenCalledWith('lock:seat:e1:c1', 'u1', expect.any(String), SEAT_LOCK_TTL_SECONDS);
    expect(live.publish).toHaveBeenCalledWith('e1', { type: 'seat-lock', data: { const_id: 'c1', lock } });
  });

  it('throws SeatLocked (409) with the holder when someone else has it', async () => {
    const holder = { const_id: 'c1', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' };
    const { svc } = make({ acquireOwned: jest.fn().mockResolvedValue(JSON.stringify(holder)) });
    await expect(svc.acquire('e1', 'c1', me, false)).rejects.toMatchObject({ status: 409, details: { lock: holder } });
  });

  it('take-over overwrites, audits old→new, publishes', async () => {
    const holder = { const_id: 'c1', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' };
    const { svc, redis, audit, live } = make({ forceSet: jest.fn().mockResolvedValue(JSON.stringify(holder)) });
    const lock = await svc.acquire('e1', 'c1', me, true);
    expect(redis.forceSet).toHaveBeenCalled();
    expect(audit.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'u1', action: 'SEAT_LOCK_TAKEOVER', entityType: 'constituency', entityId: 'c1', oldValue: holder, newValue: lock,
    }));
    expect(live.publish).toHaveBeenCalled();
  });

  it('rejects a constituency outside the election', async () => {
    const { svc, prisma } = make();
    prisma.constituencies.findFirst.mockResolvedValue(null);
    await expect(svc.acquire('e1', 'cX', me, false)).rejects.toMatchObject({ status: 404 });
  });

  it('release publishes lock:null only when this user held it', async () => {
    const { svc, live, redis } = make();
    await svc.release('e1', 'c1', 'u1');
    expect(live.publish).toHaveBeenCalledWith('e1', { type: 'seat-lock', data: { const_id: 'c1', lock: null } });
    redis.releaseOwned.mockResolvedValue(false);
    live.publish.mockClear();
    await svc.release('e1', 'c1', 'u1');
    expect(live.publish).not.toHaveBeenCalled();
  });

  it('list parses stored locks and skips garbage', async () => {
    const l = { const_id: 'c1', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' };
    const { svc, redis } = make({ getMany: jest.fn().mockResolvedValue([JSON.stringify(l), 'not json']) });
    await expect(svc.list('e1')).resolves.toEqual([l]);
    expect(redis.getMany).toHaveBeenCalledWith('lock:seat:e1:*');
  });

  it('every call fails with 503 when Redis is not ready', async () => {
    const { svc } = make({}, false);
    await expect(svc.list('e1')).rejects.toMatchObject({ status: 503 });
    await expect(svc.acquire('e1', 'c1', me, false)).rejects.toMatchObject({ status: 503 });
    await expect(svc.release('e1', 'c1', 'u1')).rejects.toMatchObject({ status: 503 });
  });
});
```

- [ ] **Step 4: Run the test to confirm it fails**

Run: `cd backend && npx jest src/modules/live/seat-lock.service.spec.ts`
Expected: FAIL with "Cannot find module './seat-lock.service'".

- [ ] **Step 5: Implement** `backend/src/modules/live/seat-lock.service.ts`

```ts
import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LivePublisher } from './live.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConstituencyNotFoundException, LocksUnavailableException, SeatLockedException } from '../../common/exceptions';

/** Soft-lock lifetime; the Live Console refreshes it every 45 s while a seat is open. */
export const SEAT_LOCK_TTL_SECONDS = 120;

export interface SeatLock {
  const_id: string;
  user_id: string;
  user_name: string;
  acquired_at: string;
}

const keyFor = (electionId: string, constId: string) => `lock:seat:${electionId}:${constId}`;

function parse(raw: string | null): SeatLock | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v.user_id === 'string' && typeof v.const_id === 'string' ? (v as SeatLock) : null;
  } catch {
    return null;
  }
}

/** Advisory per-seat edit locks for the Live Console. Saving never requires a lock. */
@Injectable()
export class SeatLockService {
  constructor(
    private readonly redis: RedisService,
    private readonly live: LivePublisher,
    private readonly audit: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  private ensureReady() {
    if (!this.redis.isPubReady()) throw new LocksUnavailableException();
  }

  async list(electionId: string): Promise<SeatLock[]> {
    this.ensureReady();
    const values = await this.redis.getMany(keyFor(electionId, '*'));
    return values.map(parse).filter((l): l is SeatLock => l !== null);
  }

  async acquire(electionId: string, constId: string, user: { id: string; name: string }, takeOver: boolean): Promise<SeatLock> {
    this.ensureReady();
    const seat = await this.prisma.constituencies.findFirst({ where: { id: constId, election_id: electionId }, select: { id: true } });
    if (!seat) throw new ConstituencyNotFoundException(constId);

    const lock: SeatLock = { const_id: constId, user_id: user.id, user_name: user.name, acquired_at: new Date().toISOString() };
    const key = keyFor(electionId, constId);
    const value = JSON.stringify(lock);

    if (takeOver) {
      const previous = parse(await this.redis.forceSet(key, value, SEAT_LOCK_TTL_SECONDS));
      if (previous && previous.user_id !== user.id) {
        await this.audit.create({
          userId: user.id, action: 'SEAT_LOCK_TAKEOVER', entityType: 'constituency', entityId: constId,
          oldValue: previous, newValue: lock,
        });
      }
    } else {
      const holder = await this.redis.acquireOwned(key, user.id, value, SEAT_LOCK_TTL_SECONDS);
      if (holder !== null) throw new SeatLockedException((parse(holder) ?? {}) as unknown as Record<string, unknown>);
    }

    await this.live.publish(electionId, { type: 'seat-lock', data: { const_id: constId, lock } });
    return lock;
  }

  async release(electionId: string, constId: string, userId: string): Promise<void> {
    this.ensureReady();
    if (await this.redis.releaseOwned(keyFor(electionId, constId), userId)) {
      await this.live.publish(electionId, { type: 'seat-lock', data: { const_id: constId, lock: null } });
    }
  }
}
```

Check `ConstituencyNotFoundException`'s constructor signature in `backend/src/common/exceptions/constituency.exception.ts`. If it does not take an id string, pass whatever it expects. It must produce a 404.

Heartbeats publish `seat-lock` on every refresh (every 45 s per open editor). That is acceptable at admin scale, and it keeps the client lock map self-healing.

- [ ] **Step 6: Run the service test to confirm it passes**

Run: `cd backend && npx jest src/modules/live/seat-lock.service.spec.ts`
Expected: PASS (7 tests).

- [ ] **Step 7: Controller** `backend/src/modules/live/seat-lock.controller.ts`

```ts
import { Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SeatLockService } from './seat-lock.service';
import { SeatLockAcquire, SeatLockQuery, SeatLockRelease } from './dto/seat-lock.dto';

type AuthedReq = { user: { id: string; name: string } };

@Controller('admin/live/locks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'EDITOR')
export class SeatLockController {
  constructor(private readonly locks: SeatLockService) {}

  @Get()
  list(@Query() q: SeatLockQuery) {
    return this.locks.list(q.election_id);
  }

  @Post()
  @HttpCode(200)
  acquire(@Req() req: AuthedReq, @Body() body: SeatLockAcquire) {
    return this.locks.acquire(body.election_id, body.const_id, req.user, !!body.take_over);
  }

  @Post('release')
  @HttpCode(204)
  release(@Req() req: AuthedReq, @Body() body: SeatLockRelease) {
    return this.locks.release(body.election_id, body.const_id, req.user.id);
  }
}
```

- [ ] **Step 8: Register the controller and service.** In `live.module.ts`:
  - add `PrismaModule` to `imports` if `PrismaService` is not global. Check `backend/src/modules/prisma/prisma.module.ts` for `@Global()`.
  - add `SeatLockController` to `controllers`
  - add `SeatLockService` to `providers`

- [ ] **Step 9: Run the full backend suite and the type check**

Run: `cd backend && npm test && npx tsc --noEmit -p tsconfig.json`
Expected: all PASS, no type errors.

- [ ] **Step 10: Manual smoke test** (backend running and Redis up, with `TOKEN` from an admin login):

```bash
curl -s -X POST localhost:3082/api/v1/admin/live/locks -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"election_id":"<eid>","const_id":"<cid>"}'
curl -s "localhost:3082/api/v1/admin/live/locks?election_id=<eid>" -H "Authorization: Bearer $TOKEN"
```

Expected: the first call returns the lock, and the second returns a list containing it.

- [ ] **Step 11: Commit**

```bash
git add backend/src/modules/live backend/src/common/exceptions
git commit -m "backend: soft seat locks for the Live Console (Redis, SSE seat-lock event, take-over audit)"
```

---

### Task 6: Admin: pure seat math

**Files:**
- Create: `admin/src/utils/seat-math.ts`
- Test: `admin/src/utils/seat-math.test.ts`
- Modify: `admin/src/types/index.ts`

**Interfaces:**
- Consumes: `OVERRIDE_STATUSES`, `OverrideStatus` from `admin/src/utils/override-validation.ts`.
- Produces:
  - `type SeatRow = { result_id: string; candidate_id: string; candidate_name: string; party_id: string; party_abbr: string | null; party_color: string | null; votes: number; status: OverrideStatus }`
  - `isNota(row): boolean`
  - `parseVotes(raw: string): number | null`
  - `rankSeat(rows: SeatRow[]): { leader: SeatRow | null; runnerUp: SeatRow | null; tie: boolean }`
  - `seatMargin(rows): number`
  - `deriveStatuses(rows, declared: boolean): SeatRow[]`
  - `buildSeatOverrides(rows): BulkOverrideItem[]`
  - `type BulkOverrideItem = { result_id: string; votes: number; status: OverrideStatus; margin: number }`
  - `seatStatus(c: LiveConstituency): 'PENDING' | 'LEADING' | 'WON'`
- Types: `LiveConstituency` gains `current_round: number | null; total_rounds: number | null`. Add `SeatLock` (same shape as the backend).

- [ ] **Step 1: Extend the types.** In `admin/src/types/index.ts`, add to `LiveConstituency`:

```ts
  current_round: number | null;
  total_rounds: number | null;
```

and add:

```ts
export interface SeatLock {
  const_id: string;
  user_id: string;
  user_name: string;
  acquired_at: string;
}
```

- [ ] **Step 2: Write the failing test** `admin/src/utils/seat-math.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { parseVotes, rankSeat, seatMargin, deriveStatuses, buildSeatOverrides, seatStatus, type SeatRow } from './seat-math';

const row = (id: string, votes: number, party = id.toUpperCase(), status: SeatRow['status'] = 'TRAILING'): SeatRow => ({
  result_id: id, candidate_id: `c-${id}`, candidate_name: id, party_id: party, party_abbr: party, party_color: null, votes, status,
});

describe('parseVotes', () => {
  it.each([['61,204', 61204], [' 61204 ', 61204], ['0', 0], ['1 20 000', 120000]])('%s → %s', (raw, n) => {
    expect(parseVotes(raw)).toBe(n);
  });
  it.each(['', '61.2', '-5', 'abc', '1e5'])('rejects %s', (raw) => {
    expect(parseVotes(raw)).toBeNull();
  });
});

describe('rankSeat / seatMargin', () => {
  it('leader and runner-up by votes', () => {
    const r = rankSeat([row('b', 48990), row('a', 61204), row('c', 9310)]);
    expect(r.leader?.result_id).toBe('a');
    expect(r.runnerUp?.result_id).toBe('b');
    expect(r.tie).toBe(false);
    expect(seatMargin([row('b', 48990), row('a', 61204)])).toBe(12214);
  });
  it('NOTA is never the leader', () => {
    const r = rankSeat([row('n', 9000, 'NOTA'), row('a', 100)]);
    expect(r.leader?.result_id).toBe('a');
  });
  it('tie at the top → no leader', () => {
    const r = rankSeat([row('a', 100), row('b', 100)]);
    expect(r.leader).toBeNull();
    expect(r.tie).toBe(true);
    expect(seatMargin([row('a', 100), row('b', 100)])).toBe(0);
  });
  it('all zero → no leader', () => {
    expect(rankSeat([row('a', 0), row('b', 0)]).leader).toBeNull();
  });
  it('single candidate margin = own votes', () => {
    expect(seatMargin([row('a', 50)])).toBe(50);
  });
});

describe('deriveStatuses', () => {
  it('counting: leader LEADING, others and NOTA TRAILING', () => {
    const out = deriveStatuses([row('a', 10), row('b', 5), row('n', 99, 'NOTA')], false);
    expect(out.map((r) => r.status)).toEqual(['LEADING', 'TRAILING', 'TRAILING']);
  });
  it('declared: leader WON, others LOST', () => {
    const out = deriveStatuses([row('a', 10), row('b', 5)], true);
    expect(out.map((r) => r.status)).toEqual(['WON', 'LOST']);
  });
  it('tie: everyone TRAILING even if declared requested', () => {
    expect(deriveStatuses([row('a', 5), row('b', 5)], true).map((r) => r.status)).toEqual(['TRAILING', 'TRAILING']);
  });
});

describe('buildSeatOverrides', () => {
  it('margin convention: leader lead over runner-up, others gap to leader', () => {
    const items = buildSeatOverrides([row('a', 61204, 'BJP', 'LEADING'), row('b', 48990), row('n', 1120, 'NOTA')]);
    expect(items).toEqual([
      { result_id: 'a', votes: 61204, status: 'LEADING', margin: 12214 },
      { result_id: 'b', votes: 48990, status: 'TRAILING', margin: 12214 },
      { result_id: 'n', votes: 1120, status: 'TRAILING', margin: 60084 },
    ]);
  });
  it('no leader → every margin 0', () => {
    expect(buildSeatOverrides([row('a', 0), row('b', 0)]).map((i) => i.margin)).toEqual([0, 0]);
  });
});

describe('seatStatus', () => {
  const base = { const_id: 'c', const_name: 'X', const_no: 1, const_type: 'GEN', current_round: null, total_rounds: null };
  const cand = (status: string, votes: number) => ({ result_id: 'r', candidate_id: 'c', candidate_name: 'n', party_id: 'P', party_name: 'P', party_color: null, party_abbr: 'P', votes, status, margin: 0, last_updated: '' });
  it('PENDING when no votes', () => expect(seatStatus({ ...base, candidates: [cand('TRAILING', 0)] })).toBe('PENDING'));
  it('WON when any candidate WON', () => expect(seatStatus({ ...base, candidates: [cand('WON', 5)] })).toBe('WON'));
  it('LEADING otherwise', () => expect(seatStatus({ ...base, candidates: [cand('LEADING', 5)] })).toBe('LEADING'));
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/utils/seat-math.test.ts`
Expected: FAIL with "Failed to resolve import './seat-math'".

- [ ] **Step 4: Implement** `admin/src/utils/seat-math.ts`

```ts
/**
 * PURE UTILITY: Live Console seat math.
 * Margin convention matches scraper/src/simulation: the leader's margin is its lead over
 * the runner-up; every other candidate's margin is its gap to the leader (always >= 0).
 * NOTA (party_id 'NOTA') is never the leader.
 */
import type { LiveConstituency } from '../types';
import type { OverrideStatus } from './override-validation';

export interface SeatRow {
  result_id: string;
  candidate_id: string;
  candidate_name: string;
  party_id: string;
  party_abbr: string | null;
  party_color: string | null;
  votes: number;
  status: OverrideStatus;
}

export interface BulkOverrideItem {
  result_id: string;
  votes: number;
  status: OverrideStatus;
  margin: number;
}

export const isNota = (r: Pick<SeatRow, 'party_id'>) => r.party_id === 'NOTA';

/** "61,204" / " 61204 " / "1 20 000" → number; anything not a whole number ≥ 0 → null. */
export function parseVotes(raw: string): number | null {
  const cleaned = raw.replace(/[\s,]/g, '');
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

export function rankSeat(rows: SeatRow[]): { leader: SeatRow | null; runnerUp: SeatRow | null; tie: boolean } {
  const ranked = rows.filter((r) => !isNota(r)).sort((a, b) => b.votes - a.votes);
  const [first, second] = ranked;
  if (!first || first.votes === 0) return { leader: null, runnerUp: second ?? null, tie: false };
  if (second && second.votes === first.votes) return { leader: null, runnerUp: null, tie: true };
  return { leader: first, runnerUp: second ?? null, tie: false };
}

export function seatMargin(rows: SeatRow[]): number {
  const { leader, runnerUp } = rankSeat(rows);
  if (!leader) return 0;
  return leader.votes - (runnerUp?.votes ?? 0);
}

/** Statuses implied by the votes. `declared` turns LEADING/TRAILING into WON/LOST. */
export function deriveStatuses(rows: SeatRow[], declared: boolean): SeatRow[] {
  const { leader } = rankSeat(rows);
  return rows.map((r) => {
    const isLeader = leader !== null && r.result_id === leader.result_id;
    const status: OverrideStatus = isLeader ? (declared ? 'WON' : 'LEADING') : declared && leader ? 'LOST' : 'TRAILING';
    return { ...r, status };
  });
}

/** One bulk-override item per candidate, with margins per the convention above. */
export function buildSeatOverrides(rows: SeatRow[]): BulkOverrideItem[] {
  const { leader } = rankSeat(rows);
  const lead = seatMargin(rows);
  return rows.map((r) => ({
    result_id: r.result_id,
    votes: r.votes,
    status: r.status,
    // Clamp: a NOTA row can out-poll the leader, and the bulk endpoint rejects negative margins.
    margin: !leader ? 0 : r.result_id === leader.result_id ? lead : Math.max(0, leader.votes - r.votes),
  }));
}

/** Seat-level status for the list and the filter chips. */
export function seatStatus(c: LiveConstituency): 'PENDING' | 'LEADING' | 'WON' {
  if (c.candidates.some((x) => x.status === 'WON')) return 'WON';
  if (c.candidates.every((x) => x.votes === 0)) return 'PENDING';
  return 'LEADING';
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/utils/seat-math.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add admin/src/utils/seat-math.ts admin/src/utils/seat-math.test.ts admin/src/types/index.ts
git commit -m "admin: pure seat math (votes parsing, leader, margins, statuses)"
```

---

### Task 7: Admin: live service additions (bulk save, locks, SSE seat-lock + status)

**Files:**
- Modify: `admin/src/services/election.service.ts`
- Test: `admin/src/services/live-service.test.ts` (create)

**Interfaces:**
- Consumes: `apiFetch`, `ApiError` (`admin/src/services/api-client.ts`), `BulkOverrideItem` (Task 6), `SeatLock` (Task 6).
- Produces:
  - `bulkOverride(electionId: string, overrides: BulkOverrideItem[], rounds?: Record<string, { current_round?: number; total_rounds?: number }>): Promise<{ updated: number }>`
  - `getSeatLocks(electionId): Promise<SeatLock[]>`
  - `acquireSeatLock(electionId, constId, takeOver = false): Promise<SeatLock>` (throws `ApiError`: status 409 carries `details.lock`, status 503 means unavailable)
  - `releaseSeatLock(electionId, constId, opts?: { keepalive?: boolean }): Promise<void>`
  - `LiveUpdateHandlers` gains `onSeatLock?: (e: { const_id: string; lock: SeatLock | null }) => void` and `onStatus?: (s: 'connecting' | 'open' | 'reconnecting') => void`.

- [ ] **Step 1: Write the failing test** `admin/src/services/live-service.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { bulkOverride, acquireSeatLock, releaseSeatLock } from './election.service';
import { ApiError } from './api-client';

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const fn = vi.fn(async () => ({ ok: status < 400, status, statusText: '', json: async () => body }));
  vi.stubGlobal('fetch', fn);
  return fn;
}
afterEach(() => vi.unstubAllGlobals());

describe('live service', () => {
  it('bulkOverride posts election, overrides and rounds', async () => {
    const fn = mockFetch(200, { success: true, data: { updated: 2 } });
    await expect(bulkOverride('e1', [{ result_id: 'r1', votes: 5, status: 'LEADING', margin: 5 }], { c1: { current_round: 4, total_rounds: 24 } }))
      .resolves.toEqual({ updated: 2 });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/admin\/results\/override-bulk$/);
    expect(JSON.parse(init.body as string)).toEqual({
      election_id: 'e1', overrides: [{ result_id: 'r1', votes: 5, status: 'LEADING', margin: 5 }], rounds: { c1: { current_round: 4, total_rounds: 24 } },
    });
  });

  it('acquireSeatLock surfaces the holder on 409', async () => {
    mockFetch(409, { success: false, error: { code: 'RESULT_6002', message: 'Seat is being edited by someone else', details: { lock: { user_name: 'Priya S' } } } });
    const err = await acquireSeatLock('e1', 'c1').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.details.lock.user_name).toBe('Priya S');
  });

  it('releaseSeatLock can use keepalive', async () => {
    const fn = mockFetch(204, {});
    await releaseSeatLock('e1', 'c1', { keepalive: true });
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/admin\/live\/locks\/release$/);
    expect(init.keepalive).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/services/live-service.test.ts`
Expected: FAIL with "bulkOverride is not exported".

- [ ] **Step 3: Implement.** In `election.service.ts`, extend the types import with `SeatLock`, then add:

```ts
import type { BulkOverrideItem } from '../utils/seat-math';

export function bulkOverride(
  electionId: string,
  overrides: BulkOverrideItem[],
  rounds?: Record<string, { current_round?: number; total_rounds?: number }>,
) {
  return apiFetch<{ updated: number }>('/admin/results/override-bulk', {
    method: 'POST',
    body: JSON.stringify({ election_id: electionId, overrides, ...(rounds ? { rounds } : {}) }),
  });
}

export async function getSeatLocks(electionId: string) {
  return (await apiFetch<SeatLock[]>(`/admin/live/locks?election_id=${encodeURIComponent(electionId)}`)) || [];
}

export function acquireSeatLock(electionId: string, constId: string, takeOver = false) {
  return apiFetch<SeatLock>('/admin/live/locks', {
    method: 'POST',
    body: JSON.stringify({ election_id: electionId, const_id: constId, ...(takeOver ? { take_over: true } : {}) }),
  });
}

/** keepalive lets the release survive the tab closing (sendBeacon cannot send the auth header). */
export async function releaseSeatLock(electionId: string, constId: string, opts?: { keepalive?: boolean }) {
  await apiFetch<void>('/admin/live/locks/release', {
    method: 'POST',
    keepalive: opts?.keepalive,
    body: JSON.stringify({ election_id: electionId, const_id: constId }),
  });
}
```

A 204 response has no JSON body. `apiFetch` already tolerates that (`.json().catch(...)`), so no change is needed there.

Extend `LiveUpdateHandlers`:

```ts
  /** Another editor took, refreshed or released a seat lock. */
  onSeatLock?: (event: { const_id: string; lock: SeatLock | null }) => void;
  /** Stream state for the top-bar pill. */
  onStatus?: (status: 'connecting' | 'open' | 'reconnecting') => void;
```

Inside `subscribeLiveUpdates`:
- call `handlers.onStatus?.('connecting')` at the start of `connect()`
- call `handlers.onStatus?.('open')` in `source.onopen`
- call `handlers.onStatus?.('reconnecting')` in `source.onerror` before `retry()`
- after the `batch-update` listener, add:

```ts
    source.addEventListener('seat-lock', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        if (data?.const_id) handlers.onSeatLock?.({ const_id: data.const_id, lock: data.lock ?? null });
      } catch { /* malformed frame */ }
    });
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `cd admin && npx vitest run src/services`
Expected: PASS (new and existing).

- [ ] **Step 5: Commit**

```bash
git add admin/src/services
git commit -m "admin: bulk save, seat lock API, seat-lock/status SSE handlers"
```

---

### Task 8: Admin: ElectionContext (global election picker state)

**Files:**
- Create: `admin/src/context/ElectionContext.tsx`
- Test: `admin/src/context/ElectionContext.test.tsx`

**Interfaces:**
- Consumes: `getElections()` (`election.service.ts`), `useSearchParams` (react-router).
- Produces:
  - `<ElectionProvider>` (must render inside the Router)
  - `useElection(): { elections: Election[]; electionId: string; election: Election | null; setElectionId(id: string): void; loading: boolean }`
  - `pickInitialElection(elections, fromUrl, fromStorage): string`
  - `ELECTION_STORAGE_KEY = 'mp.admin.election'`
- Selection rule: a URL `?election=` that exists, otherwise the stored id that exists, otherwise the first `Live` election, otherwise the first election, otherwise `''`.

- [ ] **Step 1: Write the failing test** `admin/src/context/ElectionContext.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ElectionProvider, useElection, pickInitialElection, ELECTION_STORAGE_KEY } from './ElectionContext';
import type { Election } from '../types';

const e = (id: string, status: Election['status'] = 'Finalized'): Election => ({
  id, name: id, type: 'VS', state_id: 1, year: 2025, status, tentative_next_date: null, manifest_url: null,
});

vi.mock('../services/election.service', () => ({ getElections: vi.fn(async () => [e('a'), e('b', 'Live')]) }));

afterEach(() => { cleanup(); localStorage.clear(); });

describe('pickInitialElection', () => {
  const list = [e('a'), e('b', 'Live')];
  it('URL wins when valid', () => expect(pickInitialElection(list, 'a', 'b')).toBe('a'));
  it('then storage', () => expect(pickInitialElection(list, 'zzz', 'a')).toBe('a'));
  it('then first Live', () => expect(pickInitialElection(list, null, null)).toBe('b'));
  it('then first', () => expect(pickInitialElection([e('a')], null, null)).toBe('a'));
  it('empty list → empty', () => expect(pickInitialElection([], null, null)).toBe(''));
});

function Probe() {
  const { electionId, setElectionId } = useElection();
  return <><span data-testid="id">{electionId}</span><button onClick={() => setElectionId('a')}>pick a</button></>;
}

describe('ElectionProvider', () => {
  it('defaults to the live election and persists a change', async () => {
    render(<MemoryRouter><ElectionProvider><Probe /></ElectionProvider></MemoryRouter>);
    await waitFor(() => expect(screen.getByTestId('id').textContent).toBe('b'));
    act(() => screen.getByText('pick a').click());
    expect(screen.getByTestId('id').textContent).toBe('a');
    expect(localStorage.getItem(ELECTION_STORAGE_KEY)).toBe('a');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/context/ElectionContext.test.tsx`
Expected: FAIL with "Failed to resolve import './ElectionContext'".

- [ ] **Step 3: Implement** `admin/src/context/ElectionContext.tsx`

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getElections } from '../services/election.service';
import type { Election } from '../types';

export const ELECTION_STORAGE_KEY = 'mp.admin.election';

interface ElectionContextValue {
  elections: Election[];
  electionId: string;
  election: Election | null;
  setElectionId: (id: string) => void;
  loading: boolean;
}

const Ctx = createContext<ElectionContextValue | null>(null);

function readStorage(): string | null {
  try { return localStorage.getItem(ELECTION_STORAGE_KEY); } catch { return null; }
}
function writeStorage(id: string) {
  try { localStorage.setItem(ELECTION_STORAGE_KEY, id); } catch { /* private mode */ }
}

export function pickInitialElection(elections: Election[], fromUrl: string | null, fromStorage: string | null): string {
  const has = (id: string | null): id is string => !!id && elections.some((e) => e.id === id);
  if (has(fromUrl)) return fromUrl;
  if (has(fromStorage)) return fromStorage;
  return elections.find((e) => e.status === 'Live')?.id ?? elections[0]?.id ?? '';
}

/** One election selection shared by every page (top-bar picker), synced to ?election= and localStorage. */
export function ElectionProvider({ children }: { children: ReactNode }) {
  const [params, setParams] = useSearchParams();
  const [elections, setElections] = useState<Election[]>([]);
  const [electionId, setId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getElections()
      .then((all) => {
        if (cancelled) return;
        setElections(all);
        setId(pickInitialElection(all, params.get('election'), readStorage()));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once; URL changes go through setElectionId
  }, []);

  const setElectionId = useCallback((id: string) => {
    setId(id);
    writeStorage(id);
    setParams((prev) => { const next = new URLSearchParams(prev); next.set('election', id); return next; }, { replace: true });
  }, [setParams]);

  const value = useMemo<ElectionContextValue>(() => ({
    elections, electionId, setElectionId, loading,
    election: elections.find((e) => e.id === electionId) ?? null,
  }), [elections, electionId, setElectionId, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useElection(): ElectionContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useElection must be used inside <ElectionProvider>');
  return v;
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/context/ElectionContext.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add admin/src/context/ElectionContext.tsx admin/src/context/ElectionContext.test.tsx
git commit -m "admin: global ElectionContext synced to URL + localStorage"
```

---

### Task 9: Admin: new shell (grouped sidebar, top bar, picker, health, shortcuts)

**Files:**
- Create: `admin/src/context/ShellStatusContext.tsx`, `admin/src/components/shell/{Sidebar.tsx,TopBar.tsx,ElectionPicker.tsx,HealthDot.tsx,ShortcutsDialog.tsx}`
- Modify: `admin/src/utils/navigation.config.ts`, `admin/src/components/Layout.tsx`
- Test: `admin/src/components/shell/shell.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (`{ user, logout, hasRole }`), `useElection()` (Task 8), `Button`/`Kbd`/`cn` (Tasks 1–2), `API_BASE_URL` (`api-client.ts`).
- Produces:
  - `NAV_GROUPS: { label: 'Counting' | 'Data' | 'Admin'; items: NavItem[] }[]`, where `NavItem.icon` is a `LucideIcon`
  - `<ShellStatusProvider>` + `useShellStatus(): { live: 'idle' | 'connecting' | 'open' | 'reconnecting'; setLive(s): void }`. `useLiveConsole` (Task 12) calls `setLive`.
  - `Layout` renders `<ElectionProvider><ShellStatusProvider>` around the sidebar + top bar + `<Outlet/>`.

- [ ] **Step 1: Write the failing test** `admin/src/components/shell/shell.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from './Sidebar';

const auth = { user: { id: 'u', name: 'Mannu K', role: 'EDITOR', email: 'x' }, logout: vi.fn(), hasRole: (r: string) => r === 'EDITOR' };
vi.mock('../../context/AuthContext', () => ({ useAuth: () => auth }));
afterEach(cleanup);

describe('Sidebar', () => {
  it('groups items under sentence-case headings and hides SUPER_ADMIN items for editors', () => {
    render(<MemoryRouter initialEntries={['/overrides']}><Sidebar /></MemoryRouter>);
    expect(screen.getByText('Counting')).toBeTruthy();
    expect(screen.getByText('Data')).toBeTruthy();
    expect(screen.queryByText('Users')).toBeNull();
    expect(screen.queryByText('Audit logs')).toBeNull();
    expect(screen.getByRole('link', { name: /Live console/ }).getAttribute('aria-current')).toBe('page');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/components/shell/shell.test.tsx`
Expected: FAIL with "Failed to resolve import './Sidebar'".

- [ ] **Step 3: Replace the nav schema** `admin/src/utils/navigation.config.ts`

```ts
import {
  LayoutDashboard, Radio, Vote, FileCog, Flag, Users, UserRound, Map, MessageSquare, UserCog, History, Activity,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  roles: string[];
}

export interface NavGroup {
  label: 'Counting' | 'Data' | 'Admin';
  items: NavItem[];
}

const EDIT = ['SUPER_ADMIN', 'EDITOR'];
const SUPER = ['SUPER_ADMIN'];

/** MODEL: navigation structure + access rules (sidebar groups). */
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Counting', items: [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, roles: [] },
    { path: '/overrides', label: 'Live console', icon: Radio, roles: EDIT },
  ] },
  { label: 'Data', items: [
    { path: '/elections', label: 'Elections', icon: Vote, roles: EDIT },
    { path: '/manifests', label: 'Manifests', icon: FileCog, roles: EDIT },
    { path: '/parties', label: 'Parties', icon: Flag, roles: EDIT },
    { path: '/candidates', label: 'Candidates', icon: Users, roles: EDIT },
    { path: '/persons', label: 'Persons', icon: UserRound, roles: EDIT },
    { path: '/constituencies', label: 'Constituencies', icon: Map, roles: EDIT },
  ] },
  { label: 'Admin', items: [
    { path: '/feedback', label: 'Feedback', icon: MessageSquare, roles: EDIT },
    { path: '/users', label: 'Users', icon: UserCog, roles: SUPER },
    { path: '/logs', label: 'Audit logs', icon: History, roles: SUPER },
    { path: '/status', label: 'System status', icon: Activity, roles: SUPER },
  ] },
];
```

Search for other users of `NAV_SCHEMA` (`grep -rn NAV_SCHEMA admin/src`). Only `Layout.tsx` should use it, and it gets replaced below.

- [ ] **Step 4: Create `admin/src/context/ShellStatusContext.tsx`**

```tsx
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type LiveStreamState = 'idle' | 'connecting' | 'open' | 'reconnecting';
interface ShellStatus { live: LiveStreamState; setLive: (s: LiveStreamState) => void }

const Ctx = createContext<ShellStatus>({ live: 'idle', setLive: () => {} });

/** Lets the Live Console report its SSE state to the top-bar pill. */
export function ShellStatusProvider({ children }: { children: ReactNode }) {
  const [live, setLive] = useState<LiveStreamState>('idle');
  const value = useMemo(() => ({ live, setLive }), [live]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useShellStatus = () => useContext(Ctx);
```

- [ ] **Step 5: Create `Sidebar.tsx`**

```tsx
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { NAV_GROUPS } from '../../utils/navigation.config';
import { cn } from '../ui/cn';

export function Sidebar() {
  const { hasRole } = useAuth();
  const { pathname } = useLocation();
  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-ink">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        <img src="/logo-mark.png" alt="" aria-hidden className="h-8 w-8 rounded-control" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">MatdaanPulse Admin</div>
          <div className="text-[11px] text-muted">Election results hub</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => i.roles.length === 0 || i.roles.some((r) => hasRole(r)));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              <div className="px-3 pb-1.5 text-[11px] font-medium text-muted">{group.label}</div>
              {items.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  aria-current={isActive(path) ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors',
                    isActive(path) ? 'bg-accent text-white' : 'hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 6: Create `ElectionPicker.tsx`** (Radix Select)

```tsx
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useElection } from '../../context/ElectionContext';

/** Short label for the top bar: "Bihar VS 2025". */
export function shortElectionName(name: string, type: string, year: number): string {
  const base = name.replace(/\b(Vidhan Sabha|Lok Sabha|Assembly|General)\b.*$/i, '').trim();
  return `${base || name} ${type} ${year}`.trim();
}

export function ElectionPicker() {
  const { elections, electionId, setElectionId } = useElection();
  if (elections.length === 0) return null;
  return (
    <Select.Root value={electionId} onValueChange={setElectionId}>
      <Select.Trigger aria-label="Election" className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-subtle px-3 text-xs font-medium text-ink whitespace-nowrap hover:bg-line/50">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
        <Select.Value />
        <Select.Icon><ChevronDown size={14} className="text-muted" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="z-50 max-h-80 overflow-hidden rounded-card border border-line bg-card shadow-lg">
          <Select.Viewport className="p-1">
            {elections.map((e) => (
              <Select.Item key={e.id} value={e.id} className="flex cursor-pointer items-center justify-between gap-6 rounded-control px-2.5 py-1.5 text-xs text-ink outline-none data-[highlighted]:bg-accent-soft">
                <Select.ItemText>{shortElectionName(e.name, e.type, e.year)}</Select.ItemText>
                <span className="flex items-center gap-2 text-muted">
                  {e.status === 'Live' && <span className="text-ok-text">Live</span>}
                  <Select.ItemIndicator><Check size={12} /></Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
```

- [ ] **Step 7: Create `HealthDot.tsx`.** It polls `/health/ready` every 30 s. The endpoint is public; a 503 response means degraded.

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE_URL } from '../../services/api-client';
import { cn } from '../ui/cn';

type Health = 'unknown' | 'ok' | 'degraded';
const POLL_MS = 30_000;

export function HealthDot({ canOpenStatus }: { canOpenStatus: boolean }) {
  const [health, setHealth] = useState<Health>('unknown');
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
  const dot = <span title={label} aria-label={label} className={cn('inline-block h-2.5 w-2.5 rounded-full', health === 'ok' ? 'bg-ok' : health === 'degraded' ? 'bg-bad' : 'bg-muted')} />;
  return canOpenStatus ? <Link to="/status" className="p-1">{dot}</Link> : <span className="p-1">{dot}</span>;
}
```

- [ ] **Step 8: Create `ShortcutsDialog.tsx`**

```tsx
import * as Dialog from '@radix-ui/react-dialog';
import { CircleHelp, X } from 'lucide-react';
import { Kbd } from '../ui/Kbd';

const SHORTCUTS: [string[], string][] = [
  [['↑', '↓'], 'Move between seats (Live console)'],
  [['Enter'], 'Save seat'],
  [['Esc'], 'Discard edits'],
  [['/'], 'Jump to seat search'],
];

export function ShortcutsDialog() {
  return (
    <Dialog.Root>
      <Dialog.Trigger aria-label="Keyboard shortcuts" className="rounded-control p-1 text-ink-2 hover:bg-subtle hover:text-ink">
        <CircleHelp size={18} />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-panel border border-line bg-card p-6 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-base font-semibold text-ink">Keyboard shortcuts</Dialog.Title>
            <Dialog.Close aria-label="Close" className="text-muted hover:text-ink"><X size={16} /></Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">Shortcuts available in the admin panel</Dialog.Description>
          <ul className="space-y-2.5 text-sm text-ink-2">
            {SHORTCUTS.map(([keys, what]) => (
              <li key={what} className="flex items-center justify-between gap-4">
                <span>{what}</span>
                <span className="flex gap-1">{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</span>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 9: Create `TopBar.tsx`**

```tsx
import * as Menu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '../../context/AuthContext';
import { useShellStatus } from '../../context/ShellStatusContext';
import { ElectionPicker } from './ElectionPicker';
import { HealthDot } from './HealthDot';
import { ShortcutsDialog } from './ShortcutsDialog';
import { cn } from '../ui/cn';

const LIVE_PILL = {
  open: { text: 'Live updates on', cls: 'bg-ok-soft text-ok-text border-ok/30', dot: 'bg-ok' },
  connecting: { text: 'Connecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
  reconnecting: { text: 'Reconnecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
} as const;

export function TopBar() {
  const { user, logout, hasRole } = useAuth();
  const { live } = useShellStatus();
  const initials = (user?.name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const pill = live === 'idle' ? null : LIVE_PILL[live];

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-card px-6">
      <div className="flex items-center gap-3">
        <ElectionPicker />
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
            <Menu.Content align="end" sideOffset={6} className="z-50 min-w-44 rounded-card border border-line bg-card p-1 shadow-lg">
              <div className="px-2.5 py-1.5 text-[11px] text-muted">{user?.role.replace('_', ' ').toLowerCase()}</div>
              <Menu.Item onSelect={logout} className="cursor-pointer rounded-control px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-subtle">
                Log out
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  );
}
```

- [ ] **Step 10: Replace `admin/src/components/Layout.tsx`**

```tsx
import { Outlet } from 'react-router-dom';
import { ElectionProvider } from '../context/ElectionContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { Sidebar } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';

/** VIEW: admin shell — grouped sidebar, top bar with global election picker, page outlet. */
export default function Layout() {
  return (
    <ElectionProvider>
      <ShellStatusProvider>
        <div className="flex h-screen bg-page font-sans text-ink">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="admin-content min-h-0 flex-1 overflow-y-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </ShellStatusProvider>
    </ElectionProvider>
  );
}
```

`admin-content` is kept so the legacy page CSS that targets it still applies. Check `admin.css` for `.admin-layout` / `.admin-sidebar` rules; they become dead code, and Phase 3 deletes them.

- [ ] **Step 11: Run the tests and the build**

Run: `cd admin && npm test && npm run build`
Expected: PASS, and the build succeeds.

- [ ] **Step 12: Manual check.** Run `npm run dev` and log in, then confirm:
  - the grouped sidebar appears, with Users / Audit logs / System status shown only for a super admin
  - the picker lists elections and survives a reload
  - the health dot is green
  - **?** opens the shortcuts dialog
  - the old pages still render inside the new shell

- [ ] **Step 13: Commit**

```bash
git add admin/src/components/shell admin/src/components/Layout.tsx admin/src/context/ShellStatusContext.tsx admin/src/utils/navigation.config.ts
git commit -m "admin: new shell — grouped sidebar, top bar, global election picker, health dot, shortcuts"
```

---

### Task 10: Admin: useSeatEditor (draft state that survives reloads)

**Files:**
- Create: `admin/src/hooks/useSeatEditor.ts`
- Test: `admin/src/hooks/useSeatEditor.test.ts`

**Interfaces:**
- Consumes: `SeatRow`, `parseVotes`, `deriveStatuses`, `rankSeat`, `seatMargin`, `buildSeatOverrides`, `BulkOverrideItem` (Task 6), `LiveConstituency` (types).
- Produces: `useSeatEditor(seat: LiveConstituency | null)` →

```ts
{
  rows: Array<SeatRow & { draftVotes: string; error: string | null }>;
  round: { current: string; total: string };
  dirty: boolean;
  changedElsewhere: boolean;     // server data for this seat changed while dirty
  declared: boolean;             // seat already has a WON on the server
  leaderId: string | null; tie: boolean; margin: number; totalVotes: number;
  setVotes(resultId: string, raw: string): void;
  setStatus(resultId: string, status: OverrideStatus): void;
  setRound(field: 'current' | 'total', raw: string): void;
  discard(): void;               // back to server values, clears changedElsewhere
  build(declare: boolean): { ok: true; overrides: BulkOverrideItem[]; rounds?: { current_round?: number; total_rounds?: number } } | { ok: false; error: string };
}
```

- Behaviour:
  - Rows reset from the server only when the seat id changes, or when the server data changes and the editor is **not** dirty.
  - Editing votes re-derives statuses unless the user picked a status by hand (`statusTouched`).
  - `build(true)` applies `deriveStatuses(rows, true)`.

- [ ] **Step 1: Write the failing test** `admin/src/hooks/useSeatEditor.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSeatEditor } from './useSeatEditor';
import type { LiveConstituency } from '../types';

const cand = (id: string, votes: number, status = 'TRAILING', party = id.toUpperCase()) => ({
  result_id: id, candidate_id: `c-${id}`, candidate_name: id, party_id: party, party_name: party, party_color: null, party_abbr: party,
  votes, status, margin: 0, last_updated: '',
});
const seat = (over: Partial<LiveConstituency> = {}): LiveConstituency => ({
  const_id: 's1', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24,
  candidates: [cand('a', 100, 'LEADING'), cand('b', 80)], ...over,
});

describe('useSeatEditor', () => {
  it('re-derives statuses and margin as votes change', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setVotes('b', '120'));
    expect(result.current.leaderId).toBe('b');
    expect(result.current.rows.find((r) => r.result_id === 'b')?.status).toBe('LEADING');
    expect(result.current.margin).toBe(20);
    expect(result.current.dirty).toBe(true);
  });

  it('keeps edits and flags changedElsewhere when the server data changes while dirty', () => {
    const { result, rerender } = renderHook(({ s }) => useSeatEditor(s), { initialProps: { s: seat() } });
    act(() => result.current.setVotes('a', '150'));
    rerender({ s: seat({ candidates: [cand('a', 110, 'LEADING'), cand('b', 80)] }) });
    expect(result.current.rows.find((r) => r.result_id === 'a')?.draftVotes).toBe('150');
    expect(result.current.changedElsewhere).toBe(true);
    act(() => result.current.discard());
    expect(result.current.rows.find((r) => r.result_id === 'a')?.draftVotes).toBe('110');
    expect(result.current.changedElsewhere).toBe(false);
  });

  it('adopts server data silently when not dirty', () => {
    const { result, rerender } = renderHook(({ s }) => useSeatEditor(s), { initialProps: { s: seat() } });
    rerender({ s: seat({ candidates: [cand('a', 110, 'LEADING'), cand('b', 80)] }) });
    expect(result.current.rows[0].draftVotes).toBe('110');
    expect(result.current.changedElsewhere).toBe(false);
  });

  it('build rejects bad votes inline', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setVotes('a', '61.2'));
    expect(result.current.rows[0].error).toBe('Whole number of 0 or more');
    expect(result.current.build(false)).toEqual({ ok: false, error: 'Fix the highlighted votes' });
  });

  it('build(true) declares the leader WON and others LOST, with rounds', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setRound('current', '24'));
    const out = result.current.build(true);
    expect(out.ok && out.overrides.map((o) => o.status)).toEqual(['WON', 'LOST']);
    expect(out.ok && out.rounds).toEqual({ current_round: 24, total_rounds: 24 });
  });

  it('a manual status pick is kept when votes change', () => {
    const { result } = renderHook(() => useSeatEditor(seat()));
    act(() => result.current.setStatus('b', 'LOST'));
    act(() => result.current.setVotes('a', '101'));
    expect(result.current.rows.find((r) => r.result_id === 'b')?.status).toBe('LOST');
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/hooks/useSeatEditor.test.ts`
Expected: FAIL with "Failed to resolve import './useSeatEditor'".

- [ ] **Step 3: Implement** `admin/src/hooks/useSeatEditor.ts`

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiveConstituency } from '../types';
import type { OverrideStatus } from '../utils/override-validation';
import { buildSeatOverrides, deriveStatuses, parseVotes, rankSeat, seatMargin, type BulkOverrideItem, type SeatRow } from '../utils/seat-math';

type DraftRow = SeatRow & { draftVotes: string };
type BuildResult =
  | { ok: true; overrides: BulkOverrideItem[]; rounds?: { current_round?: number; total_rounds?: number } }
  | { ok: false; error: string };

const VOTE_ERROR = 'Whole number of 0 or more';

function fromServer(seat: LiveConstituency | null): DraftRow[] {
  return (seat?.candidates ?? []).map((c) => ({
    result_id: c.result_id, candidate_id: c.candidate_id, candidate_name: c.candidate_name, party_id: c.party_id,
    party_abbr: c.party_abbr, party_color: c.party_color, votes: c.votes, status: c.status as OverrideStatus,
    draftVotes: String(c.votes),
  }));
}
const roundOf = (s: LiveConstituency | null) => ({ current: s?.current_round?.toString() ?? '', total: s?.total_rounds?.toString() ?? '' });
const fingerprint = (s: LiveConstituency | null) =>
  s ? `${s.const_id}|${s.current_round}|${s.total_rounds}|${s.candidates.map((c) => `${c.result_id}:${c.votes}:${c.status}`).join(',')}` : '';

/** Draft state for the Live Console seat editor. Never loses unsaved edits to a background reload. */
export function useSeatEditor(seat: LiveConstituency | null) {
  const [rows, setRows] = useState<DraftRow[]>(() => fromServer(seat));
  const [round, setRoundState] = useState(() => roundOf(seat));
  const [dirty, setDirty] = useState(false);
  const [statusTouched, setStatusTouched] = useState(false);
  const [changedElsewhere, setChangedElsewhere] = useState(false);
  const seen = useRef({ id: seat?.const_id ?? '', print: fingerprint(seat) });
  const latest = useRef(seat);
  latest.current = seat;

  const reset = useCallback((s: LiveConstituency | null) => {
    setRows(fromServer(s));
    setRoundState(roundOf(s));
    setDirty(false);
    setStatusTouched(false);
    setChangedElsewhere(false);
    seen.current = { id: s?.const_id ?? '', print: fingerprint(s) };
  }, []);

  useEffect(() => {
    const id = seat?.const_id ?? '';
    const print = fingerprint(seat);
    if (id !== seen.current.id) return reset(seat);
    if (print === seen.current.print) return;
    if (dirty) setChangedElsewhere(true);
    else reset(seat);
  }, [seat, dirty, reset]);

  const declared = useMemo(() => (seat?.candidates ?? []).some((c) => c.status === 'WON'), [seat]);

  const setVotes = useCallback((resultId: string, raw: string) => {
    setDirty(true);
    setRows((prev) => {
      const next = prev.map((r) => (r.result_id === resultId ? { ...r, draftVotes: raw, votes: parseVotes(raw) ?? r.votes } : r));
      if (statusTouched) return next;
      const derived = deriveStatuses(next, declared);
      return next.map((r, i) => ({ ...r, status: derived[i].status }));
    });
  }, [statusTouched, declared]);

  const setStatus = useCallback((resultId: string, status: OverrideStatus) => {
    setDirty(true);
    setStatusTouched(true);
    setRows((prev) => prev.map((r) => (r.result_id === resultId ? { ...r, status } : r)));
  }, []);

  const setRound = useCallback((field: 'current' | 'total', raw: string) => {
    setDirty(true);
    setRoundState((prev) => ({ ...prev, [field]: raw }));
  }, []);

  const discard = useCallback(() => reset(latest.current), [reset]);

  const view = useMemo(() => {
    const withErrors = rows.map((r) => ({ ...r, error: parseVotes(r.draftVotes) === null ? VOTE_ERROR : null }));
    const { leader, tie } = rankSeat(rows);
    return {
      rows: withErrors,
      leaderId: leader?.result_id ?? null,
      tie,
      margin: seatMargin(rows),
      totalVotes: rows.reduce((sum, r) => sum + r.votes, 0),
    };
  }, [rows]);

  const build = useCallback((declare: boolean): BuildResult => {
    if (view.rows.some((r) => r.error)) return { ok: false, error: 'Fix the highlighted votes' };
    const parsedRound = { current: round.current.trim(), total: round.total.trim() };
    const cur = parsedRound.current === '' ? undefined : parseVotes(parsedRound.current);
    const tot = parsedRound.total === '' ? undefined : parseVotes(parsedRound.total);
    if (cur === null || tot === null) return { ok: false, error: 'Rounds must be whole numbers' };
    if (cur !== undefined && tot !== undefined && cur > tot) return { ok: false, error: 'Current round cannot exceed total rounds' };
    const finalRows = declare ? deriveStatuses(rows, true) : rows;
    const rounds = cur !== undefined || tot !== undefined ? { current_round: cur, total_rounds: tot } : undefined;
    return { ok: true, overrides: buildSeatOverrides(finalRows), ...(rounds ? { rounds } : {}) };
  }, [view.rows, rows, round]);

  return { ...view, round, dirty, changedElsewhere, declared, setVotes, setStatus, setRound, discard, build };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/hooks/useSeatEditor.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add admin/src/hooks/useSeatEditor.ts admin/src/hooks/useSeatEditor.test.ts
git commit -m "admin: useSeatEditor — draft seat state, auto statuses, survives live reloads"
```

---

### Task 11: Admin: useSeatLock (acquire, heartbeat, release, take-over)

**Files:**
- Create: `admin/src/hooks/useSeatLock.ts`
- Test: `admin/src/hooks/useSeatLock.test.ts`

**Interfaces:**
- Consumes: `acquireSeatLock`, `releaseSeatLock` (Task 7), `ApiError`, `SeatLock`.
- Produces: `useSeatLock(electionId: string, constId: string | null, myUserId: string, remoteLock: SeatLock | null | undefined)` → `{ state: 'idle' | 'acquiring' | 'held' | 'locked' | 'unavailable'; holder: SeatLock | null; takeOver(): Promise<void> }`.
  - `remoteLock` is the current entry for this seat from the console's lock map (fed by SSE). If it becomes someone else's lock while `held`, the state moves to `locked` (we were taken over).
- Constants: `LOCK_HEARTBEAT_MS = 45_000`.
- Behaviour:
  - Acquire when `constId` changes, and release the previous seat.
  - Refresh every 45 s while `held`.
  - Release on unmount and on `pagehide` (keepalive).
  - 409 → `locked` with the holder. 503 or a network failure → `unavailable`, with no retries until the seat changes.

- [ ] **Step 1: Write the failing test** `admin/src/hooks/useSeatLock.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../services/api-client';

const acquire = vi.fn();
const release = vi.fn(async () => {});
vi.mock('../services/election.service', () => ({
  acquireSeatLock: (...a: unknown[]) => acquire(...a),
  releaseSeatLock: (...a: unknown[]) => release(...a),
}));
import { useSeatLock, LOCK_HEARTBEAT_MS } from './useSeatLock';

const lock = (user_id: string, const_id = 'c1') => ({ const_id, user_id, user_name: user_id, acquired_at: 't' });

beforeEach(() => { acquire.mockReset(); release.mockClear(); });
afterEach(() => vi.useRealTimers());

describe('useSeatLock', () => {
  it('acquires, heartbeats, and releases the old seat on switch', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    acquire.mockImplementation(async (_e, c) => lock('me', c));
    const { result, rerender } = renderHook(({ c }) => useSeatLock('e1', c, 'me', undefined), { initialProps: { c: 'c1' as string | null } });
    await waitFor(() => expect(result.current.state).toBe('held'));
    await act(async () => { vi.advanceTimersByTime(LOCK_HEARTBEAT_MS); });
    expect(acquire).toHaveBeenCalledTimes(2);
    rerender({ c: 'c2' });
    await waitFor(() => expect(release).toHaveBeenCalledWith('e1', 'c1', undefined));
  });

  it('409 → locked with the holder; takeOver acquires with take_over', async () => {
    acquire.mockRejectedValueOnce(new ApiError('locked', 409, 'RESULT_6002', [], { lock: lock('priya') }));
    const { result } = renderHook(() => useSeatLock('e1', 'c1', 'me', undefined));
    await waitFor(() => expect(result.current.state).toBe('locked'));
    expect(result.current.holder?.user_id).toBe('priya');
    acquire.mockResolvedValueOnce(lock('me'));
    await act(() => result.current.takeOver());
    expect(acquire).toHaveBeenLastCalledWith('e1', 'c1', true);
    expect(result.current.state).toBe('held');
  });

  it('503 → unavailable (saving still allowed by the caller)', async () => {
    acquire.mockRejectedValueOnce(new ApiError('down', 503, 'RESULT_6003'));
    const { result } = renderHook(() => useSeatLock('e1', 'c1', 'me', undefined));
    await waitFor(() => expect(result.current.state).toBe('unavailable'));
  });

  it('a remote lock by someone else while held → locked (taken over)', async () => {
    acquire.mockResolvedValue(lock('me'));
    const { result, rerender } = renderHook(({ r }) => useSeatLock('e1', 'c1', 'me', r), { initialProps: { r: undefined as ReturnType<typeof lock> | undefined } });
    await waitFor(() => expect(result.current.state).toBe('held'));
    rerender({ r: lock('priya') });
    expect(result.current.state).toBe('locked');
    expect(result.current.holder?.user_id).toBe('priya');
  });

  it('pagehide sends a keepalive release', async () => {
    acquire.mockResolvedValue(lock('me'));
    const { result } = renderHook(() => useSeatLock('e1', 'c1', 'me', undefined));
    await waitFor(() => expect(result.current.state).toBe('held'));
    window.dispatchEvent(new Event('pagehide'));
    expect(release).toHaveBeenCalledWith('e1', 'c1', { keepalive: true });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/hooks/useSeatLock.test.ts`
Expected: FAIL with "Failed to resolve import './useSeatLock'".

- [ ] **Step 3: Implement** `admin/src/hooks/useSeatLock.ts`

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireSeatLock, releaseSeatLock } from '../services/election.service';
import { ApiError } from '../services/api-client';
import type { SeatLock } from '../types';

export const LOCK_HEARTBEAT_MS = 45_000;
export type SeatLockState = 'idle' | 'acquiring' | 'held' | 'locked' | 'unavailable';

/** Soft lock for the seat open in the Live Console editor. Advisory: saving never depends on it. */
export function useSeatLock(electionId: string, constId: string | null, myUserId: string, remoteLock: SeatLock | null | undefined) {
  const [state, setState] = useState<SeatLockState>('idle');
  const [holder, setHolder] = useState<SeatLock | null>(null);
  const heldRef = useRef<{ e: string; c: string } | null>(null);

  const attempt = useCallback(async (takeOver: boolean) => {
    if (!electionId || !constId) return;
    try {
      const l = await acquireSeatLock(electionId, constId, takeOver);
      heldRef.current = { e: electionId, c: constId };
      setHolder(l);
      setState('held');
    } catch (err) {
      heldRef.current = null;
      if (err instanceof ApiError && err.status === 409) {
        setHolder((err.details?.lock as SeatLock | undefined) ?? null);
        setState('locked');
      } else {
        setHolder(null);
        setState('unavailable');
      }
    }
  }, [electionId, constId]);

  // Acquire on seat change; release the previous seat on change/unmount.
  useEffect(() => {
    if (!electionId || !constId) { setState('idle'); setHolder(null); return; }
    setState('acquiring');
    void attempt(false);
    return () => {
      const h = heldRef.current;
      heldRef.current = null;
      if (h) void releaseSeatLock(h.e, h.c, undefined).catch(() => {});
    };
  }, [electionId, constId, attempt]);

  // Heartbeat while held.
  useEffect(() => {
    if (state !== 'held') return;
    const t = setInterval(() => { void attempt(false); }, LOCK_HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [state, attempt]);

  // Tab closing: best-effort keepalive release (the TTL covers the rest).
  useEffect(() => {
    const onHide = () => {
      const h = heldRef.current;
      if (h) void releaseSeatLock(h.e, h.c, { keepalive: true }).catch(() => {});
    };
    window.addEventListener('pagehide', onHide);
    return () => window.removeEventListener('pagehide', onHide);
  }, []);

  // Someone took the seat over (SSE) → we are now read-only.
  useEffect(() => {
    if (state === 'held' && remoteLock && remoteLock.user_id !== myUserId) {
      heldRef.current = null;
      setHolder(remoteLock);
      setState('locked');
    }
  }, [remoteLock, myUserId, state]);

  const takeOver = useCallback(() => attempt(true), [attempt]);
  return { state, holder, takeOver };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/hooks/useSeatLock.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add admin/src/hooks/useSeatLock.ts admin/src/hooks/useSeatLock.test.ts
git commit -m "admin: useSeatLock — acquire/heartbeat/release/take-over, keepalive on pagehide"
```

---

### Task 12: Admin: rewrite useLiveConsole (election context, filters, locks, save seat)

**Files:**
- Rewrite: `admin/src/hooks/useLiveConsole.ts`
- Test: `admin/src/hooks/useLiveConsole.test.ts`

**Interfaces:**
- Consumes:
  - `useElection()` (Task 8) and `useShellStatus()` (Task 9)
  - `getLiveResults`, `subscribeLiveUpdates`, `getSeatLocks`, `bulkOverride` (Task 7)
  - `seatStatus` (Task 6) and `useToast()` (`{ toast, toastError }`)
- Produces: `useLiveConsole()` →

```ts
{
  electionId: string; electionName: string;
  loading: boolean; saving: boolean;
  seats: LiveConstituency[];                 // filtered + searched, ordered by const_no
  counts: { all: number; PENDING: number; LEADING: number; WON: number };
  filter: 'all' | 'PENDING' | 'LEADING' | 'WON'; setFilter(f): void;
  search: string; setSearch(s: string): void;
  selectedId: string | null; selected: LiveConstituency | null; select(id: string): void;
  move(delta: 1 | -1): void;                 // next/prev in the filtered list
  locks: Record<string, SeatLock>;           // by const_id
  flashIds: Set<string>;
  reportingPct: number;                      // % of seats with any votes
  saveSeat(constId: string, payload: { overrides: BulkOverrideItem[]; rounds?: {...} }): Promise<boolean>;
  lastSavedAt: Record<string, string>;       // const_id → ISO time of our last successful save
}
```

- Search matches the seat number prefix or a case-insensitive name substring.
- The first seat in the list is selected automatically when the current selection is not in the list.
- Remove the old `tabs` / `live_tabs` / `expandedId` / `editingResultId` / `handleOverride` logic. `utils/override-validation.ts` stays because Task 6 uses its types.

- [ ] **Step 1: Write the failing test** `admin/src/hooks/useLiveConsole.test.ts`

```ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

// vi.mock factories are hoisted above plain consts, so shared mocks go through vi.hoisted.
const { handlers, svc } = vi.hoisted(() => {
  const handlers: Record<string, any> = {};
  const svc = {
    getLiveResults: vi.fn(),
    getSeatLocks: vi.fn(async () => [{ const_id: 's2', user_id: 'u2', user_name: 'Priya S', acquired_at: 't' }]),
    bulkOverride: vi.fn(async () => ({ updated: 2 })),
    subscribeLiveUpdates: vi.fn((_e: string, h: any) => { Object.assign(handlers, h); return () => {}; }),
  };
  return { handlers, svc };
});
vi.mock('../services/election.service', () => svc);
vi.mock('../context/ElectionContext', () => ({ useElection: () => ({ electionId: 'e1', election: { name: 'Bihar VS 2025' } }) }));
const setLive = vi.fn();
vi.mock('../context/ShellStatusContext', () => ({ useShellStatus: () => ({ live: 'idle', setLive }) }));
vi.mock('../context/ToastContext', () => ({ useToast: () => ({ toast: vi.fn(), toastError: vi.fn() }) }));
import { useLiveConsole } from './useLiveConsole';

const c = (status: string, votes: number) => ({ result_id: `r${votes}`, candidate_id: 'c', candidate_name: 'n', party_id: 'P', party_name: 'P', party_color: null, party_abbr: 'P', votes, status, margin: 0, last_updated: '' });
const seats = [
  { const_id: 's1', const_name: 'Phulwari', const_no: 140, const_type: 'GEN', current_round: null, total_rounds: null, candidates: [c('TRAILING', 0)] },
  { const_id: 's2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24, candidates: [c('LEADING', 10)] },
  { const_id: 's3', const_name: 'Danapur', const_no: 143, const_type: 'GEN', current_round: 24, total_rounds: 24, candidates: [c('WON', 20)] },
];

beforeEach(() => { svc.getLiveResults.mockResolvedValue(seats); svc.bulkOverride.mockClear(); });

describe('useLiveConsole', () => {
  it('counts, filters, searches and auto-selects', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.seats).toHaveLength(3));
    expect(result.current.counts).toEqual({ all: 3, PENDING: 1, LEADING: 1, WON: 1 });
    expect(result.current.selectedId).toBe('s1');
    expect(result.current.reportingPct).toBe(67);
    act(() => result.current.setFilter('WON'));
    expect(result.current.seats.map((s) => s.const_id)).toEqual(['s3']);
    expect(result.current.selectedId).toBe('s3');
    act(() => { result.current.setFilter('all'); result.current.setSearch('14'); });
    expect(result.current.seats.map((s) => s.const_no)).toEqual([140, 142, 143]);
    act(() => result.current.setSearch('patna'));
    expect(result.current.seats.map((s) => s.const_id)).toEqual(['s2']);
  });

  it('move() walks the filtered list and stops at the ends', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.selectedId).toBe('s1'));
    act(() => result.current.move(1));
    expect(result.current.selectedId).toBe('s2');
    act(() => result.current.move(-1));
    act(() => result.current.move(-1));
    expect(result.current.selectedId).toBe('s1');
  });

  it('loads locks and applies seat-lock events', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.locks.s2?.user_name).toBe('Priya S'));
    act(() => handlers.onSeatLock({ const_id: 's2', lock: null }));
    expect(result.current.locks.s2).toBeUndefined();
  });

  it('reports SSE status to the shell and resets to idle on unmount', async () => {
    const { unmount } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(svc.subscribeLiveUpdates).toHaveBeenCalled());
    act(() => handlers.onStatus('open'));
    expect(setLive).toHaveBeenCalledWith('open');
    unmount();
    expect(setLive).toHaveBeenLastCalledWith('idle');
  });

  it('saveSeat sends one bulk call and records lastSavedAt', async () => {
    const { result } = renderHook(() => useLiveConsole());
    await waitFor(() => expect(result.current.seats).toHaveLength(3));
    let ok = false;
    await act(async () => { ok = await result.current.saveSeat('s2', { overrides: [{ result_id: 'r10', votes: 11, status: 'LEADING', margin: 11 }], rounds: { current_round: 5 } }); });
    expect(ok).toBe(true);
    expect(svc.bulkOverride).toHaveBeenCalledWith('e1', [{ result_id: 'r10', votes: 11, status: 'LEADING', margin: 11 }], { s2: { current_round: 5 } });
    expect(result.current.lastSavedAt.s2).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/hooks/useLiveConsole.test.ts`
Expected: FAIL, because `result.current.counts` is undefined.

- [ ] **Step 3: Implement.** Replace `admin/src/hooks/useLiveConsole.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import { bulkOverride, getLiveResults, getSeatLocks, subscribeLiveUpdates } from '../services/election.service';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { useToast } from '../context/ToastContext';
import { seatStatus, type BulkOverrideItem } from '../utils/seat-math';
import type { LiveConstituency, SeatLock } from '../types';

const FLASH_MS = 1500;
const RELOAD_DEBOUNCE_MS = 500;

export type SeatFilter = 'all' | 'PENDING' | 'LEADING' | 'WON';
export interface SeatSave {
  overrides: BulkOverrideItem[];
  rounds?: { current_round?: number; total_rounds?: number };
}

/** CONTROLLER: Live Console — seats, filters, selection, live stream, seat locks, save. */
export function useLiveConsole() {
  const { electionId, election } = useElection();
  const { setLive } = useShellStatus();
  const { toast, toastError } = useToast();

  const [all, setAll] = useState<LiveConstituency[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<SeatFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [locks, setLocks] = useState<Record<string, SeatLock>>({});
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [lastSavedAt, setLastSavedAt] = useState<Record<string, string>>({});

  const load = useCallback(async (silent = false) => {
    if (!electionId) return;
    if (!silent) setLoading(true);
    try {
      setAll(await getLiveResults(electionId));
    } catch {
      if (!silent) toast('Failed to load live results', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [electionId, toast]);

  const loadLocks = useCallback(async () => {
    if (!electionId) return;
    try {
      const list = await getSeatLocks(electionId);
      setLocks(Object.fromEntries(list.map((l) => [l.const_id, l])));
    } catch {
      setLocks({}); // locking unavailable — the editor shows it per seat
    }
  }, [electionId]);

  useEffect(() => { setSelectedId(null); void load(); void loadLocks(); }, [load, loadLocks]);

  useEffect(() => {
    if (!electionId) return;
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const flashTimers = new Set<ReturnType<typeof setTimeout>>();
    const flash = (ids: string[]) => {
      if (ids.length === 0) return;
      setFlashIds((prev) => new Set([...prev, ...ids]));
      const t = setTimeout(() => {
        flashTimers.delete(t);
        setFlashIds((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
      }, FLASH_MS);
      flashTimers.add(t);
    };
    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => { reloadTimer = null; void load(true); }, RELOAD_DEBOUNCE_MS);
    };
    const unsubscribe = subscribeLiveUpdates(electionId, {
      onStatus: setLive,
      onReconnect: () => { scheduleReload(); void loadLocks(); },
      onResultUpdate: (u) => { flash([u.const_id]); scheduleReload(); },
      onBatchUpdate: (us) => { flash(us.map((u) => u.const_id)); scheduleReload(); },
      onSeatLock: ({ const_id, lock }) => setLocks((prev) => {
        const next = { ...prev };
        if (lock) next[const_id] = lock; else delete next[const_id];
        return next;
      }),
    });
    return () => {
      unsubscribe();
      setLive('idle');
      if (reloadTimer) clearTimeout(reloadTimer);
      flashTimers.forEach(clearTimeout);
    };
  }, [electionId, load, loadLocks, setLive]);

  const counts = useMemo(() => {
    const out = { all: all.length, PENDING: 0, LEADING: 0, WON: 0 };
    all.forEach((c) => { out[seatStatus(c)]++; });
    return out;
  }, [all]);

  const seats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return all
      .filter((c) => filter === 'all' || seatStatus(c) === filter)
      .filter((c) => !q || String(c.const_no).startsWith(q) || c.const_name.toLowerCase().includes(q))
      .sort((a, b) => a.const_no - b.const_no);
  }, [all, filter, search]);

  // Keep a valid selection inside the visible list.
  useEffect(() => {
    if (seats.length === 0) { if (selectedId !== null) setSelectedId(null); return; }
    if (!selectedId || !seats.some((s) => s.const_id === selectedId)) setSelectedId(seats[0].const_id);
  }, [seats, selectedId]);

  const move = useCallback((delta: 1 | -1) => {
    setSelectedId((cur) => {
      const i = seats.findIndex((s) => s.const_id === cur);
      const next = seats[Math.min(seats.length - 1, Math.max(0, i + delta))];
      return next ? next.const_id : cur;
    });
  }, [seats]);

  const saveSeat = useCallback(async (constId: string, payload: SeatSave) => {
    setSaving(true);
    try {
      await bulkOverride(electionId, payload.overrides, payload.rounds ? { [constId]: payload.rounds } : undefined);
      setLastSavedAt((prev) => ({ ...prev, [constId]: new Date().toISOString() }));
      toast('Seat saved');
      await load(true);
      return true;
    } catch (err) {
      toastError(err, 'Failed to save seat');
      return false;
    } finally {
      setSaving(false);
    }
  }, [electionId, load, toast, toastError]);

  const reportingPct = all.length === 0 ? 0 : Math.round(((counts.LEADING + counts.WON) / all.length) * 100);

  return {
    electionId, electionName: election?.name ?? '', loading, saving,
    seats, counts, filter, setFilter, search, setSearch,
    selectedId, selected: all.find((s) => s.const_id === selectedId) ?? null, select: setSelectedId, move,
    locks, flashIds, reportingPct, saveSeat, lastSavedAt,
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `cd admin && npx vitest run src/hooks/useLiveConsole.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit.** `npm run build` will fail until Task 13 rewrites the page, which still uses the old hook API. Only the tests run here; Task 13 runs the build.

```bash
git add admin/src/hooks/useLiveConsole.ts admin/src/hooks/useLiveConsole.test.ts
git commit -m "admin: useLiveConsole — global election, filters/search, locks, single-call seat save"
```

---

### Task 13: Admin: Live Console page (split view + keyboard)

**Files:**
- Create: `admin/src/components/live/LiveHeader.tsx`, `SeatList.tsx`, `SeatEditor.tsx`
- Rewrite: `admin/src/pages/LiveConsole.tsx`
- Test: `admin/src/pages/LiveConsole.test.tsx`

**Interfaces:**
- Consumes: `useLiveConsole()` (Task 12), `useSeatEditor()` (Task 10), `useSeatLock()` (Task 11), `useAuth()`, `Button` / `StatusPill` / `Badge` / `Kbd` / `cn` (Tasks 1–2), `seatStatus` (Task 6).
- Produces: route `/overrides` renders the split view. `SeatEditor` exposes `ref` methods `{ save(): void; discard(): void }` for the page's keyboard handler.
- Keyboard handler (page level, on `window`):
  - **↑/↓** call `move(∓1)` only when `document.activeElement` is not an `input`, `select` or `textarea`
  - **Enter** saves when focus is inside the editor and the target is not a button
  - **Esc** discards
  - **/** focuses the seat search
  - if moving with unsaved edits, `window.confirm('Discard unsaved edits for this seat?')` must return true first

- [ ] **Step 1: Write the failing test** `admin/src/pages/LiveConsole.test.tsx`

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const move = vi.fn();
const saveSeat = vi.fn(async () => true);
const seat = {
  const_id: 's2', const_name: 'Patna Sahib', const_no: 142, const_type: 'GEN', current_round: 4, total_rounds: 24,
  candidates: [
    { result_id: 'a', candidate_id: 'ca', candidate_name: 'Ravi Prasad', party_id: 'BJP', party_name: 'BJP', party_color: '#f59e0b', party_abbr: 'BJP', votes: 61204, status: 'LEADING', margin: 0, last_updated: '' },
    { result_id: 'b', candidate_id: 'cb', candidate_name: 'Anil Kumar', party_id: 'INC', party_name: 'INC', party_color: '#0ea5e9', party_abbr: 'INC', votes: 48990, status: 'TRAILING', margin: 0, last_updated: '' },
  ],
};
vi.mock('../hooks/useLiveConsole', () => ({
  useLiveConsole: () => ({
    electionId: 'e1', electionName: 'Bihar VS 2025', loading: false, saving: false,
    seats: [seat], counts: { all: 1, PENDING: 0, LEADING: 1, WON: 0 }, filter: 'all', setFilter: vi.fn(),
    search: '', setSearch: vi.fn(), selectedId: 's2', selected: seat, select: vi.fn(), move,
    locks: {}, flashIds: new Set(), reportingPct: 100, saveSeat, lastSavedAt: {},
  }),
}));
vi.mock('../hooks/useSeatLock', () => ({ useSeatLock: () => ({ state: 'held', holder: null, takeOver: vi.fn() }) }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'me', name: 'Mannu K' } }) }));
import LiveConsole from './LiveConsole';

afterEach(() => { cleanup(); move.mockClear(); saveSeat.mockClear(); });

describe('LiveConsole page', () => {
  it('shows the seat with calculated margin and sentence-case actions', () => {
    render(<LiveConsole />);
    expect(screen.getByRole('heading', { name: /142 Patna Sahib/ })).toBeTruthy();
    expect(screen.getByText('+12,214')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save seat' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Declare won' })).toBeTruthy();
  });

  it('↑/↓ move seats only when focus is not in an input', () => {
    render(<LiveConsole />);
    fireEvent.keyDown(window, { key: 'ArrowDown' });
    expect(move).toHaveBeenCalledWith(1);
    move.mockClear();
    const votes = screen.getByLabelText('Votes for Ravi Prasad');
    votes.focus();
    fireEvent.keyDown(votes, { key: 'ArrowDown' });
    expect(move).not.toHaveBeenCalled();
  });

  it('Save seat sends the whole seat with margins', async () => {
    render(<LiveConsole />);
    fireEvent.change(screen.getByLabelText('Votes for Anil Kumar'), { target: { value: '50,000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save seat' }));
    await Promise.resolve();
    expect(saveSeat).toHaveBeenCalledWith('s2', expect.objectContaining({
      overrides: [
        { result_id: 'a', votes: 61204, status: 'LEADING', margin: 11204 },
        { result_id: 'b', votes: 50000, status: 'TRAILING', margin: 11204 },
      ],
    }));
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `cd admin && npx vitest run src/pages/LiveConsole.test.tsx`
Expected: FAIL (the old page has no "Save seat" button).

- [ ] **Step 3: Create `LiveHeader.tsx`**

```tsx
export function LiveHeader({ electionName, reportingPct }: { electionName: string; reportingPct: number }) {
  return (
    <div className="flex items-end justify-between gap-6 px-6 pt-5 pb-4">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Live console</h1>
        <p className="mt-0.5 text-sm text-ink-2">{electionName} · auto-refreshing</p>
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-2">
        <span>Counting progress · <span className="font-medium text-ink">{reportingPct}% of seats reporting</span></span>
        <div className="h-1.5 w-36 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={reportingPct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-accent" style={{ width: `${reportingPct}%` }} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `SeatList.tsx`**

```tsx
import { forwardRef, useEffect, useRef } from 'react';
import { Lock, Search } from 'lucide-react';
import { Badge, StatusPill } from '../ui/Badge';
import { cn } from '../ui/cn';
import { rankSeat, seatStatus, type SeatRow } from '../../utils/seat-math';
import type { LiveConstituency, SeatLock } from '../../types';
import type { SeatFilter } from '../../hooks/useLiveConsole';

interface Props {
  seats: LiveConstituency[];
  counts: { all: number; PENDING: number; LEADING: number; WON: number };
  filter: SeatFilter; onFilter(f: SeatFilter): void;
  search: string; onSearch(s: string): void;
  selectedId: string | null; onSelect(id: string): void;
  locks: Record<string, SeatLock>; myUserId: string;
  flashIds: Set<string>;
}

const CHIPS: { key: SeatFilter; label: string; on: string; off: string }[] = [
  { key: 'all', label: 'All', on: 'bg-accent text-white', off: 'bg-subtle text-ink-2' },
  { key: 'PENDING', label: 'Pending', on: 'bg-ink-2 text-white', off: 'bg-subtle text-ink-2' },
  { key: 'LEADING', label: 'Leading', on: 'bg-accent text-white', off: 'bg-accent-soft text-accent' },
  { key: 'WON', label: 'Won', on: 'bg-ok text-white', off: 'bg-ok-soft text-ok-text' },
];

function leaderOf(c: LiveConstituency) {
  const rows = c.candidates.map((x) => ({ ...x, status: x.status })) as unknown as SeatRow[];
  return rankSeat(rows).leader;
}

export const SeatList = forwardRef<HTMLInputElement, Props>(function SeatList(p, searchRef) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [p.selectedId]);

  return (
    <section className="flex w-80 shrink-0 flex-col overflow-hidden rounded-card border border-line bg-card shadow-sm">
      <div className="space-y-2.5 border-b border-line p-3">
        <label className="relative block">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
          <input
            ref={searchRef}
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Jump to seat…"
            aria-label="Jump to seat"
            className="h-8 w-full rounded-control border border-line bg-card pl-8 pr-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter seats">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={p.filter === c.key}
              onClick={() => p.onFilter(c.key)}
              className={cn('rounded-control px-2 py-1 text-xs font-medium whitespace-nowrap', p.filter === c.key ? c.on : c.off)}
            >
              {c.label} <span className="tabular-nums">{c.key === 'all' ? p.counts.all : p.counts[c.key]}</span>
            </button>
          ))}
        </div>
      </div>
      <div ref={listRef} role="listbox" aria-label="Seats" className="flex-1 divide-y divide-line overflow-y-auto">
        {p.seats.length === 0 && <p className="p-6 text-center text-sm text-muted">No seats match.</p>}
        {p.seats.map((s) => {
          const selected = s.const_id === p.selectedId;
          const status = seatStatus(s);
          const leader = status === 'PENDING' ? null : leaderOf(s);
          const lock = p.locks[s.const_id];
          const lockedByOther = lock && lock.user_id !== p.myUserId;
          return (
            <div
              key={s.const_id}
              role="option"
              aria-selected={selected}
              onClick={() => p.onSelect(s.const_id)}
              className={cn(
                'flex cursor-pointer items-center justify-between gap-2 border-l-4 px-3 py-2.5 transition-colors',
                selected ? 'border-accent bg-accent-soft' : 'border-transparent hover:bg-subtle',
                p.flashIds.has(s.const_id) && 'bg-warn-soft',
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="w-7 font-mono text-xs text-muted">{s.const_no}</span>
                <span className={cn('truncate text-xs', selected ? 'font-semibold text-ink' : 'font-medium text-ink')}>{s.const_name}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {lockedByOther ? (
                  <span className="flex items-center gap-1 text-[11px] text-muted"><Lock size={12} aria-hidden />{lock.user_name}</span>
                ) : leader ? (
                  <Badge className="border border-line bg-card" style={{ color: leader.party_color ?? undefined }}>{leader.party_abbr ?? leader.party_id}</Badge>
                ) : null}
                <StatusPill status={status} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
});
```

- [ ] **Step 5: Create `SeatEditor.tsx`**

```tsx
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Lock, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/Kbd';
import { StatusPill } from '../ui/Badge';
import { cn } from '../ui/cn';
import { useSeatEditor } from '../../hooks/useSeatEditor';
import { isNota, seatStatus } from '../../utils/seat-math';
import { OVERRIDE_STATUSES, type OverrideStatus } from '../../utils/override-validation';
import type { SeatLockState } from '../../hooks/useSeatLock';
import type { SeatSave } from '../../hooks/useLiveConsole';
import type { LiveConstituency, SeatLock } from '../../types';

export interface SeatEditorHandle { save(): void; discard(): void; dirty: boolean }

interface Props {
  seat: LiveConstituency;
  saving: boolean;
  lastSavedAt?: string;
  lock: { state: SeatLockState; holder: SeatLock | null; takeOver(): Promise<void> };
  onSave(constId: string, payload: SeatSave): Promise<boolean>;
}

const STATUS_LABEL: Record<OverrideStatus, string> = { LEADING: 'Leading', TRAILING: 'Trailing', WON: 'Won', LOST: 'Lost' };
const fmt = (n: number) => n.toLocaleString('en-IN');
const time = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('en-GB') : null);

export const SeatEditor = forwardRef<SeatEditorHandle, Props>(function SeatEditor({ seat, saving, lastSavedAt, lock, onSave }, ref) {
  const ed = useSeatEditor(seat);
  const [error, setError] = useState<string | null>(null);
  const readOnly = lock.state === 'locked';

  const submit = async (declare: boolean) => {
    if (readOnly) return;
    const out = ed.build(declare);
    if (!out.ok) { setError(out.error); return; }
    setError(null);
    await onSave(seat.const_id, { overrides: out.overrides, rounds: out.rounds });
  };

  useImperativeHandle(ref, () => ({ save: () => void submit(false), discard: ed.discard, dirty: ed.dirty }));

  const cur = Number(ed.round.current) || 0;
  const tot = Number(ed.round.total) || 0;
  const roundPct = tot > 0 ? Math.min(100, Math.round((cur / tot) * 100)) : 0;

  return (
    <section className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden rounded-card border border-line bg-card p-6 shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-lg font-semibold text-ink">#{seat.const_no} {seat.const_name}</h2>
          <span className="rounded-control border border-line bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{seat.const_type}</span>
          <StatusPill status={seatStatus(seat)} />
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-2">
          <label className="flex items-center gap-1.5">
            Round
            <input aria-label="Current round" inputMode="numeric" value={ed.round.current} disabled={readOnly}
              onChange={(e) => ed.setRound('current', e.target.value)}
              className="h-7 w-11 rounded-control border border-line text-center tabular-nums focus:border-accent focus:outline-none" />
            of
            <input aria-label="Total rounds" inputMode="numeric" value={ed.round.total} disabled={readOnly}
              onChange={(e) => ed.setRound('total', e.target.value)}
              className="h-7 w-11 rounded-control border border-line text-center tabular-nums focus:border-accent focus:outline-none" />
          </label>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-subtle"><div className="h-full rounded-full bg-accent" style={{ width: `${roundPct}%` }} /></div>
          {time(lastSavedAt) && <span className="flex items-center gap-1 text-muted"><RefreshCw size={12} aria-hidden />Last saved {time(lastSavedAt)}</span>}
        </div>
      </header>

      {readOnly && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-card border border-warn/40 bg-warn-soft px-4 py-2.5 text-sm text-warn-text">
          <span className="flex items-center gap-2"><Lock size={14} aria-hidden />Locked · {lock.holder?.user_name ?? 'another editor'} is editing this seat</span>
          <Button size="sm" variant="outline" onClick={() => void lock.takeOver()}>Take over</Button>
        </div>
      )}
      {ed.changedElsewhere && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-card border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm text-accent">
          This seat changed elsewhere while you were editing.
          <Button size="sm" variant="outline" onClick={ed.discard}>Reload</Button>
        </div>
      )}

      <div className="min-h-0 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium text-ink-2">
              <th className="py-2.5 pl-3 font-medium">Candidate</th>
              <th className="px-3 py-2.5 text-right font-medium">Votes</th>
              <th className="py-2.5 pr-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ed.rows.map((r) => (
              <tr key={r.result_id} className={cn(r.result_id === ed.leaderId && 'bg-accent-soft/40')}>
                <td className="py-2.5 pl-3">
                  <div className="flex items-center gap-2.5 whitespace-nowrap">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: r.party_color ?? '#94a3b8' }} aria-hidden />
                    <span className={cn('text-ink', r.result_id === ed.leaderId ? 'font-semibold' : 'font-medium', isNota(r) && 'text-ink-2')}>{r.candidate_name}</span>
                    {!isNota(r) && <span className="rounded-control border border-line px-1.5 py-0.5 text-[11px] font-medium text-ink-2">{r.party_abbr ?? r.party_id}</span>}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label={`Votes for ${r.candidate_name}`}
                    aria-invalid={!!r.error}
                    value={r.draftVotes}
                    disabled={readOnly}
                    onChange={(e) => ed.setVotes(r.result_id, e.target.value)}
                    className={cn(
                      'h-8 w-36 rounded-control border bg-card px-2.5 text-right font-medium tabular-nums text-ink focus:outline-none',
                      r.error ? 'border-bad focus:border-bad' : 'border-line-strong focus:border-accent',
                    )}
                  />
                  {r.error && <div className="mt-1 text-[11px] text-bad-text">{r.error}</div>}
                </td>
                <td className="py-2.5 pr-3 text-right">
                  {isNota(r) ? <span className="text-xs text-muted">—</span> : (
                    <select
                      aria-label={`Status for ${r.candidate_name}`}
                      value={r.status}
                      disabled={readOnly}
                      onChange={(e) => ed.setStatus(r.result_id, e.target.value as OverrideStatus)}
                      className="h-8 rounded-control border border-line bg-subtle px-2 text-xs font-medium text-ink-2 focus:border-accent focus:outline-none"
                    >
                      {OVERRIDE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-6 rounded-card border border-line bg-page px-4 py-3 text-xs text-ink-2">
        <span>Margin: <span className="text-sm font-bold tabular-nums text-accent">{ed.tie ? 'Tie' : `+${fmt(ed.margin)}`}</span> <span className="text-muted">(calculated)</span></span>
        <span className="h-3 w-px bg-line-strong" aria-hidden />
        <span>Total votes: <span className="text-sm font-semibold tabular-nums text-ink">{fmt(ed.totalVotes)}</span></span>
      </div>

      {error && <p role="alert" className="text-sm text-bad-text">{error}</p>}

      <footer className="flex flex-col gap-2 border-t border-line pt-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs text-ink-2">
            <Lock size={13} className="text-muted" aria-hidden />
            {lock.state === 'held' ? 'You are editing · lock held'
              : lock.state === 'unavailable' ? 'Seat locking unavailable — others may edit at the same time'
              : lock.state === 'locked' ? 'Read only' : 'Taking lock…'}
          </span>
          <div className="flex items-center gap-2.5">
            <Button variant="outline" onClick={ed.discard} disabled={!ed.dirty || saving}>Discard</Button>
            <Button variant="primary" onClick={() => void submit(false)} disabled={saving || readOnly}>Save seat</Button>
            <Button variant="success" onClick={() => void submit(true)} disabled={saving || readOnly || !ed.leaderId}>Declare won</Button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 text-[11px] text-muted">
          <span>Navigate:</span><Kbd>↑</Kbd><Kbd>↓</Kbd><span aria-hidden>|</span><Kbd>Enter</Kbd><span>save</span><span aria-hidden>|</span><Kbd>Esc</Kbd><span>discard</span>
        </div>
      </footer>
    </section>
  );
});
```

- [ ] **Step 6: Rewrite `admin/src/pages/LiveConsole.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { useLiveConsole } from '../hooks/useLiveConsole';
import { useSeatLock } from '../hooks/useSeatLock';
import { useAuth } from '../context/AuthContext';
import { LiveHeader } from '../components/live/LiveHeader';
import { SeatList } from '../components/live/SeatList';
import { SeatEditor, type SeatEditorHandle } from '../components/live/SeatEditor';
import Spinner from '../components/atoms/Spinner';

const isTypingTarget = (el: Element | null) => !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);

/** PAGE: Live Console — split view (seat list | seat editor), keyboard-first. */
export default function LiveConsole() {
  const lc = useLiveConsole();
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const lock = useSeatLock(lc.electionId, lc.selectedId, myId, lc.selectedId ? lc.locks[lc.selectedId] : undefined);
  const editorRef = useRef<SeatEditorHandle>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const editorBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isTypingTarget(active)) {
        if (editorRef.current?.dirty && !window.confirm('Discard unsaved edits for this seat?')) return;
        e.preventDefault();
        lc.move(e.key === 'ArrowDown' ? 1 : -1);
      } else if (e.key === 'Enter' && editorBoxRef.current?.contains(active) && active?.tagName !== 'BUTTON') {
        e.preventDefault();
        editorRef.current?.save();
      } else if (e.key === 'Escape') {
        editorRef.current?.discard();
      } else if (e.key === '/' && !isTypingTarget(active)) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lc]);

  const select = (id: string) => {
    if (id !== lc.selectedId && editorRef.current?.dirty && !window.confirm('Discard unsaved edits for this seat?')) return;
    lc.select(id);
  };

  if (!lc.electionId) return <p className="p-10 text-center text-sm text-ink-2">Pick an election in the top bar to start.</p>;

  return (
    <div className="flex h-full flex-col">
      <LiveHeader electionName={lc.electionName} reportingPct={lc.reportingPct} />
      {lc.loading && lc.seats.length === 0 ? (
        <Spinner label="Loading seats…" />
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 px-6 pb-6">
          <SeatList
            ref={searchRef}
            seats={lc.seats} counts={lc.counts}
            filter={lc.filter} onFilter={lc.setFilter}
            search={lc.search} onSearch={lc.setSearch}
            selectedId={lc.selectedId} onSelect={select}
            locks={lc.locks} myUserId={myId} flashIds={lc.flashIds}
          />
          <div ref={editorBoxRef} className="flex min-w-0 flex-1">
            {lc.selected ? (
              <SeatEditor
                key={lc.selected.const_id}
                ref={editorRef}
                seat={lc.selected}
                saving={lc.saving}
                lastSavedAt={lc.lastSavedAt[lc.selected.const_id]}
                lock={lock}
                onSave={lc.saveSeat}
              />
            ) : (
              <p className="m-auto text-sm text-muted">No seat selected.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run the page test, the full suite and the build**

Run: `cd admin && npx vitest run src/pages/LiveConsole.test.tsx && npm test && npm run build`
Expected: all PASS, and the build succeeds. If `tsc` reports unused exports in `override-validation.ts` (`validateOverride`, `OverrideForm`), keep them; the existing `override-validation.test.ts` still covers them.

- [ ] **Step 8: Manual end-to-end check**
  - Start the stack: `docker compose up -d`, the backend on :3082 and the admin on :3081.
  - Optionally run the simulation in `scraper/src/simulation` for live traffic.
  - Then confirm:
    1. Picking a live election shows the seat list with counts, and the first seat is selected.
    2. Typing "50,000" in a votes box updates margin/statuses at once. ↓ while in the box does **not** change seats.
    3. Save seat persists the change: reload the page and the values remain. The public site shows the new margin.
    4. Open the same seat in a second browser as another user. It shows "Locked · <name>" read-only. Take over works, and the first browser turns read-only.
    5. Stop Redis (`docker compose stop redis`). The editor says "Seat locking unavailable…", and saving still works.
    6. Declare won marks the leader as won. A tie disables Declare won.

- [ ] **Step 9: Commit**

```bash
git add admin/src/components/live admin/src/pages/LiveConsole.tsx admin/src/pages/LiveConsole.test.tsx
git commit -m "admin: split-view Live Console with seat editor, rounds, seat locks, keyboard"
```

---

### Task 14: Docs: FEATURES.md, CLAUDE.md, design notes

**Files:**
- Modify: `docs/FEATURES.md`, `CLAUDE.md`, `docs/design/admin/NOTES.md`

- [ ] **Step 1: Add a feature entry to `docs/FEATURES.md`.** Follow the file's existing heading style, under the admin section.

```markdown
### Admin redesign: shell + Live Console (2026-10)
- New shell: grouped sidebar (Counting / Data / Admin), top bar with a global election picker (remembered in `?election=` + localStorage), live-updates pill, health dot (`/health/ready`), keyboard-shortcuts dialog.
- Live Console split view: seat list with Pending / Leading / Won filters, search, and lock indicators. The seat editor has every candidate editable, an auto-calculated margin (leader − runner-up; others = gap to leader), statuses that follow the votes, editable rounds, **Save seat** (one bulk call) and **Declare won**. Keyboard: ↑/↓, Enter, Esc, /.
- Seat locks: soft, advisory, held in Redis `lock:seat:{election}:{const}` (TTL 120 s, heartbeat 45 s). Endpoints `GET/POST /admin/live/locks` and `POST /admin/live/locks/release`, SSE `seat-lock`. Take-over is audited (`SEAT_LOCK_TAKEOVER`). With Redis down, locking is disabled and saving still works.
- Styling: Tailwind v4 (utilities only, preflight off) + Radix. The legacy `admin.css` sits in a lower `legacy` cascade layer until Phase 3.
```

- [ ] **Step 2: Update the Admin line in `CLAUDE.md`.** It currently reads "**Admin:** React + TypeScript (Vite) panel for managing elections, candidates, results, manifests, live overrides". Replace it with:

```markdown
- **Admin:** React + TypeScript (Vite) panel for managing elections, candidates, results, manifests, live overrides. Being redesigned (spec `docs/superpowers/specs/2026-10-01-admin-redesign-design.md`): Tailwind v4 (preflight off) + Radix, legacy `admin.css` in a lower cascade layer. Tailwind only scans the paths listed via `@source` in `admin/src/theme/tailwind.css` — add a line for every new file/dir that uses classes. Global election selection via `ElectionContext`.
```

- [ ] **Step 3: Mark the Live Console item done in `docs/design/admin/NOTES.md`.** Under "Live console", change the chip line to: "Filter chips wrap (`flex-wrap`) — done in Phase 1."

- [ ] **Step 4: Final verification**

Run: `cd admin && npm test && npm run build && cd ../backend && npm test`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add docs/FEATURES.md CLAUDE.md docs/design/admin/NOTES.md
git commit -m "docs: admin redesign phase 1 (shell, Live Console, seat locks)"
```

---

## Follow-up plans (not in this plan)

- **Phase 2:** table + side-panel pattern (Radix Dialog sheet, `/x/:id` URLs, with `/x/:id/edit` redirecting to `/x/:id`), built first for Candidates, then Parties, Persons, Constituencies, Elections and Manifests (full-width). These pages switch to `useElection()`, and the `AdminLandingCard` pages are removed. ⌘K search uses `/search/constituencies` + `/search/candidates`.
- **Phase 3:**
  - Dashboard: KPI tiles, Live Console card with current editors from the lock list, and activity, health and feedback cards (Recent activity and System health are SUPER_ADMIN-only).
  - Login, using `/logo-mark.png`.
  - The feedback bell in the top bar.
  - The remaining pages (Feedback, Users, Audit logs, System status).
  - Deleting `admin.css` and every inline `style={{}}`.
