import { Subject } from 'rxjs';
import { LiveController, SseConnections } from './live.controller';

function make(streamEvents: () => unknown) {
  const connections = new SseConnections();
  const metrics = { sseConnections: { add: jest.fn() } };
  const live = { streamEvents: jest.fn(streamEvents) };
  const controller = new LiveController(live as any, metrics as any, {} as any, connections);
  const handlers: Record<string, () => void> = {};
  const req = { on: (ev: string, cb: () => void) => { handlers[ev] = cb; } };
  return { controller, connections, metrics, handlers, req };
}

describe('SSE slot release', () => {
  it('releases once when both the stream finalizes and the request closes', () => {
    const subject = new Subject();
    const { controller, connections, metrics, handlers, req } = make(() => subject);
    connections.tryAcquire();
    const sub = controller.updates('e1', req).subscribe();
    expect(connections.open).toBe(1);
    sub.unsubscribe(); // finalize
    handlers.close(); // request close afterwards
    expect(connections.open).toBe(0);
    expect(metrics.sseConnections.add).toHaveBeenCalledTimes(2); // +1, -1 only
  });

  it('request close alone (client aborted before the stream was subscribed) frees the slot', () => {
    const { controller, connections, handlers, req } = make(() => new Subject());
    connections.tryAcquire();
    controller.updates('e1', req); // never subscribed
    expect(connections.open).toBe(1);
    handlers.close();
    expect(connections.open).toBe(0);
  });

  it('a synchronous failure in the handler releases the slot and rethrows', () => {
    const { controller, connections, req } = make(() => { throw new Error('boom'); });
    connections.tryAcquire();
    expect(() => controller.updates('e1', req)).toThrow('boom');
    expect(connections.open).toBe(0);
  });
});
