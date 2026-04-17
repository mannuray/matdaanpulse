import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class ElectionNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.ELECTION_NOT_FOUND, `Election ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}
