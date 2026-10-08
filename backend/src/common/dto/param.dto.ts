import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { CONST_ID_MAX, CONST_ID_RE, PARTY_ID_MAX, PARTY_ID_RE } from '../validation/ids';

/** Route-param DTOs (`@Param() { id }: …`), run by the global ValidationPipe: a malformed id is a 400 before any query. */

export class ConstIdParamDto {
  @IsString() @IsNotEmpty() @MaxLength(CONST_ID_MAX) @Matches(CONST_ID_RE, { message: 'id must be a constituency id' })
  id!: string;
}

export class PartyIdParamDto {
  @IsString() @IsNotEmpty() @MaxLength(PARTY_ID_MAX) @Matches(PARTY_ID_RE, { message: 'id must be a party id' })
  id!: string;
}
