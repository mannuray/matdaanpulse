import { isTracingEnabled, startTracing, tracingStatus, shutdownTracing } from './tracing';

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
});
