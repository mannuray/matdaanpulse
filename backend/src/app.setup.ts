import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import * as compression from 'compression';
import helmet from 'helmet';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { buildCorsOptions } from './common/config/cors';
import { resolveTrustProxyHops } from './common/config/trust-proxy';

type Env = Record<string, string | undefined>;

export const API_PREFIX = 'api/v1';
/** Default JSON/urlencoded body limit for every route (Express default). */
export const DEFAULT_BODY_LIMIT = '100kb';
/** The one route that needs large bodies: MAX_BULK_OVERRIDES (10k) × ~150 B ≈ 1.5 MB. */
export const BULK_OVERRIDE_PATH = `/${API_PREFIX}/admin/results/override-bulk`;
export const BULK_OVERRIDE_BODY_LIMIT = '5mb';

/** Logs req.ip once (debug) so the proxy hop count can be verified on the host. */
function firstRequestIpLogger(logger: Logger) {
  let logged = false;
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!logged) {
      logged = true;
      logger.debug(
        `First request: req.ip=${req.ip} req.ips=${JSON.stringify(req.ips)} x-forwarded-for=${req.headers['x-forwarded-for'] ?? '-'}`,
      );
    }
    next();
  };
}

/**
 * Everything main.ts applies to the Nest app, shared with the HTTP tests.
 * The app must be created with `{ bodyParser: false }` so the body limits here are the only ones.
 */
export function configureApp(app: NestExpressApplication, env: Env = process.env) {
  const logger = new Logger('Bootstrap');

  // Behind Render's proxy: req.ip comes from X-Forwarded-For, `hops` entries deep (review S-C1).
  app.set('trust proxy', resolveTrustProxyHops(env));
  app.use(firstRequestIpLogger(logger));

  // Body limits (review S-M3): 5 MB only for the bulk override route, registered
  // first; the global parsers then skip the already-parsed body.
  app.use(BULK_OVERRIDE_PATH, json({ limit: BULK_OVERRIDE_BODY_LIMIT }));
  app.use(json({ limit: DEFAULT_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: DEFAULT_BODY_LIMIT }));

  app.use(helmet());
  app.enableCors(buildCorsOptions(env));

  app.set('etag', 'strong');
  app.use(compression());

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix(API_PREFIX);
}
