import { Module } from '@nestjs/common';
import { AiEnrichmentService } from './ai-enrichment.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [AiEnrichmentService],
  exports: [AiEnrichmentService],
})
export class AiModule {}
