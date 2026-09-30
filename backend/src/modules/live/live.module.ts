import { Module } from '@nestjs/common';
import { LivePublisher, LiveService } from './live.service';
import { ResultOverrideService } from './result-override.service';
import { BulkOverrideService } from './bulk-override.service';
import { RedisModule } from '../redis/redis.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ResultsModule } from '../results/results.module';
import { LiveController, LiveSseAccessGuard, SseConnections } from './live.controller';
import { LiveSseTokenService } from './live-sse-token.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RedisModule, AuditLogModule, ResultsModule, AuthModule],
  controllers: [LiveController],
  providers: [
    { provide: LivePublisher, useClass: LiveService },
    ResultOverrideService,
    BulkOverrideService,
    LiveSseTokenService,
    SseConnections,
    LiveSseAccessGuard,
  ],
  exports: [LivePublisher, ResultOverrideService, BulkOverrideService],
})
export class LiveModule {}
