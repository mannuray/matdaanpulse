/** The app's public routes (src/App.tsx) plus the sitemap paths. Ids are validated like the API does. */
export type Route =
  | { kind: 'home' } | { kind: 'about' } | { kind: 'notFound' }
  | { kind: 'election'; electionId: string }
  | { kind: 'constituency'; electionId: string; constId: string }
  | { kind: 'person'; personId: string }
  | { kind: 'party'; partyId: string; state: string | null }
  | { kind: 'sitemapIndex' } | { kind: 'sitemapElection'; electionId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** backend common/validation/ids.ts CONST_ID_RE, max 100. */
const CONST_ID = /^[A-Za-z0-9_&-]{1,100}$/;
/** backend PARTY_ID_RE, max PARTY_ID_MAX (20). */
const PARTY_ID = /^[A-Za-z0-9_&().+-]{1,20}$/;
const STATE = /^[A-Z]{2}$/;
const NOT_FOUND: Route = { kind: 'notFound' };

const decode = (s: string): string | null => { try { return decodeURIComponent(s); } catch { return null; } };
const uuid = (s: string): string | null => (UUID.test(s) ? s.toLowerCase() : null);

export function matchRoute(pathname: string, search: string): Route {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (path === '/') return { kind: 'home' };
  if (path === '/about') return { kind: 'about' };
  if (path === '/sitemap.xml') return { kind: 'sitemapIndex' };

  let m = /^\/sitemaps\/election-([^/]+)\.xml$/.exec(path);
  if (m) { const id = uuid(m[1]); return id ? { kind: 'sitemapElection', electionId: id } : NOT_FOUND; }

  m = /^\/election\/([^/]+)$/.exec(path);
  if (m) { const id = uuid(m[1]); return id ? { kind: 'election', electionId: id } : NOT_FOUND; }

  m = /^\/election\/([^/]+)\/constituency\/([^/]+)$/.exec(path);
  if (m) {
    const id = uuid(m[1]);
    const constId = decode(m[2]);
    return id && constId && CONST_ID.test(constId) ? { kind: 'constituency', electionId: id, constId } : NOT_FOUND;
  }

  m = /^\/person\/([^/]+)$/.exec(path);
  if (m) { const id = uuid(m[1]); return id ? { kind: 'person', personId: id } : NOT_FOUND; }

  m = /^\/party\/([^/]+)$/.exec(path);
  if (m) {
    const partyId = decode(m[1]);
    if (!partyId || !PARTY_ID.test(partyId)) return NOT_FOUND;
    const s = new URLSearchParams(search).get('state')?.toUpperCase() ?? null;
    return { kind: 'party', partyId, state: s && STATE.test(s) ? s : null };
  }
  return NOT_FOUND;
}

/**
 * The edge-cache key path: one per page, whatever query string (fbclid, utm_*), trailing slash or id case the link
 * carried, so a shared link is one cache entry. Not-found paths all share one key.
 */
export function routeKey(r: Route): string {
  switch (r.kind) {
    case 'home': return '/';
    case 'about': return '/about';
    case 'election': return `/election/${r.electionId}`;
    case 'constituency': return `/election/${r.electionId}/constituency/${encodeURIComponent(r.constId)}`;
    case 'person': return `/person/${r.personId}`;
    case 'party': return `/party/${encodeURIComponent(r.partyId)}${r.state ? `?state=${r.state}` : ''}`;
    case 'sitemapIndex': return '/sitemap.xml';
    case 'sitemapElection': return `/sitemaps/election-${r.electionId}.xml`;
    case 'notFound': return '/__not-found';
  }
}
