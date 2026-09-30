import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResultNotFoundException } from '../../common/exceptions';
import { ResultsService } from '../results/results.service';
import { LiveStateService } from '../results/live-state.service';
import { LivePublisher } from './live.service';
import { MetricsService } from '../metrics/metrics.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { OverridePayload } from './dto/result-override.dto';

@Injectable()
export class ResultOverrideService {
  private readonly logger = new Logger(ResultOverrideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ResultsService,
    private readonly live: LivePublisher,
    private readonly metrics: MetricsService,
    private readonly audit: AuditLogService,
    private readonly liveState: LiveStateService,
  ) {}

  async override(data: OverridePayload, userId?: string) {
    const result = await this.prisma.results.findUnique({
      where: { id: data.result_id },
      include: { candidates: true },
    });
    if (!result) throw new ResultNotFoundException(data.result_id);

    const hasRoundUpdate = data.current_round !== undefined || data.total_rounds !== undefined;

    let saved: any;
    try {
      saved = await this.prisma.$transaction(async (tx) => {
        const updatedResult = await tx.results.update({
          where: { id: data.result_id },
          data: {
            votes: data.votes,
            status: data.status as any,
            margin: data.margin,
            round_no: data.round_no,
            last_updated: new Date(),
          }
        });

        if (hasRoundUpdate) {
          await tx.constituencies.update({
            where: { id: result.const_id },
            data: {
              current_round: data.current_round,
              total_rounds: data.total_rounds,
            }
          });
        }

        if (userId) {
          await this.audit.create(
            {
              userId,
              action: 'RESULT_OVERRIDE',
              entityType: 'result',
              entityId: result.id,
              oldValue: { votes: result.votes, status: result.status, margin: result.margin },
              newValue: { votes: data.votes, status: data.status, margin: data.margin },
            },
            tx,
          );
        }

        return updatedResult;
      });
    } catch (err) {
      this.logger.error(
        `Override transaction failed: result_id=${data.result_id} const_id=${result.const_id} election=${result.election_id}: ${(err as Error).message}`,
      );
      throw err;
    }

    try {
      this.metrics.resultOverrides.add(1, {
        election_id: saved.election_id,
        status: saved.status,
      });
    } catch (err) {
      this.logger.warn(`Metrics recording failed: ${(err as Error).message}`);
    }

    // Post-commit, in this order (pipeline review M5): the DB trigger already bumped the
    // live version inside the transaction; drop this process's memo of it, purge the
    // caches, and only then tell admin SSE clients (who refetch on the event).
    this.liveState.invalidate(saved.election_id);
    try {
      await this.results.purgeElectionCache(saved.election_id);
    } catch (err) {
      this.logger.warn(`Cache invalidation failed for election ${saved.election_id}: ${(err as Error).message}`);
    }

    const partyId = result.candidates?.party_id;
    if (!partyId) {
      this.logger.warn(`Missing candidate/party for result ${saved.id} — SSE event skipped`);
      this.metrics.ssePublishSkipped.add(1, { reason: 'missing_party', election_id: saved.election_id });
    } else {
      try {
        await this.live.publish(saved.election_id, {
          type: 'result-update',
          data: {
            const_id: saved.const_id,
            p: partyId,
            m: saved.margin,
            s: saved.status,
            r: saved.round_no,
            ...(data.current_round !== undefined && { cr: data.current_round }),
            ...(data.total_rounds !== undefined && { tr: data.total_rounds }),
          },
        });
      } catch (err) {
        this.logger.error(`Failed to publish result update for ${saved.const_id}: ${(err as Error).message}`);
      }
    }

    this.logger.debug(
      `Result overridden: ${saved.const_id} → status=${saved.status}, margin=${saved.margin}, votes=${saved.votes}`,
    );


    return saved;
  }
}
