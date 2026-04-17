import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class CandidateNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.NOT_FOUND, `Candidate ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}
