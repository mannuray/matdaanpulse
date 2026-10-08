import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { AdminElectionsController } from './controllers/admin-elections.controller';
import { AdminPartiesController } from './controllers/admin-parties.controller';
import { AdminCandidatesController } from './controllers/admin-candidates.controller';
import { AdminPersonsController } from './controllers/admin-persons.controller';
import { AdminUsersController } from './controllers/admin-users.controller';
import { AdminAuditLogsController } from './controllers/admin-audit-logs.controller';
import { AdminConstituenciesController } from './controllers/admin-constituencies.controller';
import { AdminFeedbackController } from './controllers/admin-feedback.controller';
import { AdminMediaController } from './controllers/admin-media.controller';
import { ElectionsModule } from '../elections/elections.module';
import { ResultsModule } from '../results/results.module';
import { ManifestsModule } from '../manifests/manifests.module';
import { PartiesModule } from '../parties/parties.module';
import { CandidatesModule } from '../candidates/candidates.module';
import { ConstituenciesModule } from '../constituencies/constituencies.module';
import { AuthModule } from '../auth/auth.module';
import { LiveModule } from '../live/live.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ElectionLifecycleService } from './election-lifecycle.service';
import { FeedbackModule } from '../feedback/feedback.module';
import { MediaModule } from '../media/media.module';

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
    MediaModule,
  ],
  controllers: [
    AdminElectionsController,
    AdminPartiesController,
    AdminCandidatesController,
    AdminPersonsController,
    AdminUsersController,
    AdminAuditLogsController,
    AdminConstituenciesController,
    AdminFeedbackController,
    AdminMediaController,
  ],
  providers: [UserService, ElectionLifecycleService],
  exports: [UserService],
})
export class AdminModule {}
