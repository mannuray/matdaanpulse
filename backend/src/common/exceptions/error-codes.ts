export const ErrorCodes = {
  // General (0xxx)
  INTERNAL_SERVER_ERROR: 'GEN_0001',
  NOT_FOUND: 'GEN_0002',
  BAD_REQUEST: 'GEN_0003',
  CONFLICT: 'GEN_0004',
  /** DB pool / transaction slot exhausted (Prisma P2024 / P2028): 503 with Retry-After; safe to retry. */
  SERVICE_BUSY: 'GEN_0005',
  /** A ?v= newer than this server's current results version (a poll raced ahead): 404 no-store; retry on the next poll. */
  VERSION_NOT_READY: 'GEN_0006',
  /** Body over the size limit (413). */
  PAYLOAD_TOO_LARGE: 'GEN_0007',
  /** Rate limited (429, with Retry-After). */
  TOO_MANY_REQUESTS: 'GEN_0008',
  /** Load shedding other than the DB pool (the live stream cap): 503 with Retry-After. */
  SERVICE_UNAVAILABLE: 'GEN_0009',

  // Auth (1xxx)
  AUTH_INVALID_CREDENTIALS: 'AUTH_1001',
  AUTH_TOKEN_EXPIRED: 'AUTH_1002',
  AUTH_UNAUTHORIZED: 'AUTH_1003',
  AUTH_FORBIDDEN: 'AUTH_1004',
  AUTH_USER_EXISTS: 'AUTH_1005',

  // Election (2xxx)
  ELECTION_NOT_FOUND: 'ELECTION_2001',
  ELECTION_ALREADY_FINALIZED: 'ELECTION_2002',
  /** The election is Finalized (archived): no new candidates. */
  ELECTION_FINALIZED: 'ELECTION_2003',
  /** Reopen was asked for an election that is not Finalized. */
  ELECTION_NOT_FINALIZED: 'ELECTION_2004',

  // Constituency (3xxx)
  CONSTITUENCY_NOT_FOUND: 'CONST_3001',
  ANALYSIS_NOT_FOUND: 'CONST_3002',

  // User/Person (4xxx)
  USER_NOT_FOUND: 'USER_4001',
  PERSON_NOT_FOUND: 'USER_4002',
  PERSON_MERGE_NOT_FOUND: 'USER_4003',
  PERSON_MERGE_NOT_UNDOABLE: 'USER_4004',
  PERSON_MERGE_CONFLICT: 'USER_4005',

  // Party (5xxx)
  PARTY_NOT_FOUND: 'PARTY_5001',

  // Result (6xxx)
  RESULT_NOT_FOUND: 'RESULT_6001',
  SEAT_LOCKED: 'RESULT_6002',
  LOCKS_UNAVAILABLE: 'RESULT_6003',

  // Candidate (7xxx)
  CANDIDATE_NOT_FOUND: 'CANDIDATE_7001',
  CANDIDATE_SOLE_CONTEST: 'CANDIDATE_7002',

  // Manifest (8xxx)
  MANIFEST_NOT_FOUND: 'MANIFEST_8001',
  MANIFEST_NO_DRAFT: 'MANIFEST_8002',

  // Feedback
  FEEDBACK_NOT_FOUND: 'FEEDBACK_0001',

  // Media
  MEDIA_UPLOAD_NOT_CONFIGURED: 'MEDIA_0001',
  MEDIA_STORAGE_FAILED: 'MEDIA_0002',

  // Ingest
  INGEST_UNAUTHORIZED: 'INGEST_0001',
  INGEST_NOT_LIVE: 'INGEST_0002',
  INGEST_INACTIVE_SOURCE: 'INGEST_0003',
  INGEST_NO_LEASE: 'INGEST_0004',
  INGEST_BAD_REQUEST: 'INGEST_0005',
  INGEST_SHARD_NOT_FOUND: 'INGEST_0006',
  INGEST_SHARD_OVERLAP: 'INGEST_0007',
  INGEST_KEY_NOT_FOUND: 'INGEST_0008',
  INGEST_KEY_EXPIRED: 'INGEST_0009',
  INGEST_KEY_SCOPE: 'INGEST_0010',
  INGEST_KEY_NAME_TAKEN: 'INGEST_0011',
  INGEST_RATE_LIMITED: 'INGEST_0012',

  // Validation (9xxx)
  VALIDATION_FAILED: 'VALIDATION_9001',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
