import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ErrorCodes } from '../exceptions/error-codes';
import { BusinessException } from '../exceptions/base.exception';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: any = 
      exception instanceof HttpException 
        ? exception.getResponse() 
        : { message: 'Internal server error' };

    const requestId = (request.headers['x-request-id'] as string) || uuidv4();
    response.setHeader('X-Request-ID', requestId);

    let errorCode: string = ErrorCodes.INTERNAL_SERVER_ERROR;
    let details: any = {};

    if (exception instanceof BusinessException) {
      errorCode = exception.code;
      details = exception.details || {};
    } else {
      // Map standard NestJS exceptions to our codes
      if (status === HttpStatus.UNAUTHORIZED) errorCode = ErrorCodes.AUTH_UNAUTHORIZED;
      if (status === HttpStatus.FORBIDDEN) errorCode = ErrorCodes.AUTH_FORBIDDEN;
      if (status === HttpStatus.NOT_FOUND) errorCode = ErrorCodes.NOT_FOUND;
      if (status === HttpStatus.BAD_REQUEST) errorCode = ErrorCodes.VALIDATION_FAILED;
      
      details = typeof exceptionResponse === 'object' ? exceptionResponse : { message: exceptionResponse };
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
}
