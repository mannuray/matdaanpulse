import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResultNotFoundException } from '../../common/exceptions';
import { ResultChangeNotifier, type ChangedRow } from './result-change-notifier';
import { AuditLogService } from '../audit-log/audit-log.service';
import type { OverridePayload } from './dto/result-override.dto';

@Injectable()
export class ResultOverrideService {
  private readonly logger = new Logger(ResultOverrideService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly notifier: ResultChangeNotifier,
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

    const partyId = result.candidates?.party_id;
    const row: ChangedRow | null = partyId
      ? {
          const_id: saved.const_id,
          p: partyId,
          m: saved.margin,
          s: saved.status,
          r: saved.round_no,
          ...(data.current_round !== undefined && { cr: data.current_round }),
          ...(data.total_rounds !== undefined && { tr: data.total_rounds }),
        }
      : null;
    await this.notifier.afterCommit(saved.election_id, row ? [row] : [], {
      kind: 'single',
      overrideCount: 1,
      status: saved.status,
      skippedMissingParty: row ? undefined : { resultId: saved.id },
    });

    this.logger.debug(
      `Result overridden: ${saved.const_id} → status=${saved.status}, margin=${saved.margin}, votes=${saved.votes}`,
    );
    return saved;
  }
}
