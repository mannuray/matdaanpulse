import { Injectable } from '@nestjs/common';
import { CacheService } from './cache.service';

/** Every election cache key, built in one place (results, snapshots, seat analysis, baseline, live events). */
export const electionKeys = {
  /** Results-derived views carry the live version: any results write moves readers to a fresh key. */
  versioned: (id: string, name: 'summary' | 'vote-share' | 'full-results' | string, version: number) => `election:${id}:${name}:v${version}`,
  snapshot: (id: string, version: number) => `election:${id}:snapshot:v${version}`,
  publicAnalysis: (id: string) => `election:${id}:public-analysis`,
  analysisSummary: (id: string) => `election:${id}:analysis-summary`,
  baseline: (id: string) => `election:${id}:baseline`,
  events: (id: string) => `election:${id}:events`,
};

/** Invalidation of an election's cached views (the one place that knows which keys exist). */
@Injectable()
export class ElectionCacheService {
  constructor(private readonly cache: CacheService) {}

  /**
   * After a results write: the public analysis, the only unversioned results-derived key. The other results views
   * (summary, vote-share, full-results, region-shares, snapshots) are keyed by the live version (`…:v<n>`), which the
   * write's DB trigger has already moved, so they are never served stale and need no SCAN; old versions fall away
   * with their TTL. (A wildcard purge right after a commit could even delete what a fast reader had just cached.)
   */
  purgeResults(id: string): Promise<boolean> {
    return this.cache.del(electionKeys.publicAnalysis(id));
  }

  /** After a status change: everything, including the stored seat analysis summary and the baseline. */
  async purgeElection(id: string): Promise<boolean> {
    const outcomes = await Promise.all([
      this.purgeResults(id),
      this.cache.del(electionKeys.analysisSummary(id)),
      this.cache.del(electionKeys.baseline(id)),
    ]);
    return outcomes.every(Boolean);
  }
}
