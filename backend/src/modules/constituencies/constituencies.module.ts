import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ConstituenciesController } from './constituencies.controller';
import { ConstituenciesService } from './constituencies.service';
import { DominanceStrategy } from './strategies/dominance.strategy';
import { SwingAnalysisStrategy } from './strategies/swing.strategy';
import { IncumbencyStrategy } from './strategies/incumbency.strategy';
import { SpoilerDetectionStrategy } from './strategies/spoiler.strategy';
import { SeatTypeStrategy } from './strategies/seat-type.strategy';
import { ElectoralRevisionStrategy } from './strategies/electoral-revision.strategy';
import { SeatHistoryStrategy } from './strategies/seat-history.strategy';

@Module({
  imports: [AuditLogModule],
  controllers: [ConstituenciesController],
  providers: [
    ConstituenciesService,
    DominanceStrategy,
    SwingAnalysisStrategy,
    IncumbencyStrategy,
    SpoilerDetectionStrategy,
    SeatTypeStrategy,
    ElectoralRevisionStrategy,
    SeatHistoryStrategy,
    {
      provide: 'ANALYSIS_STRATEGIES',
      useFactory: (...strategies) => strategies,
      inject: [
        DominanceStrategy,
        SwingAnalysisStrategy,
        IncumbencyStrategy,
        SpoilerDetectionStrategy,
        SeatTypeStrategy,
        ElectoralRevisionStrategy,
        SeatHistoryStrategy,
      ],
    },
  ],
  exports: [ConstituenciesService],
})
export class ConstituenciesModule {}
