import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { requestContext, resolveRequestId } from './request-context';

const SENSITIVE_QUERY_PARAMS = /([?&](?:token|key|access_token|api_key)=)[^&#]*/gi;

/** Mask credential-like query params so they never reach the logs. */
export function redactUrl(url: string): string {
  return url.replace(SENSITIVE_QUERY_PARAMS, '$1[REDACTED]');
}

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, ip } = req;
    const originalUrl = redactUrl(req.originalUrl);
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    // Client ids are accepted only if they match ^[\w-]{1,64}$ (review S-L2).
    const requestId = resolveRequestId(req.headers['x-request-id']);
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);

    const authHeader = req.headers['authorization'];

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      this.logger.log(
        `${method} ${originalUrl} ${statusCode} ${duration}ms - ${ip} ${userAgent} [Auth: ${authHeader ? 'Present' : 'None'}]`,
        { requestId, method, url: originalUrl, statusCode, duration, ip },
      );
    });

    // Run the rest of the request inside async context so services can access requestId
    requestContext.run({ requestId }, () => next());
  }
}
