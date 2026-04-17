import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class UserNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.USER_NOT_FOUND, `User ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}

export class PersonNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.PERSON_NOT_FOUND, `Person ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}
