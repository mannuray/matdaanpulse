# High-Level Design (HLD) - Election Tracker

## 1. System Architecture Overview
The platform follows a **Metadata-Driven Architecture** designed for high reusability and horizontal scalability. It uses a **Split-Data Model**, separating static configuration (Manifest) from high-frequency results (Database).

### Architecture Diagram (Abstract)
```text
[Public SPA (React+Vite)] <--- (SSE) --- [NestJS API] <--- [PostgreSQL]
        |                                     ^    |
        |--- (HTTP/CDN) --- [S3/CDN] ---------|    |--- [Redis (Cache + Pub/Sub)]
                                              |                  ^
[Admin SPA (React+Vite)] --- (REST/JWT) ------|                  |
                                                                 |
[Scraper Service (Node.js)] --- [PostgreSQL] --- [Redis] --------|
```
*   **Public SPA:** Vite-bundled TypeScript frontend with D3.js SVG choropleths. Public-facing, read-only.
*   **Admin SPA:** Separate Vite-bundled React app for election management, manifest editing, scraper control, and data imports. JWT-protected.
*   **NestJS API:** Main backend serving both public REST endpoints + SSE streams and admin write endpoints.
*   **Scraper Service:** Standalone Node.js process that writes to PostgreSQL and pushes cache invalidations to Redis.
*   **Redis:** Shared between NestJS API (caching, SSE pub/sub) and Scraper Service (cache invalidation signals).

## 2. Core Components

### 2.1 The "Metadata Store" (Manifest Service)
*   **Purpose:** Decouples UI configuration from the application code.
*   **Format:** Versioned JSON files (`election_id.json`).
*   **Content:** Alliance groupings, VIP seat IDs, map file URLs, and UI color schemes.
*   **Storage:** Served from a CDN/S3 for ultra-low latency.

### 2.2 The Ingestion Layer (Standalone Scraper Service)
The scraper runs as a **separate standalone Node.js service**, independent of the NestJS backend. It has its own process lifecycle, deployment, and scaling.
*   **Modular Adapters:** Individual workers for ECI (Scraping), News APIs (Structured Data), and Admin Overrides.
*   **Normalization Engine:** Converts raw source data into a standard internal `Results` schema.
*   **Rate Limiting:** Dynamically adjustable scraping frequency based on the election status (Live vs. Historical).
*   **Communication:** Writes normalized results directly to PostgreSQL and publishes cache invalidation events to Redis (pub/sub), which the NestJS API subscribes to for SSE push.

### 2.3 The Delivery Layer (NestJS Backend API)
*   **Stateless Services:** NestJS (TypeScript) modules designed for high-concurrency read requests.
*   **Cache Strategy:**
    *   **L1 Cache (Redis):** Stores "Live Tally" and "Constituency Status" (5-30s TTL).
    *   **L2 Cache (CDN):** Stores GeoJSON maps and historical results (24h+ TTL).

### 2.4 The Admin Control Center (Separate SPA)
The Admin Panel is a **separate React + Vite SPA**, independently built and deployed from the public frontend. It communicates with the same NestJS API via JWT-protected admin endpoints.
*   **Election Lifecycle:** Manages the transition from `Upcoming` -> `Live` -> `Finalized`.
*   **Data Integrity:** Implements RBAC (Super Admin, Editor, Viewer) and persistent Audit Logs for all manual data overrides.
*   **User Management:** Super Admins can create/manage admin accounts and assign roles.

## 3. Map Intelligence Engine (React + D3.js)
*   **Choropleth Rendering:** Uses D3.js exclusively to draw SVG choropleths (no Leaflet/Canvas). GeoJSON is projected and rendered as inline SVG paths within React components.
*   **Heatmap Logic:** Dynamically calculates fill opacity based on the `margin_of_victory` field in the results JSON using D3 color scales (light/white for razor-thin margins → deep party color for bumper majorities).
*   **Visual Overlays:** Conditional rendering of SVG badges (Stars for VIP, Flames for Hot Contests, Shields for Fortress Seats, Circular Arrows for Flips) based on Manifest metadata.
*   **Map Filter Layers:** Toggleable views — Live Trends (default), Swing Layer (seat flips), Vulnerability Layer (safe vs. battleground), Demographic Layer (GEN/SC/ST).
*   **Pulse Animation:** On counting day, constituencies where the lead has just changed glow/pulse for ~30 seconds, creating a "living map" effect.

## 4. Scalability & Availability
*   **Horizontal Scalability:** NestJS API pods can be scaled independently based on CPU/Memory usage. The standalone scraper service scales separately based on ingestion load.
*   **Read Replicas:** Database read-heavy operations are directed to dedicated read replicas.
*   **SSE Scaling:** Redis pub/sub enables multiple NestJS instances to fan out SSE events consistently across all connected clients.
*   **Failover Strategy:** If the primary scraper fails, the system switches to the "Manual Override" or "Backup API" source.

## 5. Security Design
*   **JWT-Based Auth:** Secure access for Admin and Editor roles.
*   **DDoS Protection:** Leveraging CDN (Cloudflare) for edge-level security.
*   **Data Validation:** Strict JSON schema validation for all Manifest and Scraper updates.
