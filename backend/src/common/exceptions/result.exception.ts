import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class ResultNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.RESULT_NOT_FOUND, `Result ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}

export class SeatLockedException extends BusinessException {
  constructor(lock: Record<string, unknown>) {
    super(ErrorCodes.SEAT_LOCKED, 'Seat is being edited by someone else', HttpStatus.CONFLICT, { lock });
  }
}

export class LocksUnavailableException extends BusinessException {
  constructor() {
    super(ErrorCodes.LOCKS_UNAVAILABLE, 'Seat locking is unavailable (Redis down)', HttpStatus.SERVICE_UNAVAILABLE);
  }
}
