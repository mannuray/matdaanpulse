import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes';

export abstract class BusinessException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details?: Record<string, unknown>,
    public readonly cause?: Error,
  ) {
    super({ code, message, details }, status, { cause });
  }
}
