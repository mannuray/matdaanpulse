/**
 * Platform/uptime probes (`/api/v1/health/*`). They run every few seconds, so they
 * are kept out of the traffic counters on the System status page and logged at
 * debug instead of info.
 */
export function isHealthProbe(req: { originalUrl?: string; url?: string }): boolean {
  const path = (req.originalUrl ?? req.url ?? '').split('?')[0];
  return path === '/api/v1/health' || path.startsWith('/api/v1/health/');
}
