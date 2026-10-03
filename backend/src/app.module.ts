import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ElectionsModule } from './modules/elections/elections.module';
import { ResultsModule } from './modules/results/results.module';
import { StatesModule } from './modules/states/states.module';
import { ManifestsModule } from './modules/manifests/manifests.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { CreditsModule } from './modules/credits/credits.module';
import { PartiesModule } from './modules/parties/parties.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { LiveModule } from './modules/live/live.module';
import { IngestModule } from './modules/ingest/ingest.module';
import { ConstituenciesModule } from './modules/constituencies/constituencies.module';
import { SearchModule } from './modules/search/search.module';
import { RedisModule } from './modules/redis/redis.module';
import { StatusModule } from './modules/status/status.module';
import { StatusMiddleware } from './modules/status/status.middleware';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { HealthModule } from './modules/health/health.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { LoggingMiddleware } from './common/logger/logging.middleware';
import { buildThrottlerOptions } from './common/throttle/throttle.config';
import { GracefulShutdownService } from './common/lifecycle/graceful-shutdown.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildThrottlerOptions({
          THROTTLE_PUBLIC_PER_MIN: config.get<string>('THROTTLE_PUBLIC_PER_MIN'),
          THROTTLE_AUTH_PER_MIN: config.get<string>('THROTTLE_AUTH_PER_MIN'),
          THROTTLE_FEEDBACK_PER_MIN: config.get<string>('THROTTLE_FEEDBACK_PER_MIN'),
        }),
    }),
    PrismaModule,
    RedisModule,
    StatusModule,
    MetricsModule,
    AuditLogModule,
    ElectionsModule,
    ResultsModule,
    StatesModule,
    ManifestsModule,
    CandidatesModule,
    CreditsModule,
    ConstituenciesModule,
    PartiesModule,
    AuthModule,
    AdminModule,
    LiveModule,
    IngestModule,
    SearchModule,
    HealthModule,
    FeedbackModule,
  ],
  providers: [
    GracefulShutdownService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware, StatusMiddleware).forRoutes('*');
  }
}
