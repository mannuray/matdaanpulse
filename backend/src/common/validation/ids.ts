/**
 * String id shapes for route params and query values. They bound cache keys and keep odd input away from Prisma
 * and Redis keys; each is a superset of every seeded id (checked against the seeded DB, 2026-10-08).
 */

/** Constituency ids: `BR_VS_100_VALMIKI_NAGAR`, `AS_VS16_29_KOKRAJHAR_WEST`; some carry `&`. No glob/separator characters. */
export const CONST_ID_RE = /^[A-Za-z0-9_&-]+$/;
export const CONST_ID_MAX = 100;

/** Party ids: seeded ones are letters, digits and `_` (≤ 10 chars); `& ( ) . + -` are allowed too. Length = CreatePartyDto's 20. */
export const PARTY_ID_RE = /^[A-Za-z0-9_&().+-]+$/;
export const PARTY_ID_MAX = 20;

/** A state code (`BR`, `wb`): two letters, any case. */
export const STATE_CODE_RE = /^[A-Za-z]{2}$/;
