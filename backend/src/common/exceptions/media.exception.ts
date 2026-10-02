import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class MediaNotConfiguredException extends BusinessException {
  constructor() {
    super(ErrorCodes.MEDIA_UPLOAD_NOT_CONFIGURED, 'Image upload is not configured', HttpStatus.SERVICE_UNAVAILABLE);
  }
}

/** The blob store rejected or failed the write; `cause` is logged by the filter, never sent. */
export class MediaStorageFailedException extends BusinessException {
  constructor(cause?: Error) {
    super(ErrorCodes.MEDIA_STORAGE_FAILED, 'Image storage failed', HttpStatus.BAD_GATEWAY, undefined, cause);
  }
}
