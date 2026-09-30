import { EMPTY, Observable, catchError, defer, finalize, interval, map, merge, of, share, takeUntil } from 'rxjs';

/** Heartbeat interval: under common proxy idle timeouts (~60 s) with margin. */
export const SSE_HEARTBEAT_MS = 20_000;
/** Reconnect delay hint sent to EventSource clients (`retry:` field). */
export const SSE_RETRY_MS = 5_000;

export interface SharedSseOptions {
  /** Ends the stream for every subscriber (app shutdown). */
  shutdown$: Observable<unknown>;
  /** Called once when the shared stream tears down (last subscriber left, error, or shutdown). */
  onTeardown: () => void;
  onError: (err: Error) => void;
  heartbeatMs?: number;
}

/**
 * One shared stream per channel: events merged with a heartbeat `ping`,
 * completed on shutdown, reset when the last subscriber leaves (so the next
 * client builds a fresh one). Used by the live-results and enrichment SSE endpoints.
 */
export function sharedSseStream(events$: Observable<MessageEvent>, opts: SharedSseOptions): Observable<MessageEvent> {
  const heartbeat$ = interval(opts.heartbeatMs ?? SSE_HEARTBEAT_MS).pipe(
    map(() => ({ data: '', type: 'ping' }) as MessageEvent),
  );
  return merge(events$, heartbeat$).pipe(
    takeUntil(opts.shutdown$),
    catchError((err: Error) => {
      opts.onError(err);
      return EMPTY;
    }),
    finalize(opts.onTeardown),
    share({ resetOnRefCountZero: true }),
  );
}

/**
 * Per-connection wrapper: the first frame each client receives is a `ping`
 * carrying `retry: SSE_RETRY_MS`. Must be applied after share(), otherwise only
 * the first subscriber would see it.
 */
export function withReconnectHint(stream$: Observable<MessageEvent>): Observable<MessageEvent> {
  return defer(() => merge(of({ data: '', type: 'ping', retry: SSE_RETRY_MS } as unknown as MessageEvent), stream$));
}
