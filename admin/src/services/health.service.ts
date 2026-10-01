import { API_BASE_URL } from './api-client';

export interface ReadinessCheck { status: 'healthy' | 'unhealthy'; latencyMs: number }
export interface Readiness { status: 'healthy' | 'degraded'; checks: { database: ReadinessCheck; redis: ReadinessCheck } }

/**
 * GET /health/ready (public). A degraded check answers 503 with the same JSON body, so this reads the body
 * whatever the status (apiFetch would throw on the 503). Anything without `checks` is an error.
 */
export async function getReadiness(): Promise<Readiness> {
  const res = await fetch(`${API_BASE_URL}/health/ready`, { cache: 'no-store' });
  const body: unknown = await res.json().catch(() => null);
  const checks = (body as Partial<Readiness> | null)?.checks;
  if (checks?.database && checks?.redis) return body as Readiness;
  throw new Error(`Health check failed (${res.status})`);
}
