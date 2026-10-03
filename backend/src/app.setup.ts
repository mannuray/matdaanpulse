import { validationExceptionFactory } from './common/validation/validation-failed.exception';
import { Logger, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import * as compression from 'compression';
import helmet from 'helmet';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { buildCorsDelegate } from './common/config/cors';
import { resolveTrustProxyHops } from './common/config/trust-proxy';
import { cfConnectingIp, trustCfConnectingIp } from './common/config/client-ip';
import { StatusService } from './modules/status/status.service';
import { assertOriginConfig, originShield, parseOriginSecrets } from './common/config/origin-shield';
import { CacheControlInterceptor } from './common/http/cache-control';

type Env = Record<string, string | undefined>;

export const API_PREFIX = 'api/v1';
/** Default JSON/urlencoded body limit for every route (Express default). */
export const DEFAULT_BODY_LIMIT = '100kb';
/** Ingest seat batches: MAX_SEATS_PER_REQUEST (500) × ~20 candidates × ~60 B ≈ 0.6 MB. */
export const INGEST_PATH = `/${API_PREFIX}/ingest`;
export const INGEST_BODY_LIMIT = '5mb';

/** Query key tolerated on every route as a cache-buster (`?_=<timestamp>`); removed before validation. */
export const CACHE_BUSTER_QUERY_KEY = '_';

/**
 * Logs (debug) the resolved client IP of the first non-health request, with the
 * raw X-Forwarded-For and the configured hop count, so TRUST_PROXY_HOPS can be
 * verified on the host. Platform health checks come from inside the host
 * network without X-Forwarded-For and would be misleading, so they are skipped.
 */
export function clientIpProbe(logger: Logger, hops: number, cf = false) {
  let logged = false;
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!logged && !/\/health(\/|$|\?)/.test(req.originalUrl ?? req.url)) {
      logged = true;
      logger.debug(
        `Client IP check: req.ip=${req.ip} x-forwarded-for=${JSON.stringify(req.headers['x-forwarded-for'] ?? null)} ` +
          `cf-connecting-ip=${JSON.stringify(req.headers['cf-connecting-ip'] ?? null)} ` +
          `TRUST_PROXY_HOPS=${hops} TRUST_CF_CONNECTING_IP=${cf} (req.ip should be your own public IP)`,
      );
    }
    next();
  };
}

/** Strip the cache-buster key so `forbidNonWhitelisted` query DTOs don't 400 on it. */
function dropCacheBuster(req: Request, _res: Response, next: NextFunction) {
  if (req.query && CACHE_BUSTER_QUERY_KEY in req.query) delete (req.query as Record<string, unknown>)[CACHE_BUSTER_QUERY_KEY];
  next();
}

/**
 * Cheap gate before the 5 MB parser: anonymous clients can't make the server
 * parse large bodies. The real JWT + roles check still runs in the guards.
 */
export function requireBearerHeader(req: Request, _res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') return next(); // CORS preflight carries no Authorization
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && /^Bearer \S+$/.test(auth)) return next();
  next(new UnauthorizedException());
}

/**
 * Everything main.ts applies to the Nest app, shared with the HTTP tests.
 * The app must be created with `{ bodyParser: false }` so the body limits here are the only ones.
 */
export function configureApp(app: NestExpressApplication, env: Env = process.env) {
  const logger = new Logger('Bootstrap');

  // Origin shield first: requests that did not come through Cloudflare cost nothing.
  assertOriginConfig(env);
  const originSecrets = parseOriginSecrets(env);
  if (originSecrets.length > 0) {
    // Shield 403s are answered before the Nest middleware, so count them explicitly (System status page).
    let status: StatusService | undefined;
    try {
      status = app.get(StatusService, { strict: false });
    } catch {
      /* apps without the status module (some tests) simply do not count */
    }
    app.use(originShield(originSecrets, () => status?.recordShieldRejection()));
  }
  logger.log(
    originSecrets.length > 0
      ? `Origin shield on (${originSecrets.length} secret${originSecrets.length > 1 ? 's' : ''}); /health/live exempt`
      : 'Origin shield off (ORIGIN_SHARED_SECRETS not set)',
  );

  // Behind Render's proxy: req.ip comes from X-Forwarded-For, `hops` entries deep (review S-C1).
  const hops = resolveTrustProxyHops(env);
  app.set('trust proxy', hops);
  // Behind Cloudflare (origin reachable only via Cloudflare): the real client IP is CF-Connecting-IP.
  const cf = trustCfConnectingIp(env);
  if (cf) app.use(cfConnectingIp);
  app.use(clientIpProbe(logger, hops, cf));
  app.use(dropCacheBuster);

  // Body limits (review S-M3): 5 MB only for the ingest route, registered
  // first; the global parsers then skip the already-parsed body.
  app.use(INGEST_PATH, requireBearerHeader, json({ limit: INGEST_BODY_LIMIT }));
  app.use(json({ limit: DEFAULT_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: DEFAULT_BODY_LIMIT }));

  app.use(helmet());
  app.enableCors(buildCorsDelegate(env));

  app.set('etag', 'strong');
  app.use(compression());

  app.useGlobalInterceptors(new CacheControlInterceptor(), new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );

  app.setGlobalPrefix(API_PREFIX);
}
