import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminElectionsController } from './controllers/admin-elections.controller';
import { AdminPartiesController } from './controllers/admin-parties.controller';
import { AdminCandidatesController } from './controllers/admin-candidates.controller';
import { AdminPersonsController } from './controllers/admin-persons.controller';
import { AdminResultsController } from './controllers/admin-results.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminAuditLogsController } from './controllers/admin-audit-logs.controller';
import { AdminConstituenciesController } from './controllers/admin-constituencies.controller';
import { AdminFeedbackController } from './controllers/admin-feedback.controller';
import { ElectionsModule } from '../elections/elections.module';
import { ResultsModule } from '../results/results.module';
import { ManifestsModule } from '../manifests/manifests.module';
import { PartiesModule } from '../parties/parties.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { ConstituenciesModule } from '../constituencies/constituencies.module';
import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [
    ElectionsModule,
    ResultsModule,
    ManifestsModule,
    PartiesModule,
    CandidatesModule,
    ConstituenciesModule,
    AuthModule,
    LiveModule,
    AuditLogModule,
    FeedbackModule,
  ],
  controllers: [
    AdminElectionsController,
    AdminPartiesController,
    AdminCandidatesController,
    AdminPersonsController,
    AdminResultsController,
    AdminUsersController,
    AdminAuditLogsController,
    AdminConstituenciesController,
    AdminFeedbackController,
  ],
  providers: [UserService],
  exports: [UserService],
})
export class AdminModule {}
