import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ElectionNotFoundException } from '../../common/exceptions';

export interface LiveState {
  /** Monotonic per-election version; changes whenever snapshot data changes. */
  version: number;
  updatedAt: string;
  /** Constituencies with a declared (WON) result. */
  declared: number;
  total: number;
}

/** In-process memo of the live state; short because other writers (scraper SQL) bump via DB triggers. */
export const LIVE_STATE_MEMO_MS = 1_000;

/**
 * Reads election_live_state (bumped by DB triggers in the writing transaction,
 * migration 015). Identical concurrent reads share one query (single-flight)
 * and the result is memoised for LIVE_STATE_MEMO_MS; writers in this process
 * call invalidate() after commit so their own change shows up immediately.
 */
@Injectable()
export class LiveStateService {
  private readonly memo = new Map<string, { at: number; state: LiveState }>();
  private readonly inFlight = new Map<string, Promise<LiveState>>();

  constructor(private readonly prisma: PrismaService) {}

  get(electionId: string, now: number = Date.now()): Promise<LiveState> {
    const hit = this.memo.get(electionId);
    if (hit && now - hit.at < LIVE_STATE_MEMO_MS) return Promise.resolve(hit.state);
    const pending = this.inFlight.get(electionId);
    if (pending) return pending;
    const promise = this.load(electionId)
      .then((state) => {
        if (this.inFlight.get(electionId) === promise) this.memo.set(electionId, { at: Date.now(), state });
        return state;
      })
      .finally(() => {
        if (this.inFlight.get(electionId) === promise) this.inFlight.delete(electionId);
      });
    this.inFlight.set(electionId, promise);
    return promise;
  }

  /** Forget the memo and detach any in-flight read (call after committing a results write). */
  invalidate(electionId: string): void {
    this.memo.delete(electionId);
    this.inFlight.delete(electionId);
  }

  private async load(electionId: string): Promise<LiveState> {
    let row = await this.readRow(electionId);
    if (!row) {
      // No write since migration 015 (or a fresh DB): create the row. The first version is
      // "now" in epoch ms, so a rebuilt database never reuses a version a CDN may still hold.
      const exists = await this.prisma.elections.findUnique({ where: { id: electionId }, select: { id: true } });
      if (!exists) throw new ElectionNotFoundException(electionId);
      await this.prisma.$executeRaw`
        INSERT INTO election_live_state (election_id, version)
        VALUES (${electionId}::uuid, (extract(epoch FROM clock_timestamp()) * 1000)::bigint)
        ON CONFLICT (election_id) DO NOTHING`;
      row = await this.readRow(electionId);
      if (!row) throw new ElectionNotFoundException(electionId);
    }
    const [counts] = await this.prisma.$queryRaw<{ declared: number; total: number }[]>`
      SELECT
        (SELECT COUNT(DISTINCT r.const_id)::int FROM results r
          WHERE r.election_id = ${electionId}::uuid AND r.status = 'WON') AS declared,
        (SELECT COUNT(*)::int FROM constituencies c WHERE c.election_id = ${electionId}::uuid) AS total`;
    return {
      version: Number(row.version),
      updatedAt: row.updated_at.toISOString(),
      declared: counts?.declared ?? 0,
      total: counts?.total ?? 0,
    };
  }

  private async readRow(electionId: string): Promise<{ version: bigint; updated_at: Date } | null> {
    const rows = await this.prisma.$queryRaw<{ version: bigint; updated_at: Date }[]>`
      SELECT version, updated_at FROM election_live_state WHERE election_id = ${electionId}::uuid`;
    return rows[0] ?? null;
  }
}
