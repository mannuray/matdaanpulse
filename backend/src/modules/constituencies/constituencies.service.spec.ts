import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConstituenciesService } from './constituencies.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { UpdateConstituencyDto } from './dto/constituency-input.dto';

const seat = { id: 'BR_VS_1', name: 'Valmiki Nagar', const_no: 1, type: 'GEN', phase: null, district_id: 5, metadata: { tags: ['border'] }, updated_at: new Date(1) };

function make() {
  const prisma: any = {
    constituencies: {
      findUnique: jest.fn().mockResolvedValue(seat),
      findMany: jest.fn().mockResolvedValue([seat, { ...seat, id: 'BR_VS_2', metadata: { tags: ['urban'] } }]),
      update: jest.fn(async ({ where, data }) => ({ ...seat, id: where.id, ...Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)), updated_at: new Date(2) })),
    },
    audit_logs: { create: jest.fn().mockResolvedValue({}), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  const svc = new ConstituenciesService(prisma, {} as any, [], new AuditLogService(prisma));
  return { svc, prisma };
}

describe('ConstituenciesService audit rows', () => {
  it('updateConstituency saves phase and type to the columns and writes one CONSTITUENCY_UPDATE row', async () => {
    const { svc, prisma } = make();
    await svc.updateConstituency('BR_VS_1', { phase: 2, type: 'SC', district_id: 5 }, 'u1');
    expect(prisma.constituencies.update.mock.calls[0][0].data).toMatchObject({ phase: 2, type: 'SC' });
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create.mock.calls[0][0].data).toEqual({
      user_id: 'u1', action: 'CONSTITUENCY_UPDATE', entity_type: 'constituency', entity_id: 'BR_VS_1',
      old_value: { phase: null, type: 'GEN' }, new_value: { phase: 2, type: 'SC' },
    });
  });

  it('updateMetadata writes one row with the changed metadata keys', async () => {
    const { svc, prisma } = make();
    await svc.updateMetadata('BR_VS_1', { literacy: 61.8 }, 'u1');
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create.mock.calls[0][0].data).toMatchObject({
      action: 'CONSTITUENCY_UPDATE', old_value: { metadata: { literacy: null } }, new_value: { metadata: { literacy: 61.8 } },
    });
  });

  it('bulkTag writes one row per seat whose tags changed, in one insert', async () => {
    const { svc, prisma } = make();
    await svc.bulkTag(['BR_VS_1', 'BR_VS_2'], ['border'], [], 'u1');
    expect(prisma.audit_logs.createMany).toHaveBeenCalledTimes(1);
    const rows = prisma.audit_logs.createMany.mock.calls[0][0].data;
    expect(rows).toEqual([expect.objectContaining({
      action: 'CONSTITUENCY_UPDATE', entity_id: 'BR_VS_2',
      old_value: { metadata: { tags: ['urban'] } }, new_value: { metadata: { tags: ['urban', 'border'] } },
    })]);
  });

  it('an audit failure still returns the saved seat', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, prisma } = make();
    prisma.audit_logs.create.mockRejectedValue(new Error('x'));
    await expect(svc.updateConstituency('BR_VS_1', { phase: 3 }, 'u1')).resolves.toMatchObject({ phase: 3 });
    warn.mockRestore();
  });
});

describe('UpdateConstituencyDto', () => {
  const errorsFor = async (body: object) => (await validate(plainToInstance(UpdateConstituencyDto, body))).map((e) => e.property);
  it('accepts phase (or null) and GEN / SC / ST', async () => {
    expect(await errorsFor({ phase: 4, type: 'ST' })).toEqual([]);
    expect(await errorsFor({ phase: null })).toEqual([]);
  });
  it('rejects a bad phase or reservation, and a null reservation', async () => {
    expect(await errorsFor({ phase: 0 })).toContain('phase');
    expect(await errorsFor({ type: 'OBC' })).toContain('type');
    expect(await errorsFor({ type: null })).toContain('type');
  });
});
