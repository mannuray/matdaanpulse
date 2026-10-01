import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class FeedbackNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.FEEDBACK_NOT_FOUND, `Feedback ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}
