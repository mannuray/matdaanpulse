import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { PersonsService } from './persons.service';
import { PersonMergeService } from './person-merge.service';
import { LiveModule } from '../live/live.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [LiveModule, AuditLogModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, PersonsService, PersonMergeService],
  exports: [CandidatesService, PersonsService, PersonMergeService],
})
export class CandidatesModule {}
