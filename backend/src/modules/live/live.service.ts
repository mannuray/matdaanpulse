import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Observable, EMPTY, merge, interval, map, share, catchError, filter, finalize } from 'rxjs';
import { RedisService } from '../redis/redis.service';
import { MetricsService } from '../metrics/metrics.service';

export interface LiveEvent {
  type: string;
  data: unknown;
}

export abstract class LivePublisher {
  abstract publish(electionId: string, event: LiveEvent): Promise<void>;
  abstract streamEvents(electionId: string): Observable<MessageEvent>;
}

const HEARTBEAT_MS = 30_000;

@Injectable()
export class LiveService extends LivePublisher implements OnModuleInit {
  private readonly logger = new Logger(LiveService.name);
  private readonly sharedStreams = new Map<string, Observable<MessageEvent>>();
  private readonly heartbeat$ = interval(HEARTBEAT_MS).pipe(
    map(() => ({ data: '', type: 'ping' } as MessageEvent)),
    share(),
  );

  constructor(
    private readonly redis: RedisService,
    private readonly metrics: MetricsService,
  ) {
    super();
  }

  onModuleInit() {
    this.metrics.observeActiveStreams(() => this.sharedStreams.size);
  }

  private channelFor(electionId: string): string {
    return `election:${electionId}:events`;
  }

  async publish(electionId: string, event: LiveEvent): Promise<void> {
    await this.redis.publish(this.channelFor(electionId), event);
  }

  streamEvents(electionId: string): Observable<MessageEvent> {
    const existing = this.sharedStreams.get(electionId);
    if (existing) return existing;

    // Create and register synchronously to prevent concurrent first-subscriber race
    const events$ = this.redis.subscribe(this.channelFor(electionId)).pipe(
      map((raw) => {
        try {
          const parsed = JSON.parse(raw) as LiveEvent;
          return { data: JSON.stringify(parsed.data), type: parsed.type } as MessageEvent;
        } catch {
          this.metrics.parseErrors.add(1, { election_id: electionId });
          this.logger.warn(`Failed to parse event for ${electionId}: ${raw.substring(0, 200)}`);
          return null as unknown as MessageEvent;
        }
      }),
      filter((evt): evt is MessageEvent => evt !== null),
    );

    const stream$ = merge(events$, this.heartbeat$).pipe(
      catchError((err) => {
        this.logger.error(`Stream error for election ${electionId}: ${err.message}`);
        this.metrics.streamErrors.add(1, { election_id: electionId });
        return EMPTY;
      }),
      finalize(() => {
        this.sharedStreams.delete(electionId);
        this.logger.debug(`Stream teardown for election ${electionId}`);
      }),
      share({ resetOnRefCountZero: true }),
    );
    this.sharedStreams.set(electionId, stream$);
    this.logger.debug(`Stream created for election ${electionId}`);

    return stream$;
  }
}
