import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { IngestKeysService } from './ingest-keys.service';
import { IngestKeyGuard } from './ingest-key.guard';
import { ShardsService } from './shards.service';
import { LeaseService } from './lease.service';
import { IngestStatusService } from './ingest-status.service';
import { ALERT_WEBHOOK_URL, IngestAlertsService } from './ingest-alerts.service';
import { IngestHealthController } from './ingest-health.controller';

@Module({
  imports: [LiveModule],
  controllers: [IngestController, IngestHealthController],
  providers: [IngestService, IngestKeysService, IngestKeyGuard, ShardsService, LeaseService, IngestStatusService, IngestAlertsService,
    { provide: ALERT_WEBHOOK_URL, useFactory: () => process.env.INGEST_ALERT_WEBHOOK_URL || undefined }],
  exports: [IngestService, IngestStatusService, IngestKeysService, ShardsService, LeaseService],
})
export class IngestModule {}
