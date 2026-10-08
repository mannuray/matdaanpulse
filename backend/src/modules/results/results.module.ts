import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { LiveStateService } from './live-state.service';
import { SnapshotBodyCache } from './snapshot-body-cache';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [ResultsService, LiveStateService, { provide: SnapshotBodyCache, useFactory: () => new SnapshotBodyCache() }],
  exports: [ResultsService, LiveStateService, SnapshotBodyCache],
})
export class ResultsModule {}
