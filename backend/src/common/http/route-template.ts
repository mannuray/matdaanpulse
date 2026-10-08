export const UNMATCHED_ROUTE = '(unmatched)';

interface RoutedRequest {
  method?: string;
  baseUrl?: string;
  route?: { path?: unknown };
}

/**
 * "GET /api/v1/elections/:id" from the route Express matched, never the raw URL
 * (no ids, no query string). Requests that matched no route collapse into one key.
 */
export function routeTemplate(req: RoutedRequest): string {
  const path = req.route?.path;
  if (typeof path !== 'string') return `${req.method ?? 'GET'} ${UNMATCHED_ROUTE}`;
  const full = `${req.baseUrl ?? ''}${path}`.split('?')[0];
  return `${req.method ?? 'GET'} ${full}`;
}
