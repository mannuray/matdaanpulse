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

/** Deliberate load shedding (503 + Retry-After): expected under a spike, so logged as a rate-limited warn, not an error. */
export abstract class LoadSheddingException extends BusinessException {
  constructor(code: ErrorCode, message: string, public readonly retryAfterSeconds: number) {
    super(code, message, HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/** The database is saturated (pool timeout, transaction could not start in time): retry after `retryAfterSeconds`. */
export class ServiceBusyException extends LoadSheddingException {
  constructor(retryAfterSeconds = 2) {
    super(ErrorCodes.SERVICE_BUSY, 'The server is busy; please retry shortly', retryAfterSeconds);
  }
}

/** The per-process cap on live stream (SSE) connections is reached. */
export class LiveStreamCapacityException extends LoadSheddingException {
  constructor() {
    super(ErrorCodes.SERVICE_UNAVAILABLE, 'Too many live stream connections', 5);
  }
}

/** `?v=` names a results version this server does not have yet: not "missing", so clients retry instead of giving up. */
export class VersionNotReadyException extends BusinessException {
  constructor() {
    super(ErrorCodes.VERSION_NOT_READY, 'This version is not available yet', HttpStatus.NOT_FOUND);
  }
}
