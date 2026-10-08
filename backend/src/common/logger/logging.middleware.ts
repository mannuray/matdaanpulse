import { Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { trace } from '@opentelemetry/api';
import { isHealthProbe } from '../http/health-probe';
import { routeTemplate } from '../http/route-template';
import { requestContext, resolveRequestId } from './request-context';

const SENSITIVE_QUERY_PARAMS = /([?&](?:token|key|access_token|api_key)=)[^&#]*/gi;
const ELECTION_IN_PATH = /\/elections\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?]|$)/i;

/** Mask credential-like query params so they never reach the logs. */
export function redactUrl(url: string): string {
  return url.replace(SENSITIVE_QUERY_PARAMS, '$1[REDACTED]');
}

/** The election id in a public `/elections/:id/...` path, for filtering logs by election. */
export function electionIdOf(url: string): string | undefined {
  return ELECTION_IN_PATH.exec(url)?.[1]?.toLowerCase();
}

/**
 * Request id + access log, registered as the FIRST Express middleware (configureApp), so requests answered before
 * Nest (origin shield 403, ingest key gate 401/429, body limit 413) are logged too, with the id their error carries.
 * One flat JSON line per request (nest-winston spreads an object message into top-level fields); health probes at
 * debug. The user agent and Authorization value are never logged.
 */
export function accessLog(logger = new Logger('HTTP')) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    // Client ids are accepted only if they match ^[\w-]{1,64}$ (review S-L2).
    const requestId = resolveRequestId(req.headers['x-request-id']);
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-ID', requestId);
    trace.getActiveSpan()?.setAttribute('request.id', requestId);
    const probe = isHealthProbe(req);

    res.on('finish', () => {
      const url = redactUrl(req.originalUrl);
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const electionId = electionIdOf(url);
      const line = {
        message: `${req.method} ${url} ${statusCode} ${duration}ms`,
        requestId, method: req.method, route: routeTemplate(req), url, statusCode, duration, ip: req.ip,
        ...(electionId ? { election_id: electionId } : {}),
        ...(req.headers.authorization ? { auth: true } : {}),
      };
      if (probe) logger.debug(line);
      else logger.log(line);
    });

    // Run the rest of the request inside async context so services can access requestId
    requestContext.run({ requestId }, () => next());
  };
}
