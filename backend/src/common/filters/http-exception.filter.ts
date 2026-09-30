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
import { redactUrl } from '../logger/logging.middleware';

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

    // A PrismaClientValidationError is answered with 400 but almost always means a
    // server-side query bug, so it is logged like a 5xx (review M9).
    if (status >= 500 || exception instanceof Prisma.PrismaClientValidationError) {
      this.reportServerError(exception, status, requestId, request);
    }

    let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR;
    let details: any = {};

    if (httpException instanceof BusinessException) {
      errorCode = httpException.code;
      details = httpException.details || {};
    } else if (httpException) {
      // Map standard NestJS exceptions to our codes
      if (status === HttpStatus.UNAUTHORIZED) errorCode = ErrorCodes.AUTH_UNAUTHORIZED;
      if (status === HttpStatus.FORBIDDEN) errorCode = ErrorCodes.AUTH_FORBIDDEN;
      if (status === HttpStatus.NOT_FOUND) errorCode = ErrorCodes.NOT_FOUND;
      if (status === HttpStatus.BAD_REQUEST) errorCode = ErrorCodes.VALIDATION_FAILED;
      if (status === HttpStatus.CONFLICT) errorCode = ErrorCodes.CONFLICT;

      details = typeof exceptionResponse === 'object' ? exceptionResponse : { message: exceptionResponse };
    } else {
      details = exceptionResponse;
    }

    const errorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: typeof exceptionResponse === 'string' ? exceptionResponse : exceptionResponse.message,
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
        details: details,
        validationErrors: exceptionResponse.message instanceof Array ? exceptionResponse.message : [],
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
