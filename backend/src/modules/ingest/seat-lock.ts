import type { Prisma } from '@prisma/client';

/**
 * Serialises writers of the same seats (ingest batches and admin corrections) for the rest of the transaction:
 * one pg_advisory_xact_lock per seat, taken in sorted const_id order (sorted here, in JS, so every writer uses the same
 * order whatever the DB collation). All locks are taken by one statement (one round trip for a 500-seat batch instead
 * of 500): `unnest … WITH ORDINALITY` yields the ids in array order and `ORDER BY ord` keeps it (Postgres evaluates the
 * volatile lock calls after the sort), so the deadlock-free ordering is unchanged.
 * Must run inside a transaction (the lock is released at commit / rollback).
 */
export async function lockSeats(tx: Pick<Prisma.TransactionClient, '$executeRaw'>, electionId: string, constIds: string[]): Promise<void> {
  const ids = [...new Set(constIds)].sort();
  if (ids.length === 0) return;
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtext(${electionId}::text || ':' || t.id))
    FROM unnest(${ids}::text[]) WITH ORDINALITY AS t(id, ord)
    ORDER BY t.ord`;
}
