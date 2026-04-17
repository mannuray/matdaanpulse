import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ElectionsController } from './elections.controller';
import { ElectionsService } from './elections.service';
import { ConstituenciesModule } from '../constituencies/constituencies.module';
import { ResultsModule } from '../results/results.module';

@Module({
  imports: [
    ConstituenciesModule,
    ResultsModule,
  ],
  controllers: [ElectionsController],
  providers: [ElectionsService],
  exports: [ElectionsService],
})
export class ElectionsModule {}
