import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResultsService } from '../results/results.service';
import { LivePublisher } from './live.service';
import { MetricsService } from '../metrics/metrics.service';
import type { BulkOverridePayload } from './dto/result-override.dto';

interface BatchUpdateRow {
  const_id: string;
  p: string;
  m: number;
  s: string;
  r?: number;
  cr?: number;
  tr?: number;
}

@Injectable()
export class BulkOverrideService {
  private readonly logger = new Logger(BulkOverrideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ResultsService,
    private readonly live: LivePublisher,
    private readonly metrics: MetricsService,
  ) {}

  async bulkOverride(data: BulkOverridePayload): Promise<{ updated: number }> {
    const { election_id, overrides, rounds } = data;
    if (!overrides?.length) return { updated: 0 };

    let affectedRows = 0;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Results updates
        for (const o of overrides) {
          await tx.results.update({
            where: { id: o.result_id },
            data: {
              votes: o.votes,
              status: o.status as any,
              margin: o.margin,
              round_no: o.round_no ?? undefined,
              last_updated: new Date()
            }
          });
          affectedRows++;
        }

        // Rounds updates
        if (rounds) {
          for (const [constId, dto] of Object.entries(rounds)) {
            if (dto.current_round === undefined && dto.total_rounds === undefined) continue;
            await tx.constituencies.update({
              where: { id: constId },
              data: {
                current_round: dto.current_round ?? undefined,
                total_rounds: dto.total_rounds ?? undefined
              }
            });
          }
        }
      });
    } catch (err) {
      this.logger.error(
        `Bulk override transaction failed for election ${election_id} (${overrides.length} items): ${(err as Error).message}`,
      );
      throw err;
    }

    try {
      this.metrics.resultOverrides.add(overrides.length, {
        election_id,
        status: 'bulk',
      });
    } catch (err) {
      this.logger.warn(`Metrics recording failed: ${(err as Error).message}`);
    }

    const constMap = new Map<string, typeof overrides[0]>();
    for (const o of overrides) {
      const existing = constMap.get(o.const_id);
      if (!existing || o.status === 'LEADING' || o.status === 'WON') {
        constMap.set(o.const_id, o);
      }
    }

    const batchRows: BatchUpdateRow[] = [];
    for (const [, o] of constMap) {
      const rd = rounds?.[o.const_id];
      batchRows.push({
        const_id: o.const_id,
        p: o.party_id,
        m: o.margin,
        s: o.status,
        r: o.round_no,
        ...(rd?.current_round !== undefined && { cr: rd.current_round }),
        ...(rd?.total_rounds !== undefined && { tr: rd.total_rounds }),
      });
    }

    if (batchRows.length > 0) {
      try {
        await this.live.publish(election_id, {
          type: 'batch-update',
          data: batchRows,
        });
      } catch (err) {
        this.logger.error(`Failed to publish batch update: ${(err as Error).message}`);
      }
    }

    // Invalidate caches
    try {
      await this.results.purgeElectionCache(election_id);
    } catch (err) {
      this.logger.warn(`Cache invalidation failed for election ${election_id}: ${(err as Error).message}`);
    }

    return { updated: affectedRows };
  }
}
