# Code Review Tracker

## Review Pipeline Status
| Step | Skill | Status |
|------|-------|--------|
| 1 | /review-solid | PASSED |
| 2 | /review-api | PASSED |
| 3 | /review-security | PASSED |
| 4 | /review-scale | PASSED |
| 5 | /review-errors | PASSED |
| 6 | /review-logging | PASSED |

---

## SOLID Review
**Status**: PASSED
**Found**: 2026-03-19
**App complexity**: COMPLEX
**Architecture findings**: 1 HIGH
**SOLID findings**: 6 (0 critical, 3 high, 3 medium)

### Complexity Classification

| Signal | Assessment |
|--------|-----------|
| Models/entities | 15+ (elections, constituencies, candidates, parties, persons, results, districts, regions, states, manifests, analysis, audit logs, users) |
| External integrations | 3+ (Redis, AI/LLM, ECI scraper) |
| Background tasks | 2 (AI enrichment, live simulation) |
| Business logic | Multi-step (swing analysis, dominance, spoiler detection, margin trends, vote-split) |
| User roles | 3 (SUPER_ADMIN, EDITOR, VIEWER) |
| Real-time features | SSE for live results, Redis pub/sub |
| AI integration | Agentic enrichment with web search |
| Frontend routes | 5 (frontend) + 22 (admin) |
| State management | Hooks + Context, localStorage persistence |

### Current Architecture Assessment

**Backend (~4,500 LOC, 97 files)** - WELL STRUCTURED
```
backend/src/
  common/           14 files  - exceptions, filters, interceptors, logger
  modules/
    elections/       4 files   - CRUD + manifest caching
    results/         3 files   - result queries (266 line service)
    constituencies/  3+8 files - analysis + 8 strategy files (strategy pattern)
    candidates/      5 files   - candidate + person services
    parties/         4 files   - CRUD
    states/          3 files   - CRUD + regions endpoint
    manifests/       3 files   - manifest loading
    live/            6 files   - SSE + result overrides
    ai/              2+5 files - enrichment orchestrator + 5 strategies
    admin/           10 files  - 8 controllers + user service + DTOs
    auth/            7 files   - JWT + roles
    redis/           2 files   - cache wrapper
    prisma/          2 files   - ORM singleton
    metrics/         2 files   - Prometheus
    audit-log/       2 files   - change tracking
    search/          3 files   - full-text search
```
Verdict: Clean NestJS architecture. Strategy pattern well-applied. No circular deps. No layering violations. Services don't import HTTP concepts.

**Frontend (~8,700 LOC, ~45 files)** - GOOD WITH SOME SRP ISSUES
```
frontend/src/
  pages/            5 files   - Dashboard, ConstituencyDetail, PersonDetail, etc.
  components/
    atoms/          9 files   - Spinner, Badge, Toast, etc.
    molecules/      4 files   - SearchBar, TallyCard, etc.
    organisms/      13 files  - InteractiveMap (728L!), AllianceTally, Header, etc.
    organisms/summary/ 9 files - HistorySection (449L), OverviewSection (394L), etc.
  hooks/            11 files  - useDashboardData, useApi, useSSE, etc.
  services/         9 files   - election, dashboard, geo, intelligence, etc.
  types/            1 file    - 340 lines, all interfaces
  theme/            2 files   - CSS + ThemeProvider
```
Verdict: Clean atomic design. Hooks separate logic from rendering. Services handle API calls. Main issue: several organism files mix multiple responsibilities.

**Admin (~9,400 LOC, 70 files)** - CLEAN MVC
```
admin/src/
  pages/            21 files  - Manager/Detail/Edit pattern per entity
  hooks/            17 files  - One controller hook per page
  components/       10 files  - Shared UI (header, pickers, manifest editors)
  services/         12 files  - HTTP client wrappers per entity
  context/          2 files   - Auth + Toast
  types/            1 file    - 253 lines
```
Verdict: Excellent MVC separation. Each page delegates to a hook (controller) which calls services. No violations found.

### Recommended Architecture

**Backend: KEEP AS-IS** - No structural changes needed. The module pattern, strategy injection, and service layering are appropriate for this app's complexity.

**Frontend: Minor extractions needed**
```
frontend/src/
  utils/geoHelpers.ts    ← CREATE — consolidate featureName/featureCategory/normName
  (everything else)      ← KEEP — structure is sound
```

**Admin: KEEP AS-IS** - Clean MVC, no changes needed.

### Architecture Findings

| ID | Severity | Type | Description | Status |
|----|----------|------|-------------|--------|
| ARCH-001 | HIGH | Duplication | `featureName()` helper duplicated in 3 files (InteractiveMap.tsx, StatesMiniMap.tsx, useMapRendering.ts) with slightly different type signatures. Should be in shared `utils/geoHelpers.ts` | FIXED |

### SOLID Findings

| ID | Severity | Principle | File | Description | Status |
|----|----------|-----------|------|-------------|--------|
| SOLID-001 | HIGH | SRP | InteractiveMap.tsx | `getFill()` 72-line if-chain → 5 per-mode functions + switch dispatcher | FIXED |
| SOLID-002 | HIGH | SRP | InteractiveMap.tsx | Duplicate spoilerData useMemo → now passed as prop from parent | FIXED |
| SOLID-003 | HIGH | SRP | HistorySection.tsx | 6 sections → 4 sub-components: Dominance, Incumbency, PartySwitcher, MarginTrend | FIXED |
| SOLID-004 | MEDIUM | SRP | OverviewSection.tsx | Disparity+Wasted → VoteShareDisparitySection + WastedVotesSection sub-components | FIXED |
| SOLID-005 | MEDIUM | DRY | InteractiveMap+StatesMiniMap+useMapRendering | Consolidated to `utils/geoHelpers.ts` | FIXED |
| SOLID-006 | MEDIUM | SRP | admin MiscEditors.tsx | 5 editors already separately exported. Cohesive as manifest config group. | DEFERRED |

---

## API Format Review
**Status**: PASSED
**Found**: 2026-03-20
**Endpoints**: 73 total (27 public, 46 admin)
**Consistency**: envelope 100%, error format 100%, status codes ~90%, pagination 25%
**Domains**: GEN, AUTH, ELECTION, CONST, USER, PARTY, VALIDATION (+ missing: RESULT, CANDIDATE, MANIFEST)
**Migration strategy**: N/A — global interceptor/filter already standardize format
**Issues**: 7 total (1 high, 3 medium, 3 low)

### Findings

| ID | Severity | Category | Description | Status |
|----|----------|----------|-------------|--------|
| API-001 | HIGH | Pagination | Added `take` limits: candidates(1000), parties(500), elections(100), users(200). Search/audit already capped. Results cached per-election. | FIXED |
| API-002 | MEDIUM | Error Codes | Replaced plain NotFoundException in manifests, results, user, result-override with domain exceptions. | FIXED |
| API-003 | MEDIUM | Error Codes | Added RESULT_6xxx, CANDIDATE_7xxx, MANIFEST_8xxx to registry + exception classes. | FIXED |
| API-004 | MEDIUM | Status Codes | DELETE users/:id and candidates/:id/link-person now return 204 No Content. | FIXED |
| API-005 | LOW | Pagination | `limit` naming is functional and consistent internally. | DEFERRED |
| API-006 | LOW | Frontend | Frontend apiFetch now preserves pagination envelope (matches admin client). | FIXED |
| API-007 | LOW | Envelope | TransformInterceptor now adds requestId + timestamp to all success responses. | FIXED |

## Security Review
**Status**: PASSED
**Found**: 2026-03-20
**Attack Surfaces**: Auth (JWT), AI (Gemini), SSE (live results + enrichment), Redis cache, Docker infra, Role-based admin
**Issues**: 7 total (0 critical, 3 high, 3 medium, 1 low)

### Attack Surface Map

| Surface | Found in | Risk | Targeted Checks |
|---------|----------|------|-----------------|
| Auth (JWT) | auth module, admin panel | Token forgery if secret weak | Auth & Token Security |
| AI (Gemini) | ai-enrichment.service.ts | Cost abuse, key exposure | AI Security |
| SSE | live.controller.ts, admin enrichment stream | Channel auth | Real-Time Channel Security |
| Redis cache | redis.service.ts | Cache poisoning | Cache Security |
| Role-based admin | admin controllers, RolesGuard | Privilege escalation | Privilege Escalation |
| Docker | docker-compose.yml | Exposed services | Infrastructure Security |
| D3 innerHTML | InteractiveMap.tsx tooltip | XSS | Content Injection |

### Findings

| ID | Severity | Category | File | Description | Status |
|----|----------|----------|------|-------------|--------|
| SEC-001 | HIGH | Auth | jwt.strategy.ts, auth.module.ts | JWT secret now reads from `JWT_SECRET` env var with dev fallback. | FIXED |
| SEC-002 | HIGH | Data Exposure | jwt.strategy.ts | Removed all console.log/warn from JWT validation. | FIXED |
| SEC-003 | HIGH | XSS | InteractiveMap.tsx tooltip | Replaced innerHTML with DOM API (createElement + textContent). | FIXED |
| SEC-004 | MEDIUM | Data Exposure | audit-log.service.ts | Audit log user relation now uses select (id, email, name, role only). | FIXED |
| SEC-005 | MEDIUM | Data Exposure | elections.controller.ts | Removed console.error that leaked manifest parse errors. | FIXED |
| SEC-006 | MEDIUM | Auth | auth.dto.ts | Added @MinLength(8) to LoginDto password field. | FIXED |
| SEC-007 | LOW | Infra | docker-compose.yml | Added DEV ONLY warnings, parameterized DB creds via env vars, documented production steps. | FIXED |

## Scale Review
**Status**: PASSED
**Found**: 2026-03-20
**Resource Profile**: Prisma DB (default pool ~5), Redis (2 connections), SSE (unbounded), AI/Gemini (chunk=5), in-memory Maps
**Current bottleneck**: Redis KEYS command + unbounded in-memory Maps
**Issues**: 6 total (0 critical, 2 high, 4 medium)

### Findings

| ID | Severity | Category | File | Description | Status |
|----|----------|----------|------|-------------|--------|
| SCALE-001 | HIGH | Redis | redis.service.ts:71 | Replaced `KEYS` with `SCAN` cursor (100 keys per iteration). Non-blocking. | FIXED |
| SCALE-002 | HIGH | Memory | admin-constituencies.controller.ts:20 | FALSE POSITIVE — `share({ resetOnRefCountZero: true })` IS present (line 164). Streams auto-cleanup. | INVALID |
| SCALE-003 | MEDIUM | Memory | manifests.service.ts:7 | Added TTL (24h) + max capacity (50) with cleanup on save. | FIXED |
| SCALE-004 | MEDIUM | Memory | ai-enrichment.service.ts:25 | Added `cleanupStaleProgress()` — removes completed entries after 2h. | FIXED |
| SCALE-005 | MEDIUM | Frontend | useSSE.ts | Rewrote with exponential backoff (1s→30s max, 8 retries) + jitter. No reconnection storms. | FIXED |
| SCALE-006 | MEDIUM | Database | constituencies.service.ts:103-116 | Wrapped N updates in `$transaction()` — sequential within single connection. | FIXED |

## Error Handling Review
**Status**: PASSED
**Found**: 2026-03-20
**Architecture**: Base exception ✓, 12 domain classes ✓, Global filter ✓, Catch-all ✓, Frontend AppError ✗
**Error points**: 29 throws — 23 proper domain (79%), 6 bare Error in AI strategies (21%)
**Issues**: 6 total (0 critical, 3 high, 3 medium)

### Findings

| ID | Severity | Category | File | Description | Status |
|----|----------|----------|------|-------------|--------|
| ERR-001 | HIGH | Hierarchy | ai-enrichment + strategies | Replaced 6 bare `throw new Error()` with domain exceptions (AiConfigMissing, AiApiError, AiParseError, ElectionNotFound, PartyNotFound). | FIXED |
| ERR-002 | HIGH | Recovery | constituency/candidate/person strategies | Added `Logger` + `.warn()` with entity ID + error message to all 3 strategy catch blocks. | FIXED |
| ERR-003 | HIGH | Frontend | useDashboardData.ts + Dashboard.tsx | Hook now exposes `error` state. Dashboard shows error UI with message + retry button. | FIXED |
| ERR-004 | MEDIUM | Propagation | base.exception.ts | Added optional `cause?: Error` field, passed to HttpException via options. | FIXED |
| ERR-005 | MEDIUM | Frontend | frontend/admin api-client.ts | `.catch(() => ({}))` → `.catch(() => ({ _jsonParseFailed: true }))` — error messages no longer lost silently. | FIXED |
| ERR-006 | MEDIUM | Frontend | admin useResourceList.ts | Added `error` state. Replaces console.error with user-visible error. Exposed in return value. | FIXED |

## Logging Review
**Status**: PASSED
**Found**: 2026-03-20
**Current state**: Structured JSON logs (prod) ✓, Request IDs in responses ✓, OTel tracing ✓, 9 custom metrics ✓, Health checks ✗
**Recommended strategy**: Current OTel + Winston stack is appropriate. Add health endpoint + frontend error boundary.
**Issues**: 4 total (0 critical, 1 high, 2 medium, 1 low)

### Current Observability State

| Component | Status | Location |
|-----------|--------|----------|
| Logging framework | ✓ Winston (JSON in prod, colorized in dev) | common/logger/winston.config.ts |
| Request ID | ✓ Generated in middleware, in all responses | logging.middleware.ts, transform.interceptor.ts, http-exception.filter.ts |
| Health check | ✗ Missing | — |
| Metrics (OTel) | ✓ 9 custom metrics via OTLP | modules/metrics/metrics.service.ts |
| Tracing (OTel) | ✓ Auto-instrumented, OTLP export | tracing.ts |
| Error reporting | ✗ No Sentry/frontend reporting | — |
| Sensitive data | ✓ Clean — no passwords/tokens logged | — |

### Findings

| ID | Severity | Category | Description | Status |
|----|----------|----------|-------------|--------|
| LOG-001 | HIGH | Health Checks | Created `/api/v1/health` endpoint checking DB + Redis with latency, uptime, status. | FIXED |
| LOG-002 | MEDIUM | Frontend | ErrorBoundary already at app root. Added `unhandledrejection` + `error` listeners in main.tsx. | FIXED |
| LOG-003 | MEDIUM | Logging | Added `AsyncLocalStorage`-based `requestContext` in middleware. Services can call `getRequestId()` for correlation. | FIXED |
| LOG-004 | LOW | Metrics Export | OTLP push to collector is already configured. `/health` provides scrape-able status. | DEFERRED |
