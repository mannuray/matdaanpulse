import { Module } from '@nestjs/common';
import { CandidatesController } from './candidates.controller';
import { CandidatesService } from './candidates.service';
import { PersonsService } from './persons.service';

@Module({
  controllers: [CandidatesController],
  providers: [CandidatesService, PersonsService],
  exports: [CandidatesService, PersonsService],
})
export class CandidatesModule {}
