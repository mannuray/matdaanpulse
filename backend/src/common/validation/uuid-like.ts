import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

/**
 * 8-4-4-4-12 hex, any version nibble. Seeded election ids (e.g. the Bihar 2025
 * id c3d4e5f6-a7b8-9012-…) are not RFC-versioned, so class-validator's
 * @IsUUID() rejects them although Postgres `uuid` and Nest's ParseUUIDPipe
 * accept them. Use this for every id that can be an election id.
 */
export const UUID_LIKE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuidLike(value: unknown): value is string {
  return typeof value === 'string' && UUID_LIKE_RE.test(value);
}

export function IsUuidLike(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isUuidLike',
      validator: {
        validate: (value) => isUuidLike(value),
        defaultMessage: buildMessage((each) => `${each}$property must be a UUID`, validationOptions),
      },
    },
    validationOptions,
  );
}
