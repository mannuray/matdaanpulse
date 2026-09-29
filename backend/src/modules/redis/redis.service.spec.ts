import { share, Subscription } from 'rxjs';
import { RedisService } from './redis.service';

describe('RedisService.subscribe', () => {
  function makeService() {
    const config = { get: (_k: string, d: unknown) => d };
    const svc = new RedisService(config as any, {} as any);
    const sub = { subscribe: jest.fn().mockResolvedValue(1), unsubscribe: jest.fn().mockResolvedValue(1) };
    (svc as any).sub = sub;
    const emit = (channel: string, msg: string) => (svc as any).channels.get(channel)?.subject.next(msg);
    return { svc, sub, emit };
  }

  it('does not subscribe to Redis until the observable is subscribed', () => {
    const { svc, sub } = makeService();
    svc.subscribe('ch');
    expect(sub.subscribe).not.toHaveBeenCalled();
  });

  it('recovers after the last subscriber of a shared stream leaves', () => {
    const { svc, sub, emit } = makeService();
    const shared$ = svc.subscribe('ch').pipe(share({ resetOnRefCountZero: true }));

    const first: string[] = [];
    let s: Subscription = shared$.subscribe((m) => first.push(m));
    emit('ch', 'a');
    s.unsubscribe();
    expect(sub.unsubscribe).toHaveBeenCalledWith('ch');

    const second: string[] = [];
    s = shared$.subscribe((m) => second.push(m));
    emit('ch', 'b');
    s.unsubscribe();

    expect(first).toEqual(['a']);
    expect(second).toEqual(['b']);
    expect(sub.subscribe).toHaveBeenCalledTimes(2);
  });

  it('keeps the Redis subscription while other subscribers remain', () => {
    const { svc, sub, emit } = makeService();
    const got: string[] = [];
    const s1 = svc.subscribe('ch').subscribe();
    const s2 = svc.subscribe('ch').subscribe((m) => got.push(m));
    s1.unsubscribe();
    emit('ch', 'x');
    expect(got).toEqual(['x']);
    expect(sub.unsubscribe).not.toHaveBeenCalled();
    s2.unsubscribe();
    expect(sub.unsubscribe).toHaveBeenCalledTimes(1);
  });
});
