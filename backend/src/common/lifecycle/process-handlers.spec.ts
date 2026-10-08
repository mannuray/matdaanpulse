import { EventEmitter } from 'events';
import { installProcessHandlers } from './process-handlers';

describe('installProcessHandlers', () => {
  function setup(flush = jest.fn().mockResolvedValue(undefined)) {
    const proc = new EventEmitter();
    const logger = { error: jest.fn() };
    const exit = jest.fn();
    installProcessHandlers({ proc, logger, flush, exit, flushTimeoutMs: 50 });
    return { proc, logger, exit, flush };
  }
  const settle = () => new Promise((r) => setTimeout(r, 0));

  it('an unhandled rejection is one fatal JSON error line with the stack, then traces are flushed and the process exits 1', async () => {
    const { proc, logger, exit, flush } = setup();
    const err = new Error('boom');
    proc.emit('unhandledRejection', err);
    await settle();
    expect(logger.error).toHaveBeenCalledWith({ message: 'Unhandled promise rejection: boom', event: 'fatal', kind: 'unhandledRejection' }, err.stack);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('an uncaught exception does the same; a non-Error reason is stringified', async () => {
    const { proc, logger, exit } = setup();
    proc.emit('uncaughtException', 'weird');
    await settle();
    expect(logger.error.mock.calls[0][0]).toMatchObject({ message: 'Uncaught exception: weird', event: 'fatal' });
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('a hanging flush does not keep the process alive', async () => {
    const { proc, exit } = setup(jest.fn(() => new Promise<void>(() => undefined)));
    proc.emit('uncaughtException', new Error('x'));
    await new Promise((r) => setTimeout(r, 80));
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('a second fatal event while exiting is logged but exits only once', async () => {
    const { proc, logger, exit } = setup();
    proc.emit('uncaughtException', new Error('a'));
    proc.emit('unhandledRejection', new Error('b'));
    await settle();
    expect(logger.error).toHaveBeenCalledTimes(2);
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
