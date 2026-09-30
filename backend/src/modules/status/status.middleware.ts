import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { routeTemplate } from './route-template';
import { StatusService } from './status.service';
import { isHealthProbe } from '../../common/http/health-probe';

/** Times every completed response and records it under its route template. */
@Injectable()
export class StatusMiddleware implements NestMiddleware {
  constructor(private readonly status: StatusService) {}

  use(req: Request, res: Response, next: NextFunction) {
    if (isHealthProbe(req)) return next(); // probes would inflate http.total and requests/min
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      try {
        const ms = Number(process.hrtime.bigint() - start) / 1e6;
        // req.route is set by Express once a handler matched; read at finish time.
        this.status.recordRequest(routeTemplate(req), res.statusCode, ms);
      } catch {
        /* counters must never affect a response */
      }
    });
    next();
  }
}
