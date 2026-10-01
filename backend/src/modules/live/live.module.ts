import { Module } from '@nestjs/common';
import { LivePublisher, LiveService } from './live.service';
import { ResultOverrideService } from './result-override.service';
import { ResultChangeNotifier } from './result-change-notifier';
import { BulkOverrideService } from './bulk-override.service';
import { RedisModule } from '../redis/redis.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ResultsModule } from '../results/results.module';
import { LiveController, LiveSseAccessGuard, SseConnections } from './live.controller';
import { LiveSseTokenService } from './live-sse-token.service';
import { SeatLockController } from './seat-lock.controller';
import { SeatLockService } from './seat-lock.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [RedisModule, AuditLogModule, ResultsModule, AuthModule],
  controllers: [LiveController, SeatLockController],
  providers: [
    { provide: LivePublisher, useClass: LiveService },
    ResultChangeNotifier,
    ResultOverrideService,
    BulkOverrideService,
    LiveSseTokenService,
    SseConnections,
    SeatLockService,
    LiveSseAccessGuard,
  ],
  exports: [LivePublisher, ResultOverrideService, BulkOverrideService],
})
export class LiveModule {}
