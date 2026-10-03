import type { PrismaService } from '../prisma/prisma.service';

/**
 * Serialises writers of the same seats (ingest batches and admin corrections) for the rest of the transaction:
 * one pg_advisory_xact_lock per seat, taken in sorted const_id order, one statement each so the order is the one asked for.
 * Must run inside a transaction (the lock is released at commit / rollback).
 */
export async function lockSeats(tx: Pick<PrismaService, '$executeRaw'>, electionId: string, constIds: string[]): Promise<void> {
  for (const id of [...new Set(constIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${electionId}::text || ':' || ${id}::text))`;
  }
}
