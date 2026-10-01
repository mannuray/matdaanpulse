import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class ElectionNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.ELECTION_NOT_FOUND, `Election ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}

/** 409: a Finalized (archived) election is read-only for new candidates. */
export class ElectionFinalizedException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.ELECTION_FINALIZED, `Election ${id} is finalized; archived elections can't get new candidates`, HttpStatus.CONFLICT, { id });
  }
}
