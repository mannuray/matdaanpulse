import { serve, type Env } from '../edge/handler';

/** Every page route (public/_routes.json): crawler-ready HTML, then the SPA. Logic lives in edge/ (host-neutral, tested). */
export const onRequest: PagesFunction<Env> = ctx => {
  // Belt and braces with serve()'s own fallback: an uncaught error goes to the static assets, never an error page.
  ctx.passThroughOnException();
  return serve(ctx, { fetchImpl: fetch, cache: caches.default });
};
