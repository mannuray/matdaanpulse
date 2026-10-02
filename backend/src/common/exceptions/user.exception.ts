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

export class PersonMergeNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.PERSON_MERGE_NOT_FOUND, `Merge ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}

/** 409: the merge was already undone, its keeper is gone, or some of its candidates moved on. */
export class PersonMergeNotUndoableException extends BusinessException {
  constructor(message: string, details?: Record<string, unknown>) {
    super(ErrorCodes.PERSON_MERGE_NOT_UNDOABLE, message, HttpStatus.CONFLICT, details);
  }
}
