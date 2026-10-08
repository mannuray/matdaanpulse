import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

/** 409: the election exists but has no draft to publish (a missing election is ElectionNotFoundException). */
export class ManifestNoDraftException extends BusinessException {
  constructor(electionId: string) {
    super(ErrorCodes.MANIFEST_NO_DRAFT, `No draft to publish for election ${electionId}`, HttpStatus.CONFLICT, { electionId });
  }
}
