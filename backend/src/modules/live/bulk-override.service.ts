import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResultsService } from '../results/results.service';
import { LivePublisher } from './live.service';
import { MetricsService } from '../metrics/metrics.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { BulkOverridePayload, ConstituencyRoundDto } from './dto/result-override.dto';

interface BatchUpdateRow {
  const_id: string;
  p: string;
  m: number;
  s: string;
  r?: number;
  cr?: number;
  tr?: number;
}

/** Interactive-transaction timeout; Prisma's 5s default is too short for large rounds. */
const TX_TIMEOUT_MS = 60_000;

@Injectable()
export class BulkOverrideService {
  private readonly logger = new Logger(BulkOverrideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly results: ResultsService,
    private readonly live: LivePublisher,
    private readonly metrics: MetricsService,
    private readonly audit: AuditLogService,
  ) {}

  async bulkOverride(data: BulkOverridePayload, userId?: string): Promise<{ updated: number }> {
    const { election_id, overrides } = data;
    if (!overrides?.length) return { updated: 0 };

    // Accept either a Map (after ValidationPipe transform) or a plain object.
    const rounds = toRoundsMap(data.rounds);

    // Last write wins for duplicate result_ids within one request.
    const byResultId = new Map<string, (typeof overrides)[number]>();
    for (const o of overrides) byResultId.set(o.result_id, o);
    const items = [...byResultId.values()];
    const resultIds = items.map((o) => o.result_id);

    // Ownership check + source of truth for const_id / party_id (never trust client).
    const owned = await this.prisma.results.findMany({
      where: { id: { in: resultIds }, election_id },
      select: { id: true, const_id: true, candidates: { select: { party_id: true } } },
    });
    if (owned.length !== resultIds.length) {
      const ownedIds = new Set(owned.map((r) => r.id));
      const foreign = resultIds.filter((id) => !ownedIds.has(id));
      throw new BadRequestException({
        message: `${foreign.length} result_id(s) do not belong to election ${election_id}`,
        result_ids: foreign.slice(0, 20),
      });
    }
    const rowById = new Map(owned.map((r) => [r.id, r]));

    // Only apply rounds for constituencies of this election.
    const roundEntries = [...rounds.entries()].filter(
      ([, dto]) => dto && (dto.current_round !== undefined || dto.total_rounds !== undefined),
    );

    let affectedRows = 0;
    const now = new Date();

    try {
      await this.prisma.$transaction(
        async (tx) => {
          // Single set-based UPDATE: one bound array per column, so the parameter
          // count is constant regardless of batch size.
          affectedRows = await tx.$executeRaw`
            UPDATE results AS r SET
              votes = u.votes,
              status = u.status::result_status,
              margin = u.margin,
              round_no = COALESCE(u.round_no, r.round_no),
              last_updated = ${now}
            FROM UNNEST(
              ${resultIds}::uuid[],
              ${items.map((o) => o.votes)}::int[],
              ${items.map((o) => o.status)}::text[],
              ${items.map((o) => o.margin)}::int[],
              ${items.map((o) => o.round_no ?? null)}::int[]
            ) AS u(id, votes, status, margin, round_no)
            WHERE r.id = u.id AND r.election_id = ${election_id}::uuid
          `;

          if (roundEntries.length > 0) {
            await tx.$executeRaw`
              UPDATE constituencies AS c SET
                current_round = COALESCE(u.current_round, c.current_round),
                total_rounds = COALESCE(u.total_rounds, c.total_rounds)
              FROM UNNEST(
                ${roundEntries.map(([id]) => id)}::varchar[],
                ${roundEntries.map(([, d]) => d.current_round ?? null)}::int[],
                ${roundEntries.map(([, d]) => d.total_rounds ?? null)}::int[]
              ) AS u(id, current_round, total_rounds)
              WHERE c.id = u.id AND c.election_id = ${election_id}::uuid
            `;
          }

          if (userId) {
            await tx.audit_logs.create({
              data: {
                user_id: userId,
                action: 'RESULT_BULK_OVERRIDE',
                entity_type: 'election',
                entity_id: election_id,
                new_value: {
                  results_updated: affectedRows,
                  constituencies_with_rounds: roundEntries.length,
                  result_ids: resultIds.length <= 50 ? resultIds : undefined,
                } as Prisma.InputJsonValue,
              },
            });
          }
        },
        { timeout: TX_TIMEOUT_MS, maxWait: 10_000 },
      );
    } catch (err) {
      this.logger.error(
        `Bulk override transaction failed for election ${election_id} (${items.length} items): ${(err as Error).message}`,
      );
      throw err;
    }

    try {
      this.metrics.resultOverrides.add(items.length, {
        election_id,
        status: 'bulk',
      });
    } catch (err) {
      this.logger.warn(`Metrics recording failed: ${(err as Error).message}`);
    }

    // One SSE row per constituency, preferring the LEADING/WON candidate.
    const constMap = new Map<string, { o: (typeof items)[number]; const_id: string; party_id: string }>();
    for (const o of items) {
      const row = rowById.get(o.result_id)!;
      const partyId = row.candidates?.party_id;
      if (!partyId) continue;
      const existing = constMap.get(row.const_id);
      if (!existing || o.status === 'LEADING' || o.status === 'WON') {
        constMap.set(row.const_id, { o, const_id: row.const_id, party_id: partyId });
      }
    }

    const batchRows: BatchUpdateRow[] = [];
    for (const { o, const_id, party_id } of constMap.values()) {
      const rd = rounds.get(const_id);
      batchRows.push({
        const_id,
        p: party_id,
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

function toRoundsMap(
  rounds: Map<string, ConstituencyRoundDto> | Record<string, ConstituencyRoundDto> | undefined,
): Map<string, ConstituencyRoundDto> {
  if (!rounds) return new Map();
  if (rounds instanceof Map) return rounds;
  return new Map(Object.entries(rounds));
}
