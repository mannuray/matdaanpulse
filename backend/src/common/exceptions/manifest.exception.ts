import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class ManifestNotFoundException extends BusinessException {
  constructor(electionId: string) {
    super(ErrorCodes.MANIFEST_NOT_FOUND, `Election ${electionId} not found`, HttpStatus.NOT_FOUND, { electionId });
  }
}

export class ManifestNoDraftException extends BusinessException {
  constructor(electionId: string) {
    super(ErrorCodes.MANIFEST_NO_DRAFT, `No draft to publish for election ${electionId}`, HttpStatus.NOT_FOUND, { electionId });
  }
}
