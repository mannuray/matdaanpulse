import { isTracingEnabled, startTracing, tracingStatus, shutdownTracing, traceSampleRatio, buildSampler, isIgnoredIncoming } from './tracing';

describe('tracing', () => {
  it('is off without an OTLP endpoint', () => {
    expect(isTracingEnabled({})).toBe(false);
    expect(isTracingEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: '  ' })).toBe(false);
  });

  it('is on when an endpoint is set', () => {
    expect(isTracingEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://collector:4318' })).toBe(true);
  });

  it('OTEL_SDK_DISABLED=true wins over the endpoint', () => {
    expect(isTracingEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://c:4318', OTEL_SDK_DISABLED: 'true' })).toBe(false);
    expect(isTracingEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://c:4318', OTEL_SDK_DISABLED: 'TRUE ' })).toBe(false);
    expect(isTracingEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://c:4318', OTEL_SDK_DISABLED: 'false' })).toBe(true);
  });

  it('startTracing does nothing when disabled and shutdown is safe', async () => {
    expect(startTracing({})).toBe(false);
    expect(tracingStatus()).toMatch(/off/);
    await expect(shutdownTracing()).resolves.toBeUndefined();
  });

  describe('volume control (counting day: thousands of /live polls)', () => {
    it('samples 5% of root traces by default; OTEL_TRACE_SAMPLE_RATIO overrides, clamped to 0..1', () => {
      expect(traceSampleRatio({})).toBe(0.05);
      expect(traceSampleRatio({ OTEL_TRACE_SAMPLE_RATIO: '0.2' })).toBe(0.2);
      expect(traceSampleRatio({ OTEL_TRACE_SAMPLE_RATIO: '7' })).toBe(1);
      expect(traceSampleRatio({ OTEL_TRACE_SAMPLE_RATIO: '-1' })).toBe(0);
      expect(traceSampleRatio({ OTEL_TRACE_SAMPLE_RATIO: 'abc' })).toBe(0.05);
    });

    it('the sampler follows the parent decision and samples roots by ratio', () => {
      expect(buildSampler({ OTEL_TRACE_SAMPLE_RATIO: '0.1' }).toString()).toMatch(/^ParentBased\{root=TraceIdRatioBased\{0\.1\}/);
    });

    it('health probes and CORS preflights are never traced', () => {
      expect(isIgnoredIncoming({ url: '/api/v1/health/live', method: 'GET' })).toBe(true);
      expect(isIgnoredIncoming({ url: '/api/v1/health/ready?x=1', method: 'GET' })).toBe(true);
      expect(isIgnoredIncoming({ url: '/api/v1/elections', method: 'OPTIONS' })).toBe(true);
      expect(isIgnoredIncoming({ url: '/api/v1/elections/x/live', method: 'GET' })).toBe(false);
    });
  });
});
