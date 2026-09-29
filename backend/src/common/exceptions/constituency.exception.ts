import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class ConstituencyNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.CONSTITUENCY_NOT_FOUND, `Constituency ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}

export class AnalysisNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.ANALYSIS_NOT_FOUND, `Constituency analysis ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}
