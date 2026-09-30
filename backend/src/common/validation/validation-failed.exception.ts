import { BadRequestException, ValidationError } from '@nestjs/common';
import { ErrorCodes } from '../exceptions/error-codes';

export interface FieldError {
  field: string;
  message: string;
}

/** Flatten class-validator errors into one entry per message, with a dotted/indexed field path. */
export function flattenValidationErrors(errors: ValidationError[], parent = ''): FieldError[] {
  const out: FieldError[] = [];
  for (const err of errors) {
    const path = parent ? (/^\d+$/.test(err.property) ? `${parent}[${err.property}]` : `${parent}.${err.property}`) : err.property;
    if (err.constraints) {
      for (const message of Object.values(err.constraints)) out.push({ field: path, message });
    }
    if (err.children?.length) out.push(...flattenValidationErrors(err.children, path));
  }
  return out;
}

export class ValidationFailedException extends BadRequestException {
  readonly code = ErrorCodes.VALIDATION_FAILED;
  constructor(public readonly fields: FieldError[]) {
    super('Validation failed');
  }
}

export const validationExceptionFactory = (errors: ValidationError[]) =>
  new ValidationFailedException(flattenValidationErrors(errors));
