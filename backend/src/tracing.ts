/**
 * OpenTelemetry bootstrap. Imported first by main.ts so instrumentations can
 * patch http/express/ioredis before those modules load.
 *
 * - Starts only when OTEL_EXPORTER_OTLP_ENDPOINT is set and OTEL_SDK_DISABLED
 *   is not "true" (review O-M4). On Render without a collector it stays off.
 * - Exports OTLP over HTTP (no gRPC → no @grpc/grpc-js / protobufjs, S-H1).
 *   The exporters read OTEL_EXPORTER_OTLP_ENDPOINT / _HEADERS themselves and
 *   append /v1/traces and /v1/metrics.
 * - Instruments only http, express, ioredis and Prisma. Propagation is the
 *   provider default (W3C tracecontext + baggage); no Jaeger propagator.
 * - No signal handlers here: Nest's shutdown hooks call shutdownTracing().
 */
import { metrics } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

type Env = Record<string, string | undefined>;

export function isTracingEnabled(env: Env = process.env): boolean {
  if ((env.OTEL_SDK_DISABLED ?? '').trim().toLowerCase() === 'true') return false;
  return !!env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
}

let tracerProvider: NodeTracerProvider | undefined;
let meterProvider: MeterProvider | undefined;

export function tracingStatus(): string {
  return tracerProvider
    ? `OpenTelemetry on — OTLP/HTTP to ${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`
    : 'OpenTelemetry off (set OTEL_EXPORTER_OTLP_ENDPOINT to enable)';
}

export function startTracing(env: Env = process.env): boolean {
  if (tracerProvider || !isTracingEnabled(env)) return false;

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME || 'election-tracker-backend',
    'deployment.environment': env.NODE_ENV || 'development',
  });

  tracerProvider = new NodeTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
  });
  tracerProvider.register();

  meterProvider = new MeterProvider({
    resource,
    readers: [
      new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter(),
        exportIntervalMillis: Number(env.OTEL_METRIC_EXPORT_INTERVAL_MS || 15000),
      }),
    ],
  });
  metrics.setGlobalMeterProvider(meterProvider);

  registerInstrumentations({
    tracerProvider,
    meterProvider,
    instrumentations: [
      new HttpInstrumentation(),
      new ExpressInstrumentation(),
      new IORedisInstrumentation(),
      new PrismaInstrumentation(),
    ],
  });
  return true;
}

/** Flush and stop exporters. Safe to call when tracing never started. */
export async function shutdownTracing(): Promise<void> {
  const tp = tracerProvider;
  const mp = meterProvider;
  tracerProvider = undefined;
  meterProvider = undefined;
  await Promise.allSettled([tp?.shutdown(), mp?.shutdown()]);
}

startTracing();
