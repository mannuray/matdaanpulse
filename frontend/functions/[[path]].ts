import { handle, type Env } from '../edge/handler';

/** Every page route (public/_routes.json): crawler-ready HTML, then the SPA. Logic lives in edge/ (host-neutral, tested). */
export const onRequest: PagesFunction<Env> = ctx => handle(ctx, { fetchImpl: fetch, cache: caches.default });
