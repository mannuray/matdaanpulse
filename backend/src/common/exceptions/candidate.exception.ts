import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class CandidateNotFoundException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.CANDIDATE_NOT_FOUND, `Candidate ${id} not found`, HttpStatus.NOT_FOUND, { id });
  }
}

/** 409: split refused, because the candidacy is its person's only contest (split would only rename). */
export class CandidateSoleContestException extends BusinessException {
  constructor(id: string) {
    super(ErrorCodes.CANDIDATE_SOLE_CONTEST, "This is the person's only contest", HttpStatus.CONFLICT, { id });
  }
}
