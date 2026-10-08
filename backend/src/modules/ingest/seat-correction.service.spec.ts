import { Logger } from '@nestjs/common';
import { SeatCorrectionService } from './seat-correction.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { IngestBadRequestException, IngestNotLiveException } from '../../common/exceptions';

const NOW = new Date('2027-02-27T04:12:00Z');
const ZERO = [{ candidate_id: 'a', votes: 0, status: 'TRAILING', margin: 0 }, { candidate_id: 'b', votes: 0, status: 'TRAILING', margin: 0 }];
function make(status = 'Live', stored: any[] = ZERO) {
  const executed: string[] = [];
  const prisma: any = {
    elections: { findUnique: jest.fn(async () => ({ status })) },
    election_ingest: { findUnique: jest.fn(async () => ({ hold_minutes: 10 })) },
    candidates: { findMany: jest.fn(async () => [{ id: 'a', party_id: 'BJP' }, { id: 'b', party_id: 'INC' }]) },
    results: { findMany: jest.fn(async () => stored) },
    seat_ingest_state: { findUnique: jest.fn(async () => ({ state: 'counting', round_current: 7, round_total: 20, last_source: 'eci-web', last_observed_at: NOW })) },
    audit_logs: { create: jest.fn(async () => ({})) },
    $executeRawUnsafe: jest.fn(async () => 0),
    $executeRaw: jest.fn(async (strings: TemplateStringsArray) => { executed.push(strings.join('?').trim().split(/\s+/).slice(0, 3).join(' ')); return 1; }),
  };
  prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
  const holds: any = { upsert: jest.fn(async () => new Date(NOW.getTime() + 600_000)) };
  const notifier: any = { afterCommit: jest.fn(async () => undefined) };
  return { svc: new SeatCorrectionService(prisma, holds, notifier, new AuditLogService(prisma)), prisma, holds, notifier, executed };
}

describe('SeatCorrectionService', () => {
  it('a failed audit insert never aborts the correction (savepoint inside the transaction)', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, prisma, holds } = make();
    prisma.audit_logs.create.mockRejectedValue(new Error('audit down'));
    await expect(svc.correct('e', 'S1', { state: 'counting', votes: { a: 900, b: 800 } }, 'u1', NOW)).resolves.toMatchObject({ outcome: 'applied' });
    expect(holds.upsert).toHaveBeenCalled();
    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT audit_row');
  });
  it('applies the derived rows, audits, and holds the seat at the corrected round', async () => {
    const { svc, holds, prisma, notifier } = make();
    const out = await svc.correct('e', 'S1', { state: 'counting', round: { current: 8, total: 20 }, votes: { a: 900, b: 800 } }, 'u1', NOW);
    expect(out).toEqual({ outcome: 'applied', hold_expires_at: new Date(NOW.getTime() + 600_000) });
    expect(holds.upsert).toHaveBeenCalledWith(prisma, 'e', 'S1', 8, 10, 'u1', NOW);
    expect(prisma.audit_logs.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'RESULT_SEAT_CORRECTION', entity_id: 'S1' }) }));
    expect(notifier.afterCommit).toHaveBeenCalledWith('e', [expect.objectContaining({ const_id: 'S1', p: 'BJP', s: 'LEADING', m: 100 })], { kind: 'single' });
  });
  it('without a round, the hold is at the stored round', async () => {
    const { svc, holds, prisma } = make();
    await svc.correct('e', 'S1', { state: 'counting', votes: { a: 1, b: 2 } }, 'u1', NOW);
    expect(holds.upsert).toHaveBeenCalledWith(prisma, 'e', 'S1', 7, 10, 'u1', NOW);
  });
  it('refuses a Finalized election and an incomplete roster', async () => {
    await expect(make('Finalized').svc.correct('e', 'S1', { state: 'counting', votes: { a: 1, b: 2 } }, 'u1', NOW)).rejects.toBeInstanceOf(IngestNotLiveException);
    await expect(make().svc.correct('e', 'S1', { state: 'counting', votes: { a: 1 } }, 'u1', NOW)).rejects.toBeInstanceOf(IngestBadRequestException);
  });
  it('takes the seat lock before reading the stored seat, inside the transaction', async () => {
    const { svc, prisma, executed } = make();
    const seen: string[][] = [];
    prisma.results.findMany = jest.fn(async () => { seen.push([...executed]); return ZERO; });
    await svc.correct('e', 'S1', { state: 'counting', votes: { a: 1, b: 2 } }, 'u1', NOW);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(1);
    expect(seen[0][0]).toContain('pg_advisory_xact_lock');
  });
  it('a roster candidate without a results row is a 400 missing_result_rows, nothing written', async () => {
    const { svc, prisma, holds } = make('Live', [ZERO[0]]);
    await expect(svc.correct('e', 'S1', { state: 'counting', votes: { a: 1, b: 2 } }, 'u1', NOW)).rejects.toMatchObject({ message: 'missing_result_rows' });
    expect(holds.upsert).not.toHaveBeenCalled();
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
  });
});
