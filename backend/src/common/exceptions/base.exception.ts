import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

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
