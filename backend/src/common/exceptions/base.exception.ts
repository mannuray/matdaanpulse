import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ErrorCodes } from './error-codes';

/** Contract: `message` and `details` are sent to clients even at 5xx, so never put internal details in them (use `cause`). */
export abstract class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
    cause?: Error,
  ) {
    super({ code, message, details }, status, { cause });
  }
}

/** The database is saturated (pool timeout, transaction could not start in time): retry after `retryAfterSeconds`. */
export class ServiceBusyException extends BusinessException {
  constructor(public readonly retryAfterSeconds = 2) {
    super(ErrorCodes.SERVICE_BUSY, 'The server is busy; please retry shortly', HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/** `?v=` names a results version this server does not have yet: not "missing", so clients retry instead of giving up. */
export class VersionNotReadyException extends BusinessException {
  constructor() {
    super(ErrorCodes.VERSION_NOT_READY, 'This version is not available yet', HttpStatus.NOT_FOUND);
  }
}
