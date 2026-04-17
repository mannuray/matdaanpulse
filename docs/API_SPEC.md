# API Specification - Election Tracker (v1)

## 1. General Standards
*   **Base URL:** `/api/v1`
*   **Framework:** NestJS (TypeScript). All endpoints are implemented as NestJS controllers with guards for authentication and pipes for validation.
*   **Authentication:** Public (Rate-limited), Admin (JWT Bearer Token via `@UseGuards(JwtAuthGuard)`).
*   **Localization:** Support for `?lang=en|hi|mr|ta` in all GET requests.

---

## 2. Public API (Read-Heavy)

### 2.1 Geographic Context
*   **`GET /states`**: List of all 36 states/UTs with IDs and current election status.
*   **`GET /states/{id}/districts`**: List of all districts within a state.
*   **`GET /parties`**: List of all parties with `id`, `name`, `color`, and `symbol_url`. Used by the FE for map legends and `<PartyIcon />` rendering.

### 2.2 Elections & Manifests
*   **`GET /elections`**: List all elections. Supports filters: `?type=LS|VS`, `?status=Upcoming|Live|Finalized`, `?state_id={id}`, `?year={year}`.
*   **`GET /elections/{id}`**: Election-level metadata and tally counts.
*   **`GET /elections/{id}/manifest`**: Full JSON manifest for rendering the Map and UI theme.

### 2.3 Results & Real-time Tallies
*   **`GET /elections/{id}/results`**: Optimized Lead/Won/Margin status for all constituencies.
*   **`GET /elections/{id}/alliances`**: Alliance-wise seat distribution (NDA, INDIA, Others).
*   **`GET /elections/{id}/vote-share`**: Party-wise total votes polled and percentage share. Powers the Vote Share pie/donut charts.
*   **`GET /elections/{id}/districts/{district_id}/results`**: District-wise performance rollup.
*   **`GET /elections/{id}/constituencies/{const_id}`**: Full view (all candidates, voter turnout, historical winner).

### 2.4 Search & Analysis
*   **`GET /search/constituencies?q={query}&district_id={id}`**: Search by name or PIN code.
*   **`GET /search/candidates?q={query}`**: Direct search for VIP candidates.
*   **`GET /elections/{id}/compare?to={prev_id}`**: Swing analysis between two election years.

---

## 3. Admin API (Write-Heavy)
All admin endpoints require `@UseGuards(JwtAuthGuard, RolesGuard)`. Role requirements noted per endpoint.

### 3.1 Election Lifecycle
*   **`POST /admin/elections`**: Create a new election entry. *(SUPER_ADMIN)*
*   **`PATCH /admin/elections/{id}`**: Update election metadata (name, tentative_next_date, status). *(SUPER_ADMIN)*
*   **`POST /admin/elections/{id}/finalize`**: Transition election from `Live` → `Finalized`. Archives live cache to permanent records. *(SUPER_ADMIN)*

### 3.2 Manifest Management
*   **`GET /admin/elections/{id}/manifest`**: Get current manifest (draft or published).
*   **`PUT /admin/elections/{id}/manifest`**: Save manifest (creates new version, saved as `draft`). *(EDITOR+)*
*   **`POST /admin/elections/{id}/manifest/publish`**: Promote current draft to `published`. *(SUPER_ADMIN)*

### 3.3 Master Data Management
*   **`POST /admin/data/import`**: Bulk import via CSV (Candidates, Districts, Constituencies, Historical). *(EDITOR+)*
*   **`POST /admin/parties`**: Create a new party. *(EDITOR+)*
*   **`PUT /admin/parties/{id}`**: Update party details (name, color, symbol). *(EDITOR+)*
*   **`POST /admin/candidates`**: Create individual candidate entry. *(EDITOR+)*
*   **`PUT /admin/candidates/{id}`**: Update candidate details. *(EDITOR+)*
*   **`POST /admin/elections/{id}/geojson`**: Upload GeoJSON map file for an election. *(SUPER_ADMIN)*

### 3.4 Alliance Management
*   **`PUT /admin/elections/{id}/alliances`**: Manage election-specific alliances and their member parties. *(EDITOR+)*

### 3.5 Live Operations
*   **`PATCH /admin/results/override`**: Force update a lead/win during counting (manual override). *(EDITOR+)*

### 3.6 Scraper Control
*   **`GET /admin/scrapers/status`**: Health and lag monitoring of active scrapers.
*   **`POST /admin/scrapers/toggle`**: Start/Stop/Pause a scraper job. *(SUPER_ADMIN)*

### 3.7 User Management
*   **`GET /admin/users`**: List all admin users. *(SUPER_ADMIN)*
*   **`POST /admin/users`**: Create a new admin user (email, name, role). *(SUPER_ADMIN)*
*   **`PATCH /admin/users/{id}`**: Update user role or details. *(SUPER_ADMIN)*
*   **`DELETE /admin/users/{id}`**: Deactivate an admin user. *(SUPER_ADMIN)*

### 3.8 Person Identity Management
*   **`GET /admin/persons?q={name}`**: Search for existing persons (cross-election identity). *(EDITOR+)*
*   **`POST /admin/persons`**: Create a new person record. *(EDITOR+)*
*   **`PUT /admin/persons/{id}`**: Update person metadata (bio, education). *(EDITOR+)*
*   **`POST /admin/persons/merge`**: Merge two person records (e.g., duplicate entries from different elections). Body: `{ "keep_id": "...", "merge_id": "..." }`. *(SUPER_ADMIN)*

### 3.9 Audit Logs
*   **`GET /admin/audit-logs`**: Query audit logs with filters (`?user_id=`, `?action=`, `?entity_type=`, `?from=`, `?to=`). *(SUPER_ADMIN)*

---

## 4. SSE - Server-Sent Events (Live Push)
NestJS SSE controller using the `@Sse()` decorator and returning an `Observable<MessageEvent>`.

*   **Endpoint:** `GET /api/v1/live/updates?election_id={id}`
*   **Content-Type:** `text/event-stream`
*   **NestJS Pattern:**
    ```typescript
    @Controller('live')
    export class LiveUpdatesController {
      constructor(private readonly resultsService: ResultsService) {}

      @Sse('updates')
      updates(@Query('election_id') electionId: string): Observable<MessageEvent> {
        return this.resultsService.getResultStream(electionId);
      }
    }
    ```
*   **Event Types:**
    *   `result-update`: Individual constituency result change.
    *   `tally-update`: Alliance-level seat count change.
*   **Payload:** `{ "const_id": "UP_01", "p": "BJP", "m": 12000, "s": "L", "f": true }` where `f` is "is_flip".
*   **Backed by:** Redis pub/sub — the standalone scraper service publishes invalidation events, the NestJS API subscribes and fans out to connected SSE clients.
