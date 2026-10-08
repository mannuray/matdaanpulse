import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { CacheService } from './cache.service';
import { ElectionCacheService } from './election-cache.service';

@Global()
@Module({
  providers: [RedisService, CacheService, ElectionCacheService],
  exports: [RedisService, CacheService, ElectionCacheService],
})
export class RedisModule {}
