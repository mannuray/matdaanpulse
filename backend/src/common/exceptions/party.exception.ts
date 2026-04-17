import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class PartyNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.PARTY_NOT_FOUND, `Party ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}
