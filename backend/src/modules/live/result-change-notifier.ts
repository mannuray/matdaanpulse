import { Injectable, Logger } from '@nestjs/common';
import { ElectionCacheService } from '../redis/election-cache.service';
import { LiveStateService } from '../results/live-state.service';
import { LivePublisher } from './live.service';
import { MetricsService } from '../metrics/metrics.service';

/** One constituency's change as sent to admin SSE clients (`result-update` / `batch-update` row). */
export interface ChangedRow {
  const_id: string;
  p: string;
  m: number;
  s: string;
  r?: number;
  cr?: number;
  tr?: number;
}

export interface AfterCommitOptions {
  /** `single` publishes one `result-update` event; `batch` one `batch-update` with all rows. */
  kind: 'single' | 'batch';
  /** Value for the override counter; omit for a change that is not an override (e.g. a new candidate's zero-vote row). */
  overrideCount?: number;
  /** Status label for the override counter. */
  status?: string;
  /** Single override whose candidate has no party: no event can be built (counted as skipped). */
  skippedMissingParty?: { resultId: string };
}

/**
 * Everything that follows a committed results write, in one place. Order matters
 * (pipeline review M5): metrics, then forget this process's live-version memo (the DB
 * trigger already bumped the version), purge the caches, and only then tell admin SSE
 * clients (who refetch on the event). Nothing here throws: the write is already durable.
 */
@Injectable()
export class ResultChangeNotifier {
  private readonly logger = new Logger(ResultChangeNotifier.name);

  constructor(
    private readonly electionCache: ElectionCacheService,
    private readonly live: LivePublisher,
    private readonly metrics: MetricsService,
    private readonly liveState: LiveStateService,
  ) {}

  async afterCommit(electionId: string, changedRows: ChangedRow[], opts: AfterCommitOptions): Promise<void> {
    if (opts.overrideCount !== undefined) {
      try {
        this.metrics.resultOverrides.add(opts.overrideCount, { election_id: electionId, status: opts.status ?? 'unknown' });
      } catch (err) {
        this.logger.warn(`Metrics recording failed: ${(err as Error).message}`);
      }
    }

    try {
      this.liveState.invalidate(electionId);
    } catch (err) {
      this.logger.warn(`Live-state memo invalidation failed for election ${electionId}: ${(err as Error).message}`);
    }
    try {
      await this.electionCache.purgeResults(electionId);
    } catch (err) {
      this.logger.warn(`Cache invalidation failed for election ${electionId}: ${(err as Error).message}`);
    }

    if (opts.skippedMissingParty) {
      this.logger.warn(`Missing candidate/party for result ${opts.skippedMissingParty.resultId} — SSE event skipped`);
      try {
        this.metrics.ssePublishSkipped.add(1, { reason: 'missing_party', election_id: electionId });
      } catch (err) {
        this.logger.warn(`Metrics recording failed: ${(err as Error).message}`);
      }
      return;
    }
    if (changedRows.length === 0) return;

    try {
      if (opts.kind === 'single') {
        await this.live.publish(electionId, { type: 'result-update', data: changedRows[0] });
      } else {
        await this.live.publish(electionId, { type: 'batch-update', data: changedRows });
      }
    } catch (err) {
      this.logger.error(`Failed to publish ${opts.kind} update for election ${electionId}: ${(err as Error).message}`);
    }
  }
}
