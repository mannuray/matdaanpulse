# SEO and share previews — design

Date: 2026-10-09 · Status: implemented (plan `docs/superpowers/plans/2026-10-09-seo.md`)

## Goal

1. **Share previews first.** A link pasted in WhatsApp, X or Telegram shows a page-specific title, description and image
   card. Counting day (27 Feb 2027) is when sharing peaks.
2. **Search second.** Google can index every election, constituency, person and party page with real content
   ("Hajipur 2025 result", a candidate's name).

Today the public frontend is a client-rendered SPA: every route returns the same `index.html` with only
`<title>MatdaanPulse</title>`; no description, Open Graph tags, `robots.txt` or sitemap. `docs/REQUIREMENTS.md`
records SEO as deliberately deferred; this design ends that deferral.

## Decisions

| # | Decision | Why |
|---|----------|-----|
| S1 | Edge-rendered SEO HTML in a **Cloudflare Pages Function** (not SSR, not build-time prerender) | ~10k+ constituency pages and tens of thousands of person pages exceed Pages' 20,000-file limit for prerendering, and results change; full SSR is a large restructure (client-side viewmodels, D3) too close to counting day |
| S2 | Cloudflare only; no Vercel adapter | The move to Cloudflare Pages happens before counting day (D13); Vercel is testing-only |
| S3 | Canonical origin **`https://matdaanpulse.in`** | `www` already 301s to the apex; there is no `app.` host |
| S4 | **English-only indexing** | Language is stored in `localStorage`, not the URL; `/hi/…` URLs + hreflang are phase 2 |
| S5 | One branded OG image now; the code is shaped so phase 2 swaps in dynamic images | Gets tags, routes and caching live without the cost of image rendering |
| S6 | Workers **Free** plan until shortly before counting day, then **Workers Paid** ($5/mo, 10M requests) | The plan is an account setting with no code change; free covers 100k function requests/day |

## Architecture

```
request /election/12/constituency/45
   │
   ▼
Cloudflare Pages
   ├─ static files (/assets, /geo, /symbols, /og, robots.txt, …) → served directly, no function
   └─ page routes (/, /election/*, /person/*, /party/*, /about, /sitemap*.xml) → Pages Function
          1. edge cache hit? → return it
          2. fetch index.html (env.ASSETS) + page data from the API (2.5 s timeout)
          3. build SeoPage {status, title, description, canonical, og, jsonLd, bodyHtml}
          4. string replacement (index.html is small): tags replace <title>, bodyHtml fills #root
          5. cache with the page type's TTL → return
   on API error / timeout → plain index.html + generic tags (the site never breaks)
```

### Units

- **`frontend/edge/seo/`** — host-neutral core, pure TypeScript, no Cloudflare or React types.
  - `routes.ts` — `matchRoute(pathname, search)` → `{ kind: 'home' | 'election' | 'constituency' | 'person' | 'party' | 'about' | 'sitemap…', params }` or `null`.
  - `pages/<kind>.ts` — one builder per page type: `(params, apiData) → SeoPage`. They may import from
    `frontend/src/model` (already pure) to reuse names, `partyPageHref`, formatting and `SHOWN_HOUSES`, so the text
    cannot drift from the app.
  - `html.ts` — `escapeHtml`, `renderHead(SeoPage)`, small body-markup helpers. Every interpolated value goes
    through `escapeHtml`; JSON-LD is serialised with `<` escaped as `<`.
  - `sitemap.ts` — sitemap index and child sitemaps from API lists.
  - `api.ts` — typed fetchers for the endpoints below, taking a `fetch` and base URL (injectable for tests).
  - `site.ts` — `SITE_ORIGIN = 'https://matdaanpulse.in'`, default OG image path, site name.
- **`frontend/functions/[[path]].ts`** — the thin Cloudflare adapter: cache lookup (`caches.default`), timeout,
  `env.ASSETS.fetch('/index.html')`, `HTMLRewriter` injection, response headers, cache store.
- **`frontend/public/_routes.json`** — `include` only page routes and sitemap paths, so the function never runs for
  assets, maps or symbols.
- **`frontend/public/robots.txt`**, **`frontend/public/og/default.png`** (1200×630, branded) — static.
- `frontend/edge` is outside `src`, so the MVVM lint boundaries don't apply; it imports only from `src/model`, and a
  lint rule (or test) forbids imports from `src/viewmodels`, `src/views` and `src/pages`.
- The function reads the API origin from a Pages environment variable `SEO_API_BASE_URL` (same value as
  `VITE_API_BASE_URL`).

### Data sources

Existing public endpoints:

| Page | Endpoints |
|------|-----------|
| home | `GET /elections` |
| election | `GET /elections/:id`, `GET /elections/:id/results` (or the versioned snapshot via `/live`), `GET /elections/:id/alliances` |
| constituency | `GET /elections/:id/constituencies/:constId` (+ seat history if not included) |
| person | `GET /candidates/persons/:id` |
| party | `GET /parties/:id/record` (`?state=XX` honoured) |
| sitemaps | `GET /elections`, election results/constituency lists, party list `GET /parties` |

No backend change: person URLs come from `GET /elections/:id/results`, whose rows carry `person_id`.

## What each page sends

| Route | `<title>` / description | Body HTML in `#root` | JSON-LD |
|-------|-------------------------|----------------------|---------|
| `/` | "MatdaanPulse — Live Indian election results, maps & constituency history" | H1, list of shown elections (links), one-line about | `WebSite` |
| `/election/:id` | "Bihar Assembly Election 2025 Results — NDA 202, MGB 35 \| MatdaanPulse"; description: alliance/party seat tally, turnout, counting date | H1, alliance + party tally table, every seat with winner and party (links to each seat) | `BreadcrumbList` |
| `/election/:id/constituency/:c` | "Hajipur Assembly Election Result 2025 — Winner, Margin & Votes \| MatdaanPulse"; description: "X (BJP) won Hajipur in 2025 by N votes over Y (RJD)…" | H1, result sentence, candidates table (name → person link, party → party link, votes, % (derived from votes when the API sends none)), earlier winners of the seat (person links; history entries carry no seat ids) | `BreadcrumbList` |
| `/person/:id` | "Name — Election history, wins & constituencies \| MatdaanPulse"; description: party, contests, wins | H1, contest list (year, seat, party, result) with links | `Person`, `BreadcrumbList` |
| `/party/:id` | "Party Name (ABBR) — Election results & seat history \| MatdaanPulse"; description: recent tallies | H1, per-election seats table with links | `Organization`, `BreadcrumbList` |
| `/about` | static title and description | none (the SPA renders it) | — |

Rules:

- **Counting day.** For an election that is counting, election and seat pages use live wording ("Counting: BJP leads
  in Hajipur by 2,340 after round 12"; "Counting: NDA leads 142, MGB 98") from the same `/live` version and versioned
  snapshot the app uses.
- **Open Graph / Twitter** on every page: `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`
  (canonical), `og:image` = `https://matdaanpulse.in/og/default.png` (+ width/height/alt), `twitter:card =
  summary_large_image`. The builders return the image URL as a field, so phase 2 changes one function.
- **Canonical:** `https://matdaanpulse.in` + path, query string dropped, except `?state=XX` on party pages.
- **Body HTML** is plain semantic markup (h1, p, table, ul, a) with a few tiny inline styles so it reads acceptably
  for the moment before JS loads. React's `createRoot` replaces it on mount; the app is unchanged.
- **Hidden routes and unknown ids.** Lok Sabha elections (not in `SHOWN_HOUSES`), unknown ids and malformed params →
  status 404, `noindex`, generic tags; the SPA shell still renders its own not-found page.
- `<html lang="en">` is set by the function; the user's stored language still applies after mount.

## Crawl files

- **`robots.txt`** (static): allow all; `Disallow:` the hidden Lok Sabha routes if they are path-distinguishable
  (otherwise they rely on 404 + `noindex`); `Sitemap: https://matdaanpulse.in/sitemap.xml`.
- **`/sitemap.xml`** (function): sitemap index →
  - `/sitemaps/election-<id>.xml` per shown election: the election page, every seat page and every candidate's person
    page (the largest, UP 2022, is ~5,250 URLs; limit 50,000). Persons of hidden (LS) elections only are not listed.
  - Party pages are listed in each election's sitemap (every party that contested it; no IND/NOTA), so Lok Sabha-only
    parties never appear.
  - No `lastmod` (no reliable date in the API; optional in the protocol).

## Caching

Edge cache (`caches.default`), keyed on the page's canonical path (`routeKey`: tracking parameters such as `fbclid` /
`utm_*`, trailing slashes and id case share one entry; every not-found path shares one key) plus the build id
(`CF_PAGES_COMMIT_SHA`), so a deploy invalidates it. The key does not include the results version; the 60 s TTL bounds
staleness while counting:

| Page | TTL |
|------|-----|
| Finished election and its seats | 1 day |
| Election that is counting, and its seats | 60 s |
| Person, party, home | 1 h |
| Sitemaps | 1 day; 10 min while any shown election is counting |
| Fallback after API error/timeout | not cached (or 30 s at most) |

The function sets `Cache-Control: no-cache` on the HTML it returns, so browsers always revalidate against the edge
and a new deploy's asset hashes are picked up at once.

## Errors and safety

- API timeout 2.5 s (Render cold starts). On timeout, network error or 5xx: serve plain `index.html` with the
  generic home tags and status 200; never cache it beyond 30 s.
- 404 from the API → status 404 + `noindex`.
- **Non-canonical hosts** (`*.pages.dev`, `*.vercel.app`, anything not `matdaanpulse.in`) get
  `X-Robots-Tag: noindex` on every response, and canonical tags still point to `https://matdaanpulse.in`.
- **Security headers.** Function responses carry the same headers as `public/_headers` (CSP, X-Frame-Options, …).
  JSON-LD is a non-executed data block (`type="application/ld+json"`), so `script-src 'self'` does not block it; the
  CSP is unchanged. The existing `securityHeaders.test.ts` is extended to check the function's header set matches.
- All API strings are escaped; no API value is ever placed in a raw attribute or script context unescaped.

## Plan and traffic

- Stay on the Workers **Free** plan (100k function requests/day) until about a week before counting day; then switch
  the Cloudflare account to **Workers Paid** ($5/month). No code change, no redeploy.
- Risk before then: a viral spike over 100k page loads in a day on the free plan can make page loads fail until the
  quota resets (00:00 UTC). Response: upgrade immediately.
- Only full page loads hit the function; in-app navigation is client-side.

## Measured and found during implementation

- CPU (largest election, UP 2022): own code 0.4 ms (election page) / 1.4 ms (sitemap); with JSON parsing 2.9 / 4.0 ms;
  8–9 ms in Node including its fetch/Response machinery. Estimated ~3–4 ms on Workers, under the free plan's ~10 ms;
  confirm with the dashboard's CPU-time metric after the first deploy.
- Once the origin shield is on, `SEO_API_BASE_URL` must be the Cloudflare-fronted API. All Function subrequests that miss
  the API's CDN cache share one throttle bucket (keyed on IP); a 429 gives the generic page, not an error.

## Testing

- **Unit (Vitest)** for `edge/seo`: route matching; each page builder with fixture API data (titles, descriptions,
  final vs counting wording, links, JSON-LD shape); escaping of hostile strings; 404 cases; sitemap chunking and
  XML validity.
- **Adapter test** for `functions/[[path]].ts` with mocked `ASSETS`, `fetch` and cache: head injection, root
  injection, fallback on timeout, security headers, `noindex` on non-canonical hosts, 404 status.
- **Import boundary**: `edge/` imports nothing from `src/viewmodels`, `src/views`, `src/pages`.
- **Manual on the `*.pages.dev` preview**: `curl -A Googlebot` per page type, Google Rich Results Test, WhatsApp and
  X card previews, and checking that the app still mounts and replaces the injected HTML.

## Docs to update

- `docs/FEATURES.md` — new "SEO and share previews" section.
- `docs/REQUIREMENTS.md:59` — SEO no longer deferred; point to this spec.
- `CLAUDE.md` — frontend line about `functions/` + `edge/seo/`, `_routes.json`, `SEO_API_BASE_URL`.
- `docs/DEPLOYMENT.md` — Pages env var `SEO_API_BASE_URL`; the Workers Paid switch.
- `docs/LIVE_READINESS_2027.md` — checklist item: upgrade to Workers Paid about a week before counting day, then
  verify with a load check.
- `docs/LIVE_RUNBOOK.md` — note: a function-quota spike on the free plan → upgrade immediately.

## Out of scope (phase 2)

- Dynamic OG images (satori + resvg-wasm in the Worker; constituency winner cards and live-tally cards cached per
  results version).
- Hindi and other language URLs (`/hi/…`) with `hreflang`.
- Google Search Console verification and sitemap submission (operational, after the domain is live on Pages).
- `SearchAction` (sitelinks search box) in the home JSON-LD.
