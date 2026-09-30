import { ReplaySubject, Subject, Subscription } from 'rxjs';
import { SSE_HEARTBEAT_MS, SSE_RETRY_MS, sharedSseStream, withReconnectHint } from './shared-sse-stream';

describe('SSE constants', () => {
  it('heartbeat is 20 s and retry hint is 5 s', () => {
    expect(SSE_HEARTBEAT_MS).toBe(20_000);
    expect(SSE_RETRY_MS).toBe(5_000);
  });
});

describe('sharedSseStream', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  function setup() {
    const events = new Subject<MessageEvent>();
    const shutdown = new Subject<void>();
    const onTeardown = jest.fn();
    const stream$ = sharedSseStream(events.asObservable(), { shutdown$: shutdown, onTeardown, onError: jest.fn() });
    return { events, shutdown, onTeardown, stream$ };
  }

  it('merges events with a ping every SSE_HEARTBEAT_MS', () => {
    const { events, stream$ } = setup();
    const got: string[] = [];
    const s = stream$.subscribe((e) => got.push(e.type));
    events.next({ type: 'result-update', data: '{}' } as MessageEvent);
    jest.advanceTimersByTime(SSE_HEARTBEAT_MS);
    expect(got).toEqual(['result-update', 'ping']);
    s.unsubscribe();
  });

  it('completes every subscriber on shutdown (so the HTTP server can close)', () => {
    const { shutdown, stream$, onTeardown } = setup();
    const done = [false, false];
    stream$.subscribe({ complete: () => (done[0] = true) });
    stream$.subscribe({ complete: () => (done[1] = true) });
    shutdown.next();
    expect(done).toEqual([true, true]);
    expect(onTeardown).toHaveBeenCalledTimes(1);
  });

  it('a client that connects after shutdown began completes immediately (review M6)', () => {
    const shutdown = new ReplaySubject<void>(1);
    shutdown.next();
    shutdown.complete();
    const stream$ = sharedSseStream(new Subject<MessageEvent>(), { shutdown$: shutdown, onTeardown: jest.fn(), onError: jest.fn() });
    let done = false;
    withReconnectHint(stream$).subscribe({ complete: () => (done = true) });
    expect(done).toBe(true);
  });

  it('is shared and tears down after the last subscriber leaves', () => {
    const { stream$, onTeardown } = setup();
    const a: Subscription = stream$.subscribe();
    const b: Subscription = stream$.subscribe();
    a.unsubscribe();
    expect(onTeardown).not.toHaveBeenCalled();
    b.unsubscribe();
    expect(onTeardown).toHaveBeenCalledTimes(1);
  });
});

describe('withReconnectHint', () => {
  it('sends retry on the first event of every connection', () => {
    const shared = new Subject<MessageEvent>();
    const first: MessageEvent[] = [];
    const second: MessageEvent[] = [];
    withReconnectHint(shared).subscribe((e) => first.push(e));
    withReconnectHint(shared).subscribe((e) => second.push(e));
    expect((first[0] as any).retry).toBe(SSE_RETRY_MS);
    expect((second[0] as any).retry).toBe(SSE_RETRY_MS);
    expect(first[0].type).toBe('ping');
  });
});
