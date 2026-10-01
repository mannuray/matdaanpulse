import { CandidatesService } from './candidates.service';
import { ConstituencyNotFoundException } from '../../common/exceptions';

describe('CandidatesService.create', () => {
  function make(seat: unknown = { id: 'BR_VS_1', election_id: 'e1' }) {
    const tx = {
      constituencies: { findFirst: jest.fn().mockResolvedValue(seat) },
      candidates: { create: jest.fn().mockResolvedValue({ id: 'c-new', election_id: 'e1', const_id: 'BR_VS_1', name: 'Ravi' }) },
      results: { create: jest.fn().mockResolvedValue({ id: 'r-new' }) },
    };
    const prisma = {
      candidates: { create: jest.fn() },
      results: { create: jest.fn() },
      $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)),
    };
    const svc = new CandidatesService(prisma as any);
    return { svc, tx, prisma };
  }

  const body = { election_id: 'e1', const_id: 'BR_VS_1', name: 'Ravi', party_id: null, metadata: { age: 40 } };

  it('checks the seat belongs to the election, then creates the candidate and its results row in one transaction', async () => {
    const { svc, tx, prisma } = make();
    await expect(svc.create(body as any)).resolves.toMatchObject({ id: 'c-new' });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.constituencies.findFirst).toHaveBeenCalledWith({ where: { id: 'BR_VS_1', election_id: 'e1' }, select: { id: true } });
    expect(tx.candidates.create).toHaveBeenCalledWith({ data: body });
    expect(tx.results.create).toHaveBeenCalledWith({
      data: { candidate_id: 'c-new', const_id: 'BR_VS_1', election_id: 'e1', votes: 0, status: 'TRAILING', margin: 0 },
    });
    // Nothing is written outside the transaction.
    expect(prisma.candidates.create).not.toHaveBeenCalled();
    expect(prisma.results.create).not.toHaveBeenCalled();
  });

  it('rejects a seat of another election with ConstituencyNotFound (404) and writes nothing', async () => {
    const { svc, tx } = make(null);
    const err = await svc.create(body as any).catch((e) => e);
    expect(err).toBeInstanceOf(ConstituencyNotFoundException);
    expect(err.getStatus()).toBe(404);
    expect(tx.candidates.create).not.toHaveBeenCalled();
    expect(tx.results.create).not.toHaveBeenCalled();
  });
});
