# Implementation & Engineering Standards

## 1. Architectural Principles (SOLID)
Every module and class must adhere to SOLID principles to ensure the system remains "Reusable" for any election. NestJS's module system naturally supports these principles.
*   **Single Responsibility:** Separate the Scraper logic (standalone Node.js service) from the Result Calculation (NestJS business logic). Each NestJS module (e.g., `ElectionsModule`, `ResultsModule`) owns a single domain.
*   **Open/Closed:** The `ScraperHub` must be open for new `Adapters` (e.g., ECI, NewsAPI) without modifying the core engine. In NestJS, use custom providers and the `@Injectable()` pattern to register new adapters.
*   **Liskov Substitution:** Any `ElectionAdapter` must be interchangeable without breaking the `IngestionPipeline`. Use NestJS injection tokens (`provide: 'SCRAPER_ADAPTER'`) for swappable implementations.
*   **Interface Segregation:** The Frontend should only consume specific, optimized view-models (e.g., `MapData`, `TallyData`) rather than the raw DB entities. NestJS controllers return DTOs, not entity objects.
*   **Dependency Inversion:** High-level modules (Services) must depend on Abstractions (Interfaces), not low-level implementations. Use NestJS's DI container — inject `ILogger`, `IResultsRepository` interfaces via constructor injection.

## 2. Domain-Based Error Handling
We will use a functional approach to error handling to avoid "Exception Hell."
*   **Domain Errors:** Create a hierarchy of custom errors (e.g., `ElectionNotFound`, `ManifestValidationError`, `ScraperConnectionTimeout`).
*   **Boundary Handling:** Catch low-level technical errors (e.g., `PG_CONNECTION_ERROR`) at the infrastructure layer and wrap them in Domain Errors before they reach the Service/UI layer.
*   **User Feedback:** Map Domain Errors to clear, non-technical HTTP status codes and messages for the frontend.

## 3. Observability & Logging
Structured logging is mandatory for tracking high-frequency election updates.
*   **Structured Logs (JSON):** All logs must be in JSON format for easy ingestion by ELK/Loki.
*   **Contextual Logging:** Every log entry must include `request_id`, `election_id`, and `trace_id`.
*   **Log Levels:** 
    *   `DEBUG`: Scraper raw payloads (only in dev).
    *   `INFO`: Successful tally updates, manifest reloads.
    *   `WARN`: Rate-limiting triggers, minor scraper retries.
    *   `ERROR`: Data validation failures, database timeouts.
    *   `FATAL`: Manifest missing, core DB down.

## 4. OLTP Metrics & Monitoring
Since this is a high-traffic, transaction-heavy system, we must monitor:
*   **Throughput:** Requests per second (RPS) for the Results API.
*   **Latency (p95/p99):** Time taken to serve the GeoJSON + Results payload.
*   **DB Pool Health:** Connection pool saturation and transaction commit latency.
*   **Scraper Lag:** The time delta between "ECI Timestamp" and "Our DB Timestamp."
*   **Cache Hit Ratio:** Effectiveness of Redis for the Live Tally.

## 5. Coding Standards
*   **Type Safety:** Strict TypeScript for all services (NestJS backend, public React frontend, admin React frontend, scraper service).
*   **Immutability:** Prefer immutable data structures for result processing to prevent side effects.
*   **NestJS Conventions:**
    *   Use decorators consistently: `@Controller()`, `@Injectable()`, `@Module()`, `@Guard()`.
    *   Follow the NestJS module structure: each domain has its own module with dedicated controllers, services, and DTOs.
    *   Use dependency injection via constructor parameters — never instantiate services manually.
    *   Use Guards (`@UseGuards(JwtAuthGuard)`) for route protection, Pipes for validation (`ValidationPipe`), and Interceptors for response transformation.
    *   Define DTOs with `class-validator` decorators for all request/response shapes.
*   **Testing:**
    *   **Unit Tests:** For business logic (e.g., margin calculation). Use NestJS `Test.createTestingModule()` for service tests.
    *   **Integration Tests:** For the Scraper -> DB pipeline and NestJS controller flows.
    *   **Performance Tests:** Simulate 100k+ concurrent users on the Results API.

## 6. Project Structure
The project is organized as a multi-package repository with four services:

```
matdaanpulse/
├── backend/                      # NestJS API Server
│   ├── src/
│   │   ├── app.module.ts         # Root module
│   │   ├── elections/            # ElectionsModule (controller, service, DTOs)
│   │   ├── results/              # ResultsModule (controller, service, SSE)
│   │   ├── states/               # StatesModule (states, districts)
│   │   ├── manifests/            # ManifestsModule (CRUD, draft/publish)
│   │   ├── candidates/           # CandidatesModule (CRUD, persons linking)
│   │   ├── parties/              # PartiesModule (CRUD)
│   │   ├── auth/                 # AuthModule (JWT guards, strategies, RBAC)
│   │   ├── admin/                # AdminModule (import, overrides, audit logs)
│   │   ├── live/                 # LiveModule (SSE controller, Redis subscriber)
│   │   ├── common/               # Shared pipes, interceptors, filters
│   │   └── main.ts               # Bootstrap
│   ├── nest-cli.json
│   └── package.json
├── frontend/                     # Public React + Vite SPA
│   ├── src/
│   │   ├── components/           # Atomic design (atoms, molecules, organisms)
│   │   ├── hooks/                # useSSE, useElectionData
│   │   ├── pages/                # MapView, ConstituencyDetail
│   │   ├── services/             # API client
│   │   ├── i18n/                 # react-i18next + locale JSON files
│   │   ├── theme/                # Light/Dark mode provider
│   │   └── types/                # Shared interfaces
│   ├── vite.config.ts
│   └── package.json
├── admin/                        # Admin React + Vite SPA (separate app)
│   ├── src/
│   │   ├── components/           # Wizard, Editor, ManifestEditor, LogViewer
│   │   ├── pages/                # Elections, Scrapers, DataImport, AuditLogs
│   │   ├── services/             # Admin API client
│   │   └── types/                # Admin-specific interfaces
│   ├── vite.config.ts
│   └── package.json
├── scraper/                      # Standalone Node.js Scraper Service
│   ├── src/
│   │   ├── adapters/             # ECI, NewsAPI adapters
│   │   ├── normalizer/           # Data normalization logic
│   │   ├── scheduler/            # Cron-based job scheduling
│   │   ├── db/                   # PostgreSQL writer
│   │   ├── cache/                # Redis pub/sub publisher
│   │   └── index.ts              # Entry point
│   └── package.json
└── docs/                         # Documentation
```
