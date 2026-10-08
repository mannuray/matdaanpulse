import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConstIdParamDto, PartyIdParamDto } from './param.dto';
import { CreatePartyDto } from '../../modules/parties/dto/party-input.dto';

// Same options as app.setup.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const validate = (metatype: any, value: Record<string, unknown>) => pipe.transform(value, { type: 'param', metatype });
const bad = (metatype: any, value: Record<string, unknown>) => expect(validate(metatype, value)).rejects.toBeInstanceOf(BadRequestException);

describe('route param DTOs', () => {
  it('constituency ids: letters, digits, _ & - (as seeded), at most 100 chars', async () => {
    for (const id of ['BR_VS_100_X', 'AS_VS16_29_KOKRAJHAR_WEST', 'DD_LS_1_DAMAN_&_DIU', 'DL_VS08_1_NARELA', 'UK_VS-1']) {
      await expect(validate(ConstIdParamDto, { id })).resolves.toMatchObject({ id });
    }
    for (const id of ['', 'BR VS 1', 'BR_VS_1*', 'a:b', '../x', 'X'.repeat(101)]) await bad(ConstIdParamDto, { id });
  });

  it('party ids: the seeded ids (letters, digits, _) plus & ( ) . + -, at most 20 chars (CreatePartyDto limit)', async () => {
    for (const id of ['BJP', 'NOTA', 'IND', 'INC_I', 'JD_U', 'CPI(M)', 'A.B', 'X'.repeat(20)]) {
      await expect(validate(PartyIdParamDto, { id })).resolves.toMatchObject({ id });
    }
    for (const id of ['', 'B J P', 'BJP;', 'X'.repeat(21), '%2F']) await bad(PartyIdParamDto, { id });
  });
});

describe('CreatePartyDto.id', () => {
  const body = (id: string) => pipe.transform({ id, name: 'X Party' }, { type: 'body', metatype: CreatePartyDto });
  it('takes the same shape as the party route param, so a new party is always reachable at /parties/:id', async () => {
    await expect(body('NEWP')).resolves.toBeDefined();
    await expect(body('CPI(ML)')).resolves.toBeDefined();
    await expect(body('NEW P')).rejects.toBeInstanceOf(BadRequestException);
    await expect(body('A/B')).rejects.toBeInstanceOf(BadRequestException);
  });
});
