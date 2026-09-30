import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { LiveStateService } from './live-state.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [ResultsService, LiveStateService],
  exports: [ResultsService, LiveStateService],
})
export class ResultsModule {}
