import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

const collectorUrl =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]:
    process.env.OTEL_SERVICE_NAME || 'election-tracker-backend',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({ url: collectorUrl }),
  exportIntervalMillis: Number(
    process.env.OTEL_METRIC_EXPORT_INTERVAL_MS || 15000,
  ),
});

const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter({ url: collectorUrl }),
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();
console.log(`[OTEL] SDK started — exporting to ${collectorUrl}`);

process.on('SIGTERM', () => {
  sdk
    .shutdown()
    .then(() => console.log('[OTEL] SDK shut down gracefully'))
    .catch((err) => console.error('[OTEL] SDK shutdown error:', err))
    .finally(() => process.exit(0));
});
