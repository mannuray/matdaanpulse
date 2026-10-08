import { Injectable } from '@nestjs/common';
import { LatencyReservoir } from './latency-reservoir';
import { RollingCounter } from './rolling-counter';
import { UNMATCHED_ROUTE } from './route-template';

export const MAX_ROUTES = 300;
const HOUR_MS = 60 * 60_000;
const TOP_SLOWEST = 10;

/**
 * In-memory operational counters (single instance, reset on restart). Every
 * record* call is O(1); nothing here talks to Redis, the database or OTel, so it
 * works with OTel off and never takes a request down.
 */
@Injectable()
export class StatusService {
  readonly startedAt = Date.now();

  private readonly requests = new RollingCounter();
  private readonly errors5xx = new RollingCounter();
  private readonly overrides = new RollingCounter();
  private readonly routes = new Map<string, LatencyReservoir>();

  private total = 0;
  private byClass = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, other: 0 };
  private throttled = 0;
  private shieldRejected = 0;
  private serviceBusy = 0;

  private cache = { hits: 0, misses: 0, fallbacks: 0 };
  private redis = { publishes: 0, published: 0, publishErrors: 0 };
  private live = { sseConnections: 0, eventsPublished: 0, overrides: 0, lastOverrideAt: null as number | null };

  recordRequest(route: string, statusCode: number, durationMs: number, now = Date.now()) {
    this.total++;
    this.requests.add(now);
    const cls = Math.floor(statusCode / 100);
    if (cls === 2) this.byClass['2xx']++;
    else if (cls === 3) this.byClass['3xx']++;
    else if (cls === 4) this.byClass['4xx']++;
    else if (cls === 5) {
      this.byClass['5xx']++;
      this.errors5xx.add(now);
    } else this.byClass.other++;
    if (statusCode === 429) this.throttled++;

    let reservoir = this.routes.get(route);
    if (!reservoir) {
      if (this.routes.size >= MAX_ROUTES) return; // bounded: a route-scanning client can't grow memory
      reservoir = new LatencyReservoir();
      this.routes.set(route, reservoir);
    }
    reservoir.add(now, durationMs);
  }

  /** A request refused by the origin shield (no/wrong X-Origin-Secret), answered before the Nest middleware. */
  recordShieldRejection() { this.shieldRejected++; }

  /** A request refused with 503 GEN_0005 because the DB pool was full (counted apart from other 5xx). */
  recordServiceBusy() { this.serviceBusy++; }

  recordCacheHit() { this.cache.hits++; }
  recordCacheMiss() { this.cache.misses++; }
  /** A Redis failure that made the cache fall back to the database. */
  recordCacheFallback() { this.cache.fallbacks++; }

  recordRedisPublishAttempt() { this.redis.publishes++; }
  recordEventPublished() { this.redis.published++; this.live.eventsPublished++; }
  recordRedisPublishError() { this.redis.publishErrors++; }

  addSseConnections(delta: number) { this.live.sseConnections = Math.max(0, this.live.sseConnections + delta); }

  recordOverrides(n: number, now = Date.now()) {
    this.live.overrides += n;
    this.live.lastOverrideAt = now;
    this.overrides.add(now, n);
  }

  snapshot(now = Date.now()) {
    // p95 of each route's last <=200 requests that fall within the last 60 min
    // (a busy route's window can be seconds, a quiet one's up to an hour).
    const slowest = [...this.routes.entries()]
      .filter(([route]) => !route.endsWith(UNMATCHED_ROUTE))
      .map(([route, r]) => ({ route, r: r.p95(now, HOUR_MS) }))
      .filter((x): x is { route: string; r: { p95: number; samples: number } } => x.r !== null)
      .sort((a, b) => b.r.p95 - a.r.p95)
      .slice(0, TOP_SLOWEST)
      .map(({ route, r }) => ({ route, p95Ms: Math.round(r.p95), samples: r.samples }));

    const window = (minutes: number) => {
      const requests = this.requests.sum(now, minutes);
      const errors5xx = this.errors5xx.sum(now, minutes);
      return { requests, requestsPerMin: round(requests / minutes), errors5xx, errors5xxPerMin: round(errors5xx / minutes) };
    };
    const lookups = this.cache.hits + this.cache.misses;

    return {
      http: {
        total: this.total,
        byClass: { ...this.byClass },
        throttled429: this.throttled,
        /** Origin-shield 403s (direct-to-origin traffic); not included in `total`. */
        shieldRejected403: this.shieldRejected,
        serviceBusy503: this.serviceBusy,
        last5m: window(5),
        last60m: window(60),
        /** 10 slowest routes by p95 of their last <=200 requests within 60 min. */
        slowestRoutes: slowest,
      },
      cache: { ...this.cache, hitRate: lookups > 0 ? round(this.cache.hits / lookups) : null },
      redis: { ...this.redis },
      live: {
        sseConnections: this.live.sseConnections,
        eventsPublished: this.live.eventsPublished,
        overridesApplied: this.live.overrides,
        overridesLast5m: this.overrides.sum(now, 5),
        overridesPerMin: round(this.overrides.sum(now, 5) / 5),
        lastOverrideAt: this.live.lastOverrideAt ? new Date(this.live.lastOverrideAt).toISOString() : null,
      },
    };
  }
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}
