import { CallHandler, ExecutionContext, Injectable, NestInterceptor, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SSE_METADATA } from '@nestjs/common/constants';
import { Observable, tap } from 'rxjs';

/**
 * Cache-Control values (docs/DEPLOYMENT.md §2.2). `s-maxage` is for the CDN
 * (Cloudflare); browsers always revalidate (`max-age=0`) except for versioned
 * snapshots, which never change.
 */
export const CACHE_CONTROL = {
  /** Default for public GETs (elections, constituencies, parties, …). */
  PUBLIC: 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
  /** GET /elections/:id/live — polled by every viewer. */
  LIVE: 'public, max-age=0, s-maxage=5, stale-while-revalidate=10',
  /** GET /elections/:id/results without ?v= (latest, unversioned). */
  RESULTS_LATEST: 'public, max-age=0, s-maxage=10, stale-while-revalidate=30',
  /** GET /elections/:id/results?v=<current version>. */
  IMMUTABLE: 'public, max-age=31536000, immutable',
  /** Redirect from an older ?v= to the current one: only for a few seconds. */
  REDIRECT: 'public, max-age=0, s-maxage=5',
  /** Admin, auth, health, errors, anything without an explicit policy. */
  NO_STORE: 'no-store',
} as const;

export const CACHE_CONTROL_KEY = 'http:cache-control';

/** Opt a controller or handler into a public Cache-Control policy (GET/HEAD successes only). */
export const CacheControl = (value: string) => SetMetadata(CACHE_CONTROL_KEY, value);

/**
 * Sets Cache-Control on successful responses: the handler's/controller's
 * @CacheControl value for GET/HEAD, otherwise `no-store`. A header the handler
 * already set (e.g. @Header or res.setHeader) wins. Errors never reach this
 * path — HttpExceptionFilter sends them with `no-store`, so the CDN never
 * caches a 4xx/5xx under a public policy.
 */
@Injectable()
export class CacheControlInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector = new Reflector()) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // SSE streams manage their own headers (Nest sends `no-cache` for text/event-stream).
    if (context.getType() !== 'http' || Reflect.getMetadata(SSE_METADATA, context.getHandler())) return next.handle();
    const req = context.switchToHttp().getRequest<{ method?: string }>();
    const res = context.switchToHttp().getResponse<{
      headersSent?: boolean;
      getHeader?(n: string): unknown;
      setHeader?(n: string, v: string): void;
    }>();
    const policy = this.reflector.getAllAndOverride<string | undefined>(CACHE_CONTROL_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const cacheable = req?.method === 'GET' || req?.method === 'HEAD';
    const value = cacheable && policy ? policy : CACHE_CONTROL.NO_STORE;

    return next.handle().pipe(
      tap(() => {
        if (!res || res.headersSent || typeof res.setHeader !== 'function') return;
        if (res.getHeader?.('Cache-Control') !== undefined) return;
        res.setHeader('Cache-Control', value);
      }),
    );
  }
}
