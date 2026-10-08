import { EventEmitter } from 'events';
import { accessLog, accessLogSampleRate, electionIdOf, redactUrl } from './logging.middleware';

describe('access log helpers', () => {
  it('picks the election id out of a public /elections/:id path, lower-cased', () => {
    const id = 'B2C3D4E5-F6A7-8901-BCDE-F12345678901';
    expect(electionIdOf(`/api/v1/elections/${id}/live`)).toBe(id.toLowerCase());
    expect(electionIdOf(`/api/v1/elections/${id.toLowerCase()}`)).toBe(id.toLowerCase());
    expect(electionIdOf(`/api/v1/elections/${id.toLowerCase()}?v=3`)).toBe(id.toLowerCase());
    expect(electionIdOf('/api/v1/elections/not-a-uuid/live')).toBeUndefined();
    expect(electionIdOf('/api/v1/parties')).toBeUndefined();
  });

  it('masks credential-like query params', () => {
    expect(redactUrl('/x?token=abc&v=2&api_key=k')).toBe('/x?token=[REDACTED]&v=2&api_key=[REDACTED]');
  });

  describe('sampling (ACCESS_LOG_SAMPLE)', () => {
    it('reads 0..1, default 1 (log everything)', () => {
      expect(accessLogSampleRate({})).toBe(1);
      expect(accessLogSampleRate({ ACCESS_LOG_SAMPLE: '0.1' })).toBe(0.1);
      expect(accessLogSampleRate({ ACCESS_LOG_SAMPLE: '5' })).toBe(1);
      expect(accessLogSampleRate({ ACCESS_LOG_SAMPLE: 'x' })).toBe(1);
    });

    function hit(mw: ReturnType<typeof accessLog>, method: string, statusCode: number, auth = false) {
      const res: any = Object.assign(new EventEmitter(), { statusCode, setHeader: () => undefined });
      const req: any = { method, originalUrl: '/api/v1/elections', headers: auth ? { authorization: 'Bearer x' } : {}, ip: '1.2.3.4' };
      mw(req, res, () => undefined);
      res.emit('finish');
    }

    it('drops sampled-out successful anonymous GETs only; errors, writes and authenticated calls are always logged', () => {
      const logger = { log: jest.fn(), debug: jest.fn() };
      const mw = accessLog(logger as any, { sampleRate: 0.1, random: () => 0.5 });
      hit(mw, 'GET', 200);
      hit(mw, 'GET', 304);
      expect(logger.log).not.toHaveBeenCalled();
      hit(mw, 'GET', 404);
      hit(mw, 'GET', 503);
      hit(mw, 'POST', 201);
      hit(mw, 'GET', 200, true);
      expect(logger.log).toHaveBeenCalledTimes(4);
      const kept = accessLog(logger as any, { sampleRate: 0.1, random: () => 0.05 });
      hit(kept, 'GET', 200);
      expect(logger.log).toHaveBeenCalledTimes(5);
    });
  });
});
