# MatdaanPulse - Project Requirements Document (PRD)

## 1. Project Overview
A reusable, metadata-driven election tracking platform designed specifically for Indian State Assembly (Vidhan Sabha) and Parliamentary (Lok Sabha) elections. The system must handle historical data analysis and real-time counting day updates with high scalability.

## 2. Target Audience
*   **General Public:** High-performance, intuitive interface for following live results and historical trends.
*   **Admin/Editors:** Internal team managing the election configurations, candidate data, and manual overrides.

## 3. Core Functional Requirements

### 3.1 Public Front-End (FE)
*   **Dual-Tab Navigation:** Toggle between Lok Sabha (National) and State (Assembly) views.
*   **Election Switcher:** Global dropdown to switch between elections (e.g., "Lok Sabha 2024" → "UP Assembly 2022"). The entire FE re-renders based on the selected election's metadata/manifest.
*   **Tenure & Countdown View:** Shows current Parliament/Assembly composition and a countdown to the next tentative election date (e.g., "May 2029").
*   **Interactive Choropleth Maps:**
    *   **Intensity-Based Heatmap:** Color opacity driven by the margin of victory (light/white for razor-thin margins, deep color for bumper majorities).
    *   **Drill-down:** From National map to State map to Constituency details.
    *   **Visual Badges:** Special icons for "VIP Seats" (star), "Hot Contests" (flame), "Fortress/Safe Seats" (shield), and "Flips" (circular arrow).
    *   **Map Filter Layers:** Toggle between:
        *   *Live Trends:* Current leads/wins with intensity.
        *   *Swing Layer:* Highlights only seats where the party has changed from the previous election.
        *   *Vulnerability Layer:* Safe Seats vs. Battlegrounds based on historical margins.
        *   *Demographic Layer:* Colors by constituency category (GEN, SC, ST).
    *   **Pulse Animation:** Constituencies where a lead has just changed glow/pulse for ~30 seconds on counting day.
*   **Live Dashboard (Counting Day):**
    *   **Alliance Tallies:** Lead/Won status for major alliances (e.g., NDA vs. I.N.D.I.A).
    *   **Majority Indicator:** Visual progress toward the 272 (LS) or state-specific majority mark.
    *   **Key Battles Ticker:** Horizontal scroll of high-profile constituencies and their live status.
    *   **Real-time Updates:** Push updates via SSE (Server-Sent Events) without page refreshes.
*   **Historical Analysis:**
    *   **Time-Machine Toggle:** View results from 2014, 2019, etc.
    *   **Swing Visualization:** Indicators showing seat shifts between parties compared to previous elections.
    *   **Vote Share Charts:** Pie/Donut charts showing percentage of total votes polled by each party.
*   **Candidate Profiles:** Comprehensive details (age, assets, criminal records) pulled from ECI metadata. Includes performance history across previous elections.
*   **UX Enhancements:**
    *   **Dark Mode:** Toggle for dark theme support.
    *   **Social Sharing:** One-click "Share this result" for WhatsApp/Twitter.

### 3.2 Admin Panel (Separate SPA)
*   **Election Configurator:** Wizard to create new elections, upload GeoJSON maps, and define majority marks.
*   **Manifest Manager:** GUI to edit the `election_manifest.json` (Alliance grouping, VIP seat tagging).
*   **Master Data Management:** Bulk CSV/Excel imports for parties, constituencies, and candidate lists.
*   **Scraper Control Center:** Manage, monitor, and adjust the frequency of the standalone scraper service (ECI/News scrapers). The scraper runs as an independent Node.js process, separate from the main backend.
*   **Manual Overrides:** Capability to "Force Update" leads/wins during high-traffic counting windows.
*   **Draft vs. Published:** Manifest changes can be saved as a "Draft" and only "Published" to the live site when ready.
*   **Finality Switch:** Transition an election from `Live` to `Finalized`, moving data from live cache to permanent historical record.

## 4. Non-Functional Requirements (NFRs)
*   **Reusability (Metadata-Driven):** No hardcoded state or election logic; the entire UI and BE must re-render based on a JSON Manifest.
*   **Responsive Design:** The web application must work seamlessly on both desktop and mobile browsers. Layouts adapt to screen size (responsive CSS), but desktop is the primary design target. Maps use touch-friendly gestures (pinch-zoom, tap drill-down) on mobile.
*   **Horizontal Scalability:** Stateless architecture to handle millions of concurrent users during counting day peak.
*   **Read-Heavy Optimization:** Aggressive caching (Redis/CDN) for static historical data and short TTL for live trends.
*   **High Availability:** Database read-replicas and modular scrapers with error-handling.
*   **Localization (i18n):** Support for 4 languages at launch — English, Hindi, and 2 regional languages. The FE uses an i18n library (e.g., `react-i18next`) with JSON translation files. API supports `?lang=` parameter.
*   **Accessibility (a11y):** ARIA labels on SVG map regions, keyboard navigation for map drill-down, screen-reader-friendly tally tables.
*   **Error/Empty States:** Graceful UI for: no live election active, scraper down/stale data (show "last updated" timestamp), no results yet for a constituency.
*   **GeoJSON Source:** Constituency boundary maps sourced from DataMeet/open-source community datasets. Admin can upload/replace GeoJSON files per election via the admin panel.
*   **SEO:** Share previews and search indexing are served by a Cloudflare Pages Function: per-page title, description, Open Graph tags, JSON-LD and readable HTML for crawlers, plus `robots.txt` and sitemaps (`docs/superpowers/specs/2026-10-09-seo-design.md`). English only for now; the app itself stays a pure SPA.

## 5. Data & Integrity
*   **Source of Truth:** Dual-storage model:
    1.  **JSON Manifest:** UI configuration, alliances, and VIP metadata.
    2.  **Relational Database:** Hard counts, candidate IDs, and relational historical data.
*   **Audit Trails:** Mandatory logging for all admin actions (who changed what and when).
*   **Role-Based Access (RBAC):** Super Admin, Editor, and Viewer roles.

## 6. Technical Stack
*   **Public Front-End:** React + Vite (TypeScript SPA), D3.js for SVG choropleths, react-i18next for localization.
*   **Admin Front-End:** Separate React + Vite (TypeScript SPA) for election management and data operations.
*   **Back-End:** NestJS (TypeScript) for the main API server (serves both public and admin APIs).
*   **Scraper Service:** Standalone Node.js service for ECI/News data ingestion (separate process from the main backend).
*   **Real-time:** SSE (Server-Sent Events) for live push updates.
*   **Database:** PostgreSQL (Core) + Redis (Live Cache & SSE pub/sub).
*   **Infrastructure:** CDN (Cloudflare/AWS CloudFront) for GeoJSON and static assets.
