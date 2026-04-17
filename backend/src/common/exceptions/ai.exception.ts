import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class AiConfigMissingException extends BusinessException {
  constructor() {
    super(ErrorCodes.AI_CONFIG_MISSING, 'AI API key not configured', HttpStatus.INTERNAL_SERVER_ERROR);
  }
}

export class AiApiErrorException extends BusinessException {
  constructor(status: number, cause?: Error) {
    super(ErrorCodes.AI_API_ERROR, `AI API error (status ${status})`, HttpStatus.BAD_GATEWAY, { status }, cause);
  }
}

export class AiParseErrorException extends BusinessException {
  constructor(context: string, cause?: Error) {
    super(ErrorCodes.AI_PARSE_ERROR, `Failed to parse AI response for ${context}`, HttpStatus.INTERNAL_SERVER_ERROR, { context }, cause);
  }
}
