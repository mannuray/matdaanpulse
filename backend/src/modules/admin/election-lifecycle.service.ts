import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { ElectionsService } from '../elections/elections.service';
import { SeatAnalysisService } from '../constituencies/seat-analysis.service';
import { ResultsService } from '../results/results.service';
import { LiveStateService } from '../results/live-state.service';
import { AuditLogService } from '../audit-log/audit-log.service';

export type ElectionStatus = 'Upcoming' | 'Live' | 'Finalized';
export interface Actor { id?: string | null; role?: string | null }

/**
 * The one way an election's status changes (admin PATCH, finalize, reopen). Who may do it, what is computed and the
 * audit row live here, so no route can skip them: anything into or out of Finalized is a SUPER_ADMIN action
 * (Finalized → Live is a reopen); the final seat analysis is stored before the flip to Finalized, the baseline after
 * going Live (a failure is logged, the change stands); the live state and caches are refreshed after every change.
 */
@Injectable()
export class ElectionLifecycleService {
  private readonly logger = new Logger(ElectionLifecycleService.name);

  constructor(
    private readonly elections: ElectionsService,
    private readonly seatAnalysis: SeatAnalysisService,
    private readonly results: ResultsService,
    private readonly liveState: LiveStateService,
    private readonly audit: AuditLogService,
  ) {}

  async transition(id: string, to: ElectionStatus, actor: Actor) {
    const before = await this.elections.findOne(id);
    const from = String(before.status) as ElectionStatus;
    if (from === to) return before;
    if ((from === 'Finalized' || to === 'Finalized') && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException(`Only a super admin can move an election ${from === 'Finalized' ? 'out of' : 'to'} Finalized`);
    }
    // The final analysis first, so a viewer who sees Finalized already gets it.
    if (to === 'Finalized') await this.attempt(() => this.seatAnalysis.compute(id), `seat analysis for ${id}`);
    const updated = await this.elections.update(id, { status: to } as never);
    if (to === 'Live') await this.attempt(() => this.seatAnalysis.computeBaseline(id), `baseline for ${id}`);
    await this.audit.log(from === 'Finalized' && to === 'Live'
      ? { userId: actor.id ?? null, action: 'ELECTION_REOPEN', entityType: 'election', entityId: id }
      : { userId: actor.id ?? null, action: 'ELECTION_STATUS', entityType: 'election', entityId: id, oldValue: { status: from }, newValue: { status: to } });
    // Status is part of GET /elections/:id/live: show the change at once (the version does not move).
    this.liveState.invalidate(id);
    await this.results.purgeElectionCache(id);
    return updated;
  }

  private async attempt(fn: () => Promise<unknown>, what: string): Promise<void> {
    try { await fn(); } catch (e) { this.logger.error(`${what} failed: ${(e as Error).message}`); }
  }
}
