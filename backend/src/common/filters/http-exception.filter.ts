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
import { BusinessException, LoadSheddingException, ServiceBusyException } from '../exceptions/base.exception';
import { resolveRequestId } from '../logger/request-context';
import { mapExposedHttpError, mapPrismaError } from './prisma-error.mapper';
import { FieldError, ValidationFailedException } from '../validation/validation-failed.exception';
import { redactUrl } from '../logger/logging.middleware';
import { RateLimitedLog } from '../util/rate-limited-log';

/** Counts DB-pool rejections (System status page); optional so tests and bare apps need none. */
export interface ServiceBusyRecorder {
  recordServiceBusy(): void;
}

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
  // Load shedding comes in floods (every request while the pool is full): one warn line a minute per kind.
  private readonly shedLog = new RateLimitedLog(60_000);

  constructor(private readonly status?: ServiceBusyRecorder) {}

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
    const shed = httpException instanceof LoadSheddingException ? httpException : null;
    if (shed) {
      response.setHeader('Retry-After', String(shed.retryAfterSeconds));
      if (shed instanceof ServiceBusyException) this.status?.recordServiceBusy();
      this.reportShed(shed.code, status, request);
    } else if (status >= 500 || exception instanceof Prisma.PrismaClientValidationError) {
      // A PrismaClientValidationError is answered with 400 but almost always means a
      // server-side query bug, so it is logged like a 5xx (review M9).
      // A BusinessException 5xx keeps its client-safe message below but is still an outage, so it is logged too.
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
      // DTO validation is ValidationFailedException (VALIDATION_9001 with fields); a bare 400 is a plain bad request.
      if (status === HttpStatus.BAD_REQUEST) errorCode = ErrorCodes.BAD_REQUEST;
      if (status === HttpStatus.CONFLICT) errorCode = ErrorCodes.CONFLICT;
      if (status === HttpStatus.PAYLOAD_TOO_LARGE) errorCode = ErrorCodes.PAYLOAD_TOO_LARGE;
      if (status === HttpStatus.TOO_MANY_REQUESTS) errorCode = ErrorCodes.TOO_MANY_REQUESTS;
      const raw = typeof exceptionResponse === 'string' ? exceptionResponse : exceptionResponse?.message;
      message = Array.isArray(raw) ? raw.join('; ') : typeof raw === 'string' ? raw : httpException.message;
      // The throttler's own text is "ThrottlerException: Too Many Requests".
      if (status === HttpStatus.TOO_MANY_REQUESTS) message = 'Too many requests; please wait and try again';
    }

    // Unexpected 5xx never exposes exception text (the real one is logged above).
    if (status >= 500 && !(httpException instanceof BusinessException)) message = 'Internal server error';

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

  /** Load shedding: expected under a spike, so a warn without a stack, at most once a minute per kind. */
  private reportShed(code: string, status: number, request: Request) {
    if (!this.shedLog.shouldLog(code)) return;
    this.logger.warn({
      message: `${request.method} ${redactUrl(request.originalUrl ?? request.url)} → ${status}: shedding load (${code}); further ones this minute are not logged`,
      event: 'load_shed', code, statusCode: status,
    });
  }

  /** 5xx: full detail goes to logs and the active span, never to the client. */
  private reportServerError(exception: unknown, status: number, requestId: string, request: Request) {
    const err = exception instanceof Error ? exception : new Error(String(exception));
    // A wrapped cause (e.g. the blob store's error behind MEDIA_0002) is the useful part.
    const raw = (err as { cause?: unknown }).cause;
    const cause = raw instanceof Error ? raw : undefined;
    const prisma = prismaSummary(err);
    this.logger.error(
      `${request.method} ${redactUrl(request.originalUrl ?? request.url)} → ${status}: ${prisma ?? err.message}` +
        `${cause ? ` (cause: ${cause.message})` : ''} [requestId=${requestId}]`,
      // A Prisma message (and so its stack) can render the query arguments: emails, password hashes.
      prisma ? undefined : cause?.stack ?? err.stack,
    );
    const span = trace.getActiveSpan();
    if (span) {
      const safe = prisma ? new Error(prisma) : err;
      span.recordException(safe);
      span.setStatus({ code: SpanStatusCode.ERROR, message: safe.message });
    }
  }
}

/** "<class> <code>: <first line>" for a Prisma error (the rest of its message can carry query arguments), else null. */
export function prismaSummary(err: Error): string | null {
  const isPrisma =
    err instanceof Prisma.PrismaClientKnownRequestError ||
    err instanceof Prisma.PrismaClientValidationError ||
    err instanceof Prisma.PrismaClientUnknownRequestError ||
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError;
  if (!isPrisma) return null;
  const code = (err as { code?: unknown }).code;
  const first = err.message.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  return `${err.constructor.name}${typeof code === 'string' ? ` ${code}` : ''}: ${first.slice(0, 200)}`;
}
