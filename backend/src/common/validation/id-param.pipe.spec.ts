import { BadRequestException } from '@nestjs/common';
import { IdParamPipe } from './id-param.pipe';
import { CONST_ID_MAX, CONST_ID_RE, SHARD_NAME_RE } from './ids';

describe('IdParamPipe', () => {
  const seat = new IdParamPipe(CONST_ID_RE, CONST_ID_MAX, 'constituency id');

  it('passes a real id through unchanged', () => {
    expect(seat.transform('BR_VS_100_VALMIKI_NAGAR')).toBe('BR_VS_100_VALMIKI_NAGAR');
    expect(seat.transform('UP_VS_1_A&B')).toBe('UP_VS_1_A&B');
  });

  it.each([['', 'empty'], ['a*', 'glob'], ['x'.repeat(101), 'too long'], ['a b', 'space'], [['a'] as unknown as string, 'array']])(
    'rejects %j (%s) with a 400 naming the param', (bad) => {
      expect(() => seat.transform(bad)).toThrow(BadRequestException);
      expect(() => seat.transform(bad)).toThrow(/constituency id/);
    });

  it('shard names: lower-case letters, digits, _ and -, starting with a letter or digit, up to 40', () => {
    const shard = new IdParamPipe(SHARD_NAME_RE, 40, 'shard name');
    expect(shard.transform('north-1')).toBe('north-1');
    expect(() => shard.transform('North')).toThrow(BadRequestException);
    expect(() => shard.transform('-x')).toThrow(BadRequestException);
  });
});
