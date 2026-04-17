import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class InvalidCredentialsException extends BusinessException {
  constructor() {
    super(ErrorCodes.AUTH_INVALID_CREDENTIALS, 'Invalid email or password', HttpStatus.UNAUTHORIZED);
  }
}

export class UserAlreadyExistsException extends BusinessException {
  constructor(email: string) {
    super(ErrorCodes.AUTH_USER_EXISTS, `User with email ${email} already exists`, HttpStatus.CONFLICT, { email });
  }
}

export class UnauthorizedException extends BusinessException {
  constructor(message = 'Unauthorized access') {
    super(ErrorCodes.AUTH_UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }
}
