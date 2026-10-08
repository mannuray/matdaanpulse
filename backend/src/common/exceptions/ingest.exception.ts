import { HttpStatus } from '@nestjs/common';
import { BusinessException } from './base.exception';
import { ErrorCodes } from './error-codes';

export class IngestUnauthorizedException extends BusinessException {
  constructor() { super(ErrorCodes.INGEST_UNAUTHORIZED, 'Missing, unknown or revoked ingest key', HttpStatus.UNAUTHORIZED); }
}
export class IngestNotLiveException extends BusinessException {
  constructor(status: string) { super(ErrorCodes.INGEST_NOT_LIVE, `Election is ${status}, not Live`, HttpStatus.CONFLICT, { status }); }
}
export class IngestInactiveSourceException extends BusinessException {
  constructor(expected: string | null) {
    super(ErrorCodes.INGEST_INACTIVE_SOURCE, expected ? `Active source is ${expected}` : 'Ingest is paused for this shard', HttpStatus.CONFLICT, { expected });
  }
}
export class IngestNoLeaseException extends BusinessException {
  /** Only when the lease ends: the holder's name is never returned (the worker knows its own; another key must not learn it). */
  constructor(expires_at: Date | null) {
    super(ErrorCodes.INGEST_NO_LEASE, 'Another job holds this shard', HttpStatus.CONFLICT, { expires_at });
  }
}
export class IngestBadRequestException extends BusinessException {
  constructor(message: string, details?: Record<string, unknown>) { super(ErrorCodes.INGEST_BAD_REQUEST, message, HttpStatus.BAD_REQUEST, details); }
}
export class IngestShardNotFoundException extends BusinessException {
  constructor(name: string) { super(ErrorCodes.INGEST_SHARD_NOT_FOUND, `Shard ${name} not found`, HttpStatus.NOT_FOUND, { name }); }
}
export class IngestShardOverlapException extends BusinessException {
  constructor(other: string, sample: string[]) { super(ErrorCodes.INGEST_SHARD_OVERLAP, `Shard overlaps ${other}`, HttpStatus.CONFLICT, { other, sample }); }
}
export class IngestKeyNotFoundException extends BusinessException {
  constructor(id: string) { super(ErrorCodes.INGEST_KEY_NOT_FOUND, `Ingest key ${id} not found`, HttpStatus.NOT_FOUND, { id }); }
}
export class IngestKeyExpiredException extends BusinessException {
  constructor() { super(ErrorCodes.INGEST_KEY_EXPIRED, 'Ingest key has expired', HttpStatus.UNAUTHORIZED); }
}
/** A valid key used for an election it was not created for. */
export class IngestKeyScopeException extends BusinessException {
  constructor() { super(ErrorCodes.INGEST_KEY_SCOPE, 'Ingest key is not valid for this election', HttpStatus.FORBIDDEN); }
}
export class IngestKeyNameTakenException extends BusinessException {
  constructor(name: string) { super(ErrorCodes.INGEST_KEY_NAME_TAKEN, `An ingest key named ${name} already exists`, HttpStatus.CONFLICT, { name }); }
}
