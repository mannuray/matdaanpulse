import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requestContext } from './request-context';

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

    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
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
