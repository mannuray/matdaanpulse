import type { Election } from '../../src/model/types';

export type ElectionStatus = Election['status'];

/** Everything one page sends to crawlers. `path` is the canonical path (+ query); null = no canonical tag. */
export interface SeoPage {
  status: 200 | 404;
  title: string;
  description: string;
  path: string | null;
  ogType: 'website' | 'profile';
  image: string;
  jsonLd: object[];
  /** Escaped HTML placed inside #root ('' leaves it empty). */
  body: string;
  noindex: boolean;
  /** Seconds the edge may cache the page. */
  ttl: number;
}

export const TTL = { live: 60, final: 86_400, normal: 3_600, notFound: 300, fallback: 30, sitemapLive: 600, sitemap: 86_400 } as const;

export const ttlFor = (s: ElectionStatus): number => (s === 'Live' ? TTL.live : s === 'Finalized' ? TTL.final : TTL.normal);

/** GET /constituencies?election_id= row (backend ConstituencySummaryDto). */
export interface SeatSummary { id: string; election_id: string; name: string; const_no: number; type: 'GEN' | 'SC' | 'ST' }
