import { Module } from '@nestjs/common';
import { ResultsService } from './results.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
