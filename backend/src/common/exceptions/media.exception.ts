import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class MediaNotConfiguredException extends BusinessException {
  constructor() {
    super(ErrorCodes.MEDIA_UPLOAD_NOT_CONFIGURED, 'Image upload is not configured', HttpStatus.SERVICE_UNAVAILABLE);
  }
}
