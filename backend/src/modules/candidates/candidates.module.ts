import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { PersonsService } from './persons.service';
import { LiveModule } from '../live/live.module';

@Module({
  imports: [LiveModule],
  controllers: [CandidatesController],
  providers: [CandidatesService, PersonsService],
  exports: [CandidatesService, PersonsService],
})
export class CandidatesModule {}
