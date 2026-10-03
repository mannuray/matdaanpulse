import { Module } from '@nestjs/common';
import { LiveModule } from '../live/live.module';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';
import { IngestKeysService } from './ingest-keys.service';
import { IngestKeyGuard } from './ingest-key.guard';
import { ShardsService } from './shards.service';
import { LeaseService } from './lease.service';

@Module({
  imports: [LiveModule],
  controllers: [IngestController],
  providers: [IngestService, IngestKeysService, IngestKeyGuard, ShardsService, LeaseService],
  exports: [IngestService, IngestKeysService, ShardsService, LeaseService],
})
export class IngestModule {}
