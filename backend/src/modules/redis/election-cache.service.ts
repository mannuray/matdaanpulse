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

const RESULT_VIEWS = ['summary', 'vote-share', 'full-results'] as const;

/** Invalidation of an election's cached views (the one place that knows which keys exist). */
@Injectable()
export class ElectionCacheService {
  constructor(private readonly cache: CacheService) {}

  /**
   * After a results write: the results-derived views and the public analysis. Snapshots (`…:snapshot:v<n>`) are kept:
   * they never change meaning, and a wildcard purge right after a commit could delete the snapshot a fast reader had just
   * cached for the new version. Old snapshots fall away with their TTL.
   */
  async purgeResults(id: string): Promise<boolean> {
    const outcomes = await Promise.all([
      ...RESULT_VIEWS.map(v => this.cache.delByPattern(`election:${id}:${v}:*`)),
      this.cache.del(electionKeys.publicAnalysis(id)),
    ]);
    return outcomes.every(Boolean);
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
