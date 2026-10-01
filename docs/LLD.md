# Low-Level Design (LLD) - MatdaanPulse

## 1. Data Schema (PostgreSQL)

### 1.1 `states` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Int (PK) | Unique state ID |
| `name` | String | e.g., "Uttar Pradesh" |
| `code` | String (Unique) | Short code (e.g., `UP`, `MH`, `KA`) |
| `total_assembly_seats` | Int | Total Vidhan Sabha seats (e.g., 403 for UP) |
| `total_ls_seats` | Int | Lok Sabha seats allocated to this state |

### 1.2 `districts` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | Int (PK) | Unique district ID |
| `state_id` | Int (FK) | FK to `states` |
| `name` | String | e.g., "Lucknow", "Pune" |
| `code` | String (Unique) | Short code (e.g., `LKO`, `PUN`) |

### 1.3 `elections` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique election identifier (e.g., `LS_2024`) |
| `name` | String | e.g., "Lok Sabha 2024" |
| `type` | Enum | `LS` (Lok Sabha), `VS` (Vidhan Sabha) |
| `state_id` | Int (FK) | FK to `states`. Nullable for LS. |
| `year` | Int | Election year |
| `status` | Enum | `Upcoming`, `Live`, `Finalized` |
| `tentative_next_date` | Date | Tentative date for the next election in this cycle (e.g., 2029-05-01 for LS). Nullable. Used for countdown display. |
| `manifest_url`| String | URL to the JSON configuration |

### 1.4 `parties` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String (PK) | Party short code (e.g., `BJP`, `INC`) |
| `name` | String | Party full name |
| `color` | String | Hex color code (e.g., `#FF9933`). Used as base color for heatmap intensity. |
| `symbol_url` | String | Path to SVG/PNG symbol |

### 1.5 `constituencies` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | String (PK) | Composite ID: `ELECTION_ID` + `CONST_NO` |
| `election_id` | FK | Links to `elections` |
| `district_id` | Int (FK) | FK to `districts`. Enables district-wise rollup. |
| `name` | String | Constituency name |
| `const_no` | Int | Official ECI number |
| `type` | Enum | `GEN`, `SC`, `ST` |
| `voter_turnout`| Decimal | Voter turnout percentage (updated post-counting) |

### 1.6 `persons` Table (Cross-Election Identity)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique person ID |
| `name` | String | Canonical name (e.g., "Narendra Modi") |
| `metadata` | JSONB | Persistent bio: date of birth, education, etc. |

### 1.7 `candidates` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique candidate entry (per election) |
| `person_id` | UUID (FK) | FK to `persons`. Links the same individual across elections for historical tracking. |
| `election_id` | FK | Links to `elections` |
| `const_id` | FK | Links to `constituencies` |
| `party_id` | FK | Links to `parties` |
| `name` | String | Candidate's name as on ballot |
| `is_incumbent` | Boolean | If the candidate won this seat last time |
| `metadata` | JSONB | Election-specific data: assets declared, criminal cases (ECI affidavit) |

### 1.8 `results` (The High-Traffic Table)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique result ID |
| `candidate_id` | FK | Links to `candidates` |
| `const_id` | FK | Links to `constituencies` |
| `votes` | Int | Current vote count |
| `status` | Enum | `LEADING`, `WON`, `TRAILING`, `LOST` |
| `margin` | Int | Derived: Current vote difference from leading candidate |
| `round_no` | Int | Current counting round (for live updates) |
| `last_updated` | Timestamp | For cache invalidation |

### 1.9 `users` Table (Admin RBAC)
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique user ID |
| `email` | String (Unique) | Login email |
| `password_hash` | String | Bcrypt hashed password |
| `role` | Enum | `SUPER_ADMIN`, `EDITOR`, `VIEWER` |
| `name` | String | Display name |
| `created_at` | Timestamp | Account creation time |

### 1.10 `audit_logs` Table
| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID (PK) | Unique log entry ID |
| `user_id` | UUID (FK) | FK to `users`. Who performed the action. |
| `action` | String | e.g., `RESULT_OVERRIDE`, `MANIFEST_PUBLISH`, `ELECTION_FINALIZE` |
| `entity_type` | String | e.g., `result`, `manifest`, `election`, `candidate` |
| `entity_id` | String | ID of the affected record |
| `old_value` | JSONB | Previous state (nullable for creates) |
| `new_value` | JSONB | New state |
| `timestamp` | Timestamp | When the action occurred |

## 2. Manifest Structure (`election_manifest.json`)
The Manifest defines the UI and organizational metadata for each election.

```json
{
  "id": "LS_2024",
  "version": 3,
  "status": "published",
  "display_name": "Lok Sabha Elections 2024",
  "type": "LS",
  "alliances": [
    { "id": "NDA", "name": "NDA", "color": "#FF9933", "parties": ["BJP", "JDU", "SHS"] },
    { "id": "INDIA", "name": "I.N.D.I.A", "color": "#19AAED", "parties": ["INC", "SP", "DMK"] }
  ],
  "vip_seats": {
    "UP_VARANASI": { "label": "PM Seat", "candidate": "Narendra Modi" },
    "KL_WAYANAD": { "label": "Rahul Gandhi", "candidate": "Rahul Gandhi" }
  },
  "geo": {
    "map_url": "/assets/maps/india_ls.geojson",
    "center": [20.59, 78.96],
    "zoom": 4
  },
  "milestones": [
    { "label": "Majority", "value": 272 },
    { "label": "Two-Thirds", "value": 362 }
  ],
  "compare_with": ["LS_2019", "LS_2014"]
}
```
*   **`version`:** Auto-incremented on each save. Enables rollback.
*   **`status`:** `draft` or `published`. Only `published` manifests are served to the public FE. Draft manifests are visible only in the Admin panel.

## 3. Scraper Service Architecture (Standalone Node.js)
The scraper runs as an **independent Node.js service** with its own process, separate from the NestJS backend. It connects directly to PostgreSQL and Redis.

### 3.1 Service Design
*   **Process Model:** Long-running Node.js process with a scheduler (e.g., `node-cron`) that triggers scrape cycles at configurable intervals.
*   **Communication:** Writes normalized results directly to PostgreSQL. Publishes cache invalidation events to Redis pub/sub channels (e.g., `results:updated:{election_id}`), which the NestJS API subscribes to for SSE broadcasting.
*   **Independent Scaling:** Can be scaled horizontally with partition-based work distribution (e.g., each instance handles a subset of constituencies).

### 3.2 Adapter Logic
*   **Adapter Interface:** Defines `fetch()`, `normalize()`, and `validate()` methods.
*   **ECI Adapter:**
    *   Uses Puppeteer or Cheerio to scrape `results.eci.gov.in`.
    *   Targets specific DOM elements for "Party Wise" and "Constituency Wise" data.
*   **Normalizer:**
    *   Cleans candidate names and maps parties to our internal IDs.
    *   Calculates the "Margin" field before saving to the DB.

## 4. Public Front-End Component Design (React + Vite, Atomic)
The public-facing frontend is a **React + Vite** TypeScript SPA using D3.js for all map rendering (SVG choropleths, no Leaflet). The Admin Panel is a separate SPA (see §5).

### 4.0 Project Structure
```
frontend/                           # Public-facing SPA
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root with routing
│   ├── components/
│   │   ├── atoms/                # PartyIcon, StatusBadge
│   │   ├── molecules/            # CandidateCard, TallyCard
│   │   └── organisms/            # InteractiveMap, ElectionSidebar
│   ├── hooks/                    # useSSE, useElectionData, useManifest
│   ├── services/                 # API client, SSE connection
│   ├── pages/                    # MapView, ConstituencyDetail
│   ├── i18n/                     # react-i18next setup
│   │   └── locales/              # en.json, hi.json, ta.json, mr.json
│   ├── theme/                    # Light/Dark mode CSS variables, theme provider
│   └── types/                    # Shared TypeScript interfaces
```

### 4.1 Atoms
*   `<PartyIcon />`: Small SVG/PNG party symbol.
*   `<StatusBadge />`: Color-coded labels (Won, Leading, Trailing).

### 4.2 Molecules
*   `<CandidateCard />`: Candidate details with a margin progress bar.
*   `<TallyCard />`: Summary row for an alliance (e.g., NDA: 275 Won).

### 4.3 Organisms
*   `<InteractiveMap />`: D3.js SVG choropleth with hover tooltips and heatmaps. Uses `d3-geo` for projection and `d3-scale` for color mapping. No Leaflet.
*   `<ElectionSidebar />`: Filters, search, and "Key Battle" ticker.

## 5. Admin Panel Modules
The Admin Panel is a **separate React + Vite SPA** with its own build and deployment, independent from the public frontend. Protected behind JWT authentication.
*   **Wizard:** Step-by-step form to bootstrap a new election.
*   **Editor:** Table view of all constituencies with bulk edit capabilities.
*   **Manifest Editor:** GUI to edit alliances, VIP seats, milestones. Supports **Draft vs. Published** workflow — changes are saved as draft and only go live when explicitly published.
*   **Finality Switch:** Transition an election from `Live` → `Finalized`, archiving live cache data into permanent historical records.
*   **User Management:** Create/edit admin accounts and assign roles (Super Admin, Editor, Viewer).
*   **Person Identity Manager:** Search, create, and merge cross-election person records for historical candidate tracking.
*   **Logs:** A searchable stream of all data modifications (Audit Trail).

## 6. Implementation Strategy
1.  **Phase 1: Database Setup:** Implement the full PostgreSQL schema (states, districts, elections, parties, persons, candidates, results, users, audit_logs) and initial migrations.
2.  **Phase 2: NestJS Backend:** Scaffold NestJS project with core modules (Elections, Results, Manifests, Auth/RBAC, Admin, States). Develop REST controllers, services, guards, and DTOs.
3.  **Phase 3: Scraper Service MVP:** Build the standalone Node.js scraper service with ECI adapter, PostgreSQL writer, and Redis pub/sub publisher.
4.  **Phase 4: Public Frontend (React + Vite):** Scaffold Vite project with i18n (react-i18next, 4 languages), dark/light theme, responsive layout, D3.js SVG map integration, and election switcher.
5.  **Phase 5: Admin Frontend (React + Vite):** Build the separate Admin SPA — election wizard, manifest editor (draft/publish), master data management, scraper control, audit log viewer.
6.  **Phase 6: Live Features:** Implement NestJS SSE controller, Redis subscription for cache invalidation, frontend `useSSE` hook, pulse animations, and real-time heatmap updates.
