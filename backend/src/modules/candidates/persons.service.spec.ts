import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PersonsService } from './persons.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreatePersonDto, UpdatePersonDto } from './dto/person-input.dto';

const person = {
  id: 'p1', name: 'Nitish Kumar', gender: 'M', education: null, date_of_birth: new Date('1951-03-01'),
  metadata: { bio: 'old bio', wikipedia_url: 'https://en.wikipedia.org/wiki/N' }, updated_at: new Date(1),
};

function make() {
  const tx = {
    candidates: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
    persons: { delete: jest.fn().mockResolvedValue({}) },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
    $executeRawUnsafe: jest.fn().mockResolvedValue(0),
  };
  const prisma = {
    persons: {
      findUnique: jest.fn(async ({ where }) => (where.id === 'p2' ? { ...person, id: 'p2', name: 'N. Kumar' } : person)),
      update: jest.fn(async ({ data }) => ({ ...person, ...data, updated_at: new Date(2) })),
    },
    audit_logs: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const svc = new PersonsService(prisma as any, new AuditLogService(prisma as any));
  return { svc, prisma, tx };
}

describe('PersonsService audit rows', () => {
  it('update writes one PERSON_UPDATE row with only the changed fields (bio as metadata.bio)', async () => {
    const { svc, prisma } = make();
    await svc.update('p1', { name: 'Nitish Kumar', bio: 'new bio', date_of_birth: '1951-03-01', education: 'B.E.' }, 'u1');
    expect(prisma.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(prisma.audit_logs.create.mock.calls[0][0].data).toEqual({
      user_id: 'u1', action: 'PERSON_UPDATE', entity_type: 'person', entity_id: 'p1',
      old_value: { education: null, metadata: { bio: 'old bio' } },
      new_value: { education: 'B.E.', metadata: { bio: 'new bio' } },
    });
  });

  it('an audit failure still returns the updated person', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, prisma } = make();
    prisma.audit_logs.create.mockRejectedValue(new Error('x'));
    await expect(svc.update('p1', { education: 'B.E.' }, 'u1')).resolves.toMatchObject({ education: 'B.E.' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('merge re-points, deletes and writes one PERSON_MERGE row on the target, in one transaction', async () => {
    const { svc, prisma, tx } = make();
    await expect(svc.merge('p2', 'p1', 'u1')).resolves.toEqual({ merged: true, target_id: 'p1' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.candidates.updateMany).toHaveBeenCalledWith({ where: { person_id: 'p2' }, data: { person_id: 'p1' } });
    expect(tx.persons.delete).toHaveBeenCalledWith({ where: { id: 'p2' } });
    expect(prisma.audit_logs.create).not.toHaveBeenCalled();
    expect(tx.audit_logs.create).toHaveBeenCalledTimes(1);
    expect(tx.audit_logs.create.mock.calls[0][0].data).toEqual({
      user_id: 'u1', action: 'PERSON_MERGE', entity_type: 'person', entity_id: 'p1',
      old_value: { source_id: 'p2', source_name: 'N. Kumar' },
      new_value: { target_id: 'p1', candidates_moved: 3 },
    });
  });

  it('a failing audit insert inside the merge still merges', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, tx } = make();
    tx.audit_logs.create.mockRejectedValue(new Error('x'));
    await expect(svc.merge('p2', 'p1', 'u1')).resolves.toEqual({ merged: true, target_id: 'p1' });
    expect(tx.$executeRawUnsafe).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT audit_row');
    warn.mockRestore();
  });
});

describe('Person input DTOs', () => {
  it.each([['update', UpdatePersonDto], ['create', CreatePersonDto]] as const)('%s maps every blank nullable text field to null', async (_, cls) => {
    const blank = { name: 'N', gender: '', education: '', bio: '', photo_url: '', date_of_birth: '', wikipedia_url: '' };
    const dto = plainToInstance(cls, blank) as unknown as Record<string, unknown>;
    expect(await validate(dto)).toEqual([]);
    for (const k of ['gender', 'education', 'bio', 'photo_url', 'date_of_birth', 'wikipedia_url']) expect(dto[k]).toBeNull();
    expect(dto.name).toBe('N');
  });
});
