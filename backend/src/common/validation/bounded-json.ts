import { PipeTransform } from '@nestjs/common';
import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';
import { ValidationFailedException } from './validation-failed.exception';

/** Limits for a free-form JSON object (e.g. constituency metadata): serialized size, nesting depth, keys per object. */
export interface JsonBounds { maxBytes: number; maxDepth: number; maxKeys: number }

/** Constituency metadata: free-form (tags, notes, …) but small. Every stored row is `{}` today (2026-10-08). */
export const METADATA_BOUNDS: JsonBounds = { maxBytes: 8 * 1024, maxDepth: 4, maxKeys: 50 };

const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Null when `value` is a plain object within `bounds`, else the reason. Depth 1 = the object's own keys. */
export function checkBoundedJson(value: unknown, bounds: JsonBounds): string | null {
  if (!isPlainObject(value)) return 'must be a JSON object';
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > bounds.maxBytes) return `must be at most ${bounds.maxBytes} bytes`;
  const walk = (v: unknown, depth: number): string | null => {
    if (v === null || typeof v !== 'object') return null;
    if (depth > bounds.maxDepth) return `must be at most ${bounds.maxDepth} levels deep`;
    const entries = Array.isArray(v) ? v : Object.values(v);
    if (!Array.isArray(v) && entries.length > bounds.maxKeys) return `objects must have at most ${bounds.maxKeys} keys`;
    for (const child of entries) {
      const err = walk(child, depth + 1);
      if (err) return err;
    }
    return null;
  };
  return walk(value, 1);
}

/** Body pipe for routes whose body is itself a free-form object (no DTO class to validate against). */
export class BoundedJsonObjectPipe implements PipeTransform {
  constructor(private readonly bounds: JsonBounds = METADATA_BOUNDS, private readonly field = 'body') {}

  transform(value: unknown) {
    const err = checkBoundedJson(value, this.bounds);
    if (err) throw new ValidationFailedException([{ field: this.field, message: `${this.field} ${err}` }]);
    return value;
  }
}

/** DTO decorator: a plain object within `bounds`. */
export function IsBoundedJsonObject(bounds: JsonBounds = METADATA_BOUNDS, validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy({
    name: 'isBoundedJsonObject',
    validator: {
      validate: (v) => checkBoundedJson(v, bounds) === null,
      defaultMessage: buildMessage(
        () => `$property must be a JSON object of at most ${bounds.maxBytes} bytes, ${bounds.maxDepth} levels and ${bounds.maxKeys} keys per object`,
        validationOptions,
      ),
    },
  }, validationOptions);
}
