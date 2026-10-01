import { Injectable } from '@nestjs/common';
import { metrics, Attributes, Counter } from '@opentelemetry/api';
import { StatusService } from '../status/status.service';

/** Call-site shape shared by OTel counters and histograms (.add / .record). */
export interface CounterLike {
  add(value: number, attributes?: Attributes): void;
}
export interface HistogramLike {
  record(value: number, attributes?: Attributes): void;
}

/** Forward to the OTel instrument and to the in-memory StatusService; a failure in either never reaches the caller. */
function tee(otel: CounterLike, onAdd: (v: number) => void): CounterLike {
  return {
    add(value, attributes) {
      try { otel.add(value, attributes); } catch { /* metrics must not break callers */ }
      try { onAdd(value); } catch { /* ditto */ }
    },
  };
}

@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('matdaanpulse');

  readonly sseConnections: CounterLike;
  readonly redisPublishDuration: HistogramLike;
  readonly eventsPublished: CounterLike;
  readonly redisPublishErrors: CounterLike;
  readonly parseErrors: Counter;
  readonly resultOverrides: CounterLike;
  readonly streamErrors: Counter;
  readonly ssePublishSkipped: Counter;
  readonly activeStreams = this.meter.createObservableGauge(
    'live.streams.active',
    { description: 'Number of shared SSE streams' },
  );

  constructor(private readonly status: StatusService) {
    this.sseConnections = tee(
      this.meter.createUpDownCounter('sse.connections.active', { description: 'Active SSE client connections' }),
      (v) => this.status.addSseConnections(v),
    );

    const publishDuration = this.meter.createHistogram('redis.publish.duration', {
      description: 'Redis publish latency in ms',
      unit: 'ms',
    });
    // Recorded once per publish attempt (RedisService's finally block).
    this.redisPublishDuration = {
      record: (value, attributes) => {
        try { publishDuration.record(value, attributes); } catch { /* ignore */ }
        this.status.recordRedisPublishAttempt();
      },
    };

    this.eventsPublished = tee(
      this.meter.createCounter('live.events.published.total', { description: 'Total events published to Redis' }),
      () => this.status.recordEventPublished(),
    );

    this.redisPublishErrors = tee(
      this.meter.createCounter('redis.publish.errors.total', { description: 'Failed Redis publishes' }),
      () => this.status.recordRedisPublishError(),
    );

    this.parseErrors = this.meter.createCounter('live.parse.errors.total', {
      description: 'JSON parse failures in live stream',
    });

    this.resultOverrides = tee(
      this.meter.createCounter('admin.result.overrides.total', { description: 'Result overrides via admin' }),
      (v) => this.status.recordOverrides(v),
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
