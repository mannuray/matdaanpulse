import { Controller, Logger, Query, Sse, BadRequestException } from '@nestjs/common';
import { Observable, finalize } from 'rxjs';
import { LivePublisher } from './live.service';
import { MetricsService } from '../metrics/metrics.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('live')
export class LiveController {
  private readonly logger = new Logger(LiveController.name);

  constructor(
    private readonly live: LivePublisher,
    private readonly metrics: MetricsService,
  ) {}

  @Sse('updates')
  updates(@Query('election_id') electionId: string): Observable<MessageEvent> {
    if (!electionId || !UUID_RE.test(electionId)) {
      throw new BadRequestException('Valid election_id query parameter is required');
    }
    this.logger.log(`SSE client connected for election ${electionId}`);
    this.metrics.sseConnections.add(1, { election_id: electionId });
    return this.live.streamEvents(electionId).pipe(
      finalize(() => {
        this.logger.log(`SSE client disconnected from election ${electionId}`);
        this.metrics.sseConnections.add(-1, { election_id: electionId });
      }),
    );
  }
}
