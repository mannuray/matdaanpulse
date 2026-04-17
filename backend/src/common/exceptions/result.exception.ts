import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class ResultNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.RESULT_NOT_FOUND, `Result ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}
