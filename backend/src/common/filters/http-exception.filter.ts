import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Prisma } from '@prisma/client';
import { ErrorCodes } from '../exceptions/error-codes';
import { BusinessException } from '../exceptions/base.exception';
import { resolveRequestId } from '../logger/request-context';
import { mapExposedHttpError, mapPrismaError } from './prisma-error.mapper';
import { FieldError, ValidationFailedException } from '../validation/validation-failed.exception';
import { redactUrl } from '../logger/logging.middleware';

/**
 * The throttler names its headers per throttler (`Retry-After-public`). Clients
 * (and CDNs) only understand the standard `Retry-After`, so mirror the longest wait.
 */
function copyRetryAfter(response: Response) {
  if (typeof response.getHeaderNames !== 'function') return;
  const waits = response
    .getHeaderNames()
    .filter((n) => /^retry-after-/i.test(n))
    .map((n) => Number(response.getHeader(n)))
    .filter((n) => Number.isFinite(n) && n >= 0);
  if (waits.length > 0) response.setHeader('Retry-After', String(Math.ceil(Math.max(...waits))));
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Known Prisma errors and exposed 4xx http-errors (body-parser) keep a 4xx; anything else is a 500.
    const httpException =
      exception instanceof HttpException ? exception : mapPrismaError(exception) ?? mapExposedHttpError(exception);

    const status = httpException ? httpException.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any = httpException
      ? httpException.getResponse()
      : { message: 'Internal server error' };

    // The logging middleware already sanitised the header; re-check for safety.
    const requestId = resolveRequestId(request.headers['x-request-id']);
    response.setHeader('X-Request-ID', requestId);
    // Errors are never cacheable (a public route's policy is only set on success).
    response.setHeader('Cache-Control', 'no-store');
    if (status === HttpStatus.TOO_MANY_REQUESTS) copyRetryAfter(response);

    // A PrismaClientValidationError is answered with 400 but almost always means a
    // server-side query bug, so it is logged like a 5xx (review M9).
    if (status >= 500 || exception instanceof Prisma.PrismaClientValidationError) {
      this.reportServerError(exception, status, requestId, request);
    }

    let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal server error';
    let details: Record<string, unknown> | undefined;
    let fields: FieldError[] | undefined;

    if (httpException instanceof ValidationFailedException) {
      errorCode = ErrorCodes.VALIDATION_FAILED;
      message = 'Validation failed';
      fields = httpException.fields;
    } else if (httpException instanceof BusinessException) {
      errorCode = httpException.code;
      message = (exceptionResponse as { message?: string }).message ?? httpException.message;
      if (httpException.details && Object.keys(httpException.details).length > 0) details = httpException.details;
    } else if (httpException) {
      if (status === HttpStatus.UNAUTHORIZED) errorCode = ErrorCodes.AUTH_UNAUTHORIZED;
      if (status === HttpStatus.FORBIDDEN) errorCode = ErrorCodes.AUTH_FORBIDDEN;
      if (status === HttpStatus.NOT_FOUND) errorCode = ErrorCodes.NOT_FOUND;
      if (status === HttpStatus.BAD_REQUEST) errorCode = ErrorCodes.VALIDATION_FAILED;
      if (status === HttpStatus.CONFLICT) errorCode = ErrorCodes.CONFLICT;
      const raw = typeof exceptionResponse === 'string' ? exceptionResponse : exceptionResponse?.message;
      message = Array.isArray(raw) ? raw.join('; ') : typeof raw === 'string' ? raw : httpException.message;
    }

    // 5xx never exposes exception text (the real one is logged above).
    if (status >= 500) message = 'Internal server error';

    const errorResponse = {
      success: false,
      error: {
        code: errorCode,
        message,
        requestId,
        timestamp: new Date().toISOString(),
        path: (request.url ?? '').split('?')[0],
        ...(fields ? { fields } : {}),
        ...(details ? { details } : {}),
      },
    };

    response.status(status).json(errorResponse);
  }

  /** 5xx: full detail goes to logs and the active span, never to the client. */
  private reportServerError(exception: unknown, status: number, requestId: string, request: Request) {
    const err = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(
      `${request.method} ${redactUrl(request.originalUrl ?? request.url)} → ${status}: ${err.message} [requestId=${requestId}]`,
      err.stack,
    );
    const span = trace.getActiveSpan();
    if (span) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    }
  }
}
