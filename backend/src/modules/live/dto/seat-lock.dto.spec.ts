import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SeatLockAcquire } from './seat-lock.dto';

const ELECTION = '3f2b8c1e-5d4a-4b7e-9c1d-2a6e8f0b1c3d';
const errorsFor = async (body: object) =>
  (await validate(plainToInstance(SeatLockAcquire, body))).map((e) => e.property);

describe('SeatLockAcquire validation', () => {
  it('accepts a real constituency id', async () => {
    expect(await errorsFor({ election_id: ELECTION, const_id: 'BR_VS_1_VALMIKI_NAGAR' })).toEqual([]);
  });
  it('accepts seeded ids containing &', async () => {
    expect(await errorsFor({ election_id: ELECTION, const_id: 'DAMAN_&_DIU' })).toEqual([]);
  });
  it('rejects empty and over-long const_id', async () => {
    expect(await errorsFor({ election_id: ELECTION, const_id: '' })).toContain('const_id');
    expect(await errorsFor({ election_id: ELECTION, const_id: 'A'.repeat(101) })).toContain('const_id');
  });
  it('rejects glob and key separator characters', async () => {
    for (const c of ['A*', 'A?', 'A[1]', 'A:B', 'A B']) {
      expect(await errorsFor({ election_id: ELECTION, const_id: c })).toContain('const_id');
    }
  });
  it('still requires election_id to be UUID-like', async () => {
    expect(await errorsFor({ election_id: 'nope', const_id: 'BR_VS_1_X' })).toContain('election_id');
  });
});
