import { apiFetch } from './api-client';

export interface Window { requests: number; requestsPerMin: number; errors5xx: number; errors5xxPerMin: number }

export interface SystemStatus {
  generatedAt: string;
  process: {
    startedAt: string; uptimeSeconds: number; nodeVersion: string; appVersion: string; gitSha: string | null;
    memory: { rssMb: number; heapUsedMb: number };
  };
  http: {
    total: number;
    byClass: { '2xx': number; '3xx': number; '4xx': number; '5xx': number; other: number };
    throttled429: number;
    last5m: Window;
    last60m: Window;
    /** 10 slowest routes by p95 of their last <=200 requests within 60 min (not a full-hour p95). */
    slowestRoutes: { route: string; p95Ms: number; samples: number }[];
  };
  cache: { hits: number; misses: number; fallbacks: number; hitRate: number | null };
  redis: { pubReady: boolean; subReady: boolean; publishes: number; published: number; publishErrors: number };
  live: {
    sseConnections: number; eventsPublished: number; overridesApplied: number;
    overridesLast5m: number; overridesPerMin: number; lastOverrideAt: string | null;
  };
  db: { ok: boolean; latencyMs: number; pool: { connectionLimit: number | null; poolTimeoutSeconds: number | null } };
}

export function getSystemStatus(): Promise<SystemStatus> {
  return apiFetch<SystemStatus>('/admin/status');
}
