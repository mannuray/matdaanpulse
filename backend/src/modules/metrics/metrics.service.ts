import { Injectable } from '@nestjs/common';
import { metrics, Counter, Histogram, UpDownCounter } from '@opentelemetry/api';

@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('election-tracker');

  readonly sseConnections: UpDownCounter;
  readonly redisPublishDuration: Histogram;
  readonly eventsPublished: Counter;
  readonly redisPublishErrors: Counter;
  readonly parseErrors: Counter;
  readonly resultOverrides: Counter;
  readonly streamErrors: Counter;
  readonly ssePublishSkipped: Counter;
  readonly activeStreams = this.meter.createObservableGauge(
    'live.streams.active',
    { description: 'Number of shared SSE streams' },
  );

  constructor() {
    this.sseConnections = this.meter.createUpDownCounter(
      'sse.connections.active',
      { description: 'Active SSE client connections' },
    );

    this.redisPublishDuration = this.meter.createHistogram(
      'redis.publish.duration',
      { description: 'Redis publish latency in ms', unit: 'ms' },
    );

    this.eventsPublished = this.meter.createCounter(
      'live.events.published.total',
      { description: 'Total events published to Redis' },
    );

    this.redisPublishErrors = this.meter.createCounter(
      'redis.publish.errors.total',
      { description: 'Failed Redis publishes' },
    );

    this.parseErrors = this.meter.createCounter('live.parse.errors.total', {
      description: 'JSON parse failures in live stream',
    });

    this.resultOverrides = this.meter.createCounter(
      'admin.result.overrides.total',
      { description: 'Result overrides via admin' },
    );

    this.streamErrors = this.meter.createCounter(
      'live.stream.errors.total',
      { description: 'SSE stream errors causing termination' },
    );

    this.ssePublishSkipped = this.meter.createCounter(
      'sse.publish.skipped.total',
      { description: 'SSE events skipped (e.g. missing party)' },
    );
  }

  /** Register a callback to observe the shared stream count */
  observeActiveStreams(cb: () => number) {
    this.activeStreams.addCallback((obs) => {
      obs.observe(cb());
    });
  }
}
