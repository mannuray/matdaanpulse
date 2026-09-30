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

describe('RedisService resilience', () => {
  const metrics = {
    eventsPublished: { add: jest.fn() },
    redisPublishErrors: { add: jest.fn() },
    redisPublishDuration: { record: jest.fn() },
  };
  function make() {
    const config = { get: () => undefined };
    const svc = new RedisService(config as any, metrics as any);
    const pub = { connect: jest.fn(), publish: jest.fn(), ping: jest.fn(), status: 'ready', quit: jest.fn().mockResolvedValue('OK'), disconnect: jest.fn() };
    const sub = { connect: jest.fn(), on: jest.fn(), status: 'ready', quit: jest.fn().mockResolvedValue('OK'), disconnect: jest.fn() };
    (svc as any).pub = pub;
    (svc as any).sub = sub;
    return { svc, pub, sub };
  }

  it('onModuleInit does not wait for (or fail on) the Redis connection', () => {
    const { svc, pub, sub } = make();
    pub.connect.mockRejectedValue(new Error('ECONNREFUSED'));
    sub.connect.mockReturnValue(new Promise(() => undefined)); // never settles
    expect(svc.onModuleInit()).toBeUndefined();
    expect(pub.connect).toHaveBeenCalled();
    expect(sub.connect).toHaveBeenCalled();
  });

  it('publish logs and resolves false instead of throwing', async () => {
    const { svc, pub } = make();
    pub.publish.mockRejectedValue(new Error('down'));
    await expect(svc.publish('ch', { a: 1 })).resolves.toBe(false);
    expect(metrics.redisPublishErrors.add).toHaveBeenCalled();
  });

  it('ping rejects after the timeout', async () => {
    const { svc, pub } = make();
    pub.ping.mockReturnValue(new Promise(() => undefined));
    await expect(svc.ping(20)).rejects.toThrow(/timed out/);
  });

  it('completeStreams emits shutdown$ and completes channel subjects', () => {
    const { svc } = make();
    (svc as any).sub.subscribe = jest.fn().mockResolvedValue(1);
    let shut = false;
    let done = false;
    svc.shutdown$.subscribe({ complete: () => (shut = true) });
    svc.subscribe('ch').subscribe({ complete: () => (done = true) });
    svc.completeStreams();
    expect(shut).toBe(true);
    expect(done).toBe(true);
  });

  it('close quits both connections once', async () => {
    const { svc, pub, sub } = make();
    await svc.close();
    await svc.close();
    expect(pub.quit).toHaveBeenCalledTimes(1);
    expect(sub.quit).toHaveBeenCalledTimes(1);
  });
});
