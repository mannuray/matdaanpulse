import { HoldsService } from './holds.service';

const NOW = new Date('2027-02-27T04:12:00Z');
describe('HoldsService', () => {
  it('upsert sets expiry now + minutes and returns it', async () => {
    const tx: any = { seat_holds: { upsert: jest.fn(async () => ({})) } };
    const svc = new HoldsService({} as any);
    const exp = await svc.upsert(tx, 'e', 'S1', 7, 10, 'u1', NOW);
    expect(exp).toEqual(new Date(NOW.getTime() + 600_000));
    expect(tx.seat_holds.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { election_id_const_id: { election_id: 'e', const_id: 'S1' } },
      create: expect.objectContaining({ round_at_hold: 7, expires_at: exp, created_by: 'u1' }),
      update: expect.objectContaining({ round_at_hold: 7, expires_at: exp }),
    }));
  });
  it('release deletes the seat hold', async () => {
    const prisma: any = { seat_holds: { deleteMany: jest.fn(async () => ({ count: 1 })) } };
    await new HoldsService(prisma).release('e', 'S1');
    expect(prisma.seat_holds.deleteMany).toHaveBeenCalledWith({ where: { election_id: 'e', const_id: 'S1' } });
  });
  it('list returns the query rows', async () => {
    const rows = [{ const_id: 'S1' }];
    const prisma: any = { $queryRaw: jest.fn(async () => rows) };
    expect(await new HoldsService(prisma).list('e', NOW)).toBe(rows);
  });
});
