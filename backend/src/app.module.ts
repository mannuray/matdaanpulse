import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ElectionsModule } from './modules/elections/elections.module';
import { ResultsModule } from './modules/results/results.module';
import { StatesModule } from './modules/states/states.module';
import { ManifestsModule } from './modules/manifests/manifests.module';
import { CandidatesModule } from './modules/candidates/candidates.module';
import { PartiesModule } from './modules/parties/parties.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { LiveModule } from './modules/live/live.module';
import { ConstituenciesModule } from './modules/constituencies/constituencies.module';
import { SearchModule } from './modules/search/search.module';
import { RedisModule } from './modules/redis/redis.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { HealthModule } from './modules/health/health.module';
import { LoggingMiddleware } from './common/logger/logging.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    PrismaModule,
    RedisModule,
    MetricsModule,
    AuditLogModule,
    ElectionsModule,
    ResultsModule,
    StatesModule,
    ManifestsModule,
    CandidatesModule,
    ConstituenciesModule,
    PartiesModule,
    AuthModule,
    AdminModule,
    LiveModule,
    SearchModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggingMiddleware).forRoutes('*');
  }
}
