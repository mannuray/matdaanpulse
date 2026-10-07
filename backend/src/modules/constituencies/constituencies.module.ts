import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ConstituenciesController } from './constituencies.controller';
import { ConstituenciesService } from './constituencies.service';
import { SeatAnalysisLoader } from './seat-analysis.loader';
import { SeatAnalysisService } from './seat-analysis.service';

@Module({
  imports: [AuditLogModule],
  controllers: [ConstituenciesController],
  providers: [ConstituenciesService, SeatAnalysisLoader, SeatAnalysisService],
  exports: [ConstituenciesService, SeatAnalysisService],
})
export class ConstituenciesModule {}
