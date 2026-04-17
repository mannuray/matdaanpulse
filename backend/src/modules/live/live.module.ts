import { Module } from '@nestjs/common';
import { LivePublisher, LiveService } from './live.service';
import { ResultOverrideService } from './result-override.service';
import { BulkOverrideService } from './bulk-override.service';
import { RedisModule } from '../redis/redis.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ResultsModule } from '../results/results.module';
import { LiveController } from './live.controller';

@Module({
  imports: [RedisModule, AuditLogModule, ResultsModule],
  controllers: [LiveController],
  providers: [
    { provide: LivePublisher, useClass: LiveService },
    ResultOverrideService,
    BulkOverrideService
  ],
  exports: [LivePublisher, ResultOverrideService, BulkOverrideService],
})
export class LiveModule {}
