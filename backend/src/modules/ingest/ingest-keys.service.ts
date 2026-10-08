import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ElectionNotFoundException, IngestBadRequestException, IngestKeyNameTakenException, IngestKeyNotFoundException } from '../../common/exceptions';

/** `election_id` / `expires_at` NULL only on keys created before migration 026 (any election, never expire). */
export interface IngestKeyRow { id: string; name: string; election_id: string | null; expires_at: Date | null; created_at: Date; last_used_at: Date | null; revoked_at: Date | null }
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const pub = ({ id, name, election_id, expires_at, created_at, last_used_at, revoked_at }: any): IngestKeyRow =>
  ({ id, name, election_id: election_id ?? null, expires_at: expires_at ?? null, created_at, last_used_at, revoked_at });
const TOUCH_MS = 60_000;
/** A successful lookup is reused for 30 s: a revoke on another instance takes effect within that window (this one: at once). */
export const KEY_CACHE_MS = 30_000;
/** How long a verified key keeps bypassing the failed-check limiter (IngestAuthLimiter) on this instance. */
const RECENTLY_VALID_MS = 10 * 60_000;
const DAY_MS = 86_400_000;
export const KEY_DEFAULT_TTL_DAYS = 7;
export const KEY_MAX_TTL_DAYS = 90;

/** Machine keys for the ingest API: high-entropy random keys, so a sha256 (not a slow hash) is enough. */
@Injectable()
export class IngestKeysService {
  private readonly touched = new Map<string, number>();
  /** sha256 → row, successful lookups only (bounded by the number of valid keys; failures are never cached). */
  private readonly cache = new Map<string, { row: IngestKeyRow; at: number }>();
  constructor(private readonly prisma: PrismaService) {}

  /** A key for one election, expiring at `expiresAt` (default now + 7 days, at most 90 days ahead). */
  async create(name: string, userId: string | null, opts: { electionId: string; expiresAt?: Date }, now = new Date()): Promise<{ key: string; row: IngestKeyRow }> {
    const expiresAt = opts.expiresAt ?? new Date(now.getTime() + KEY_DEFAULT_TTL_DAYS * DAY_MS);
    if (expiresAt.getTime() <= now.getTime()) throw new IngestBadRequestException('expires_at must be in the future');
    if (expiresAt.getTime() > now.getTime() + KEY_MAX_TTL_DAYS * DAY_MS) throw new IngestBadRequestException(`expires_at must be within ${KEY_MAX_TTL_DAYS} days`);
    if (!(await this.prisma.elections.findUnique({ where: { id: opts.electionId }, select: { id: true } }))) throw new ElectionNotFoundException(opts.electionId);
    const key = `mpk_${randomBytes(32).toString('base64url')}`;
    try {
      const row = await this.prisma.ingest_keys.create({ data: { name, key_hash: sha(key), created_by: userId, election_id: opts.electionId, expires_at: expiresAt } });
      return { key, row: pub(row) };
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new IngestKeyNameTakenException(name);
      throw e;
    }
  }

  /** The key's row if it exists and is not revoked (expiry and election are checked by the guard on every request). */
  async verify(raw: string, now = Date.now()): Promise<IngestKeyRow | null> {
    const hash = sha(raw);
    const hit = this.cache.get(hash);
    let row: IngestKeyRow;
    if (hit && now - hit.at < KEY_CACHE_MS) row = hit.row;
    else {
      const found = await this.prisma.ingest_keys.findUnique({ where: { key_hash: hash } });
      if (!found || found.revoked_at) { this.cache.delete(hash); return null; }
      row = pub(found);
      this.cache.set(hash, { row, at: now });
    }
    if (now - (this.touched.get(row.id) ?? 0) > TOUCH_MS) {
      this.touched.set(row.id, now);
      await this.prisma.ingest_keys.update({ where: { id: row.id }, data: { last_used_at: new Date(now) } });
    }
    return row;
  }

  /** True when this instance verified the key in the last 10 minutes and it has not expired (limiter bypass only, never auth). */
  recentlyValid(raw: string, now = Date.now()): boolean {
    const hit = this.cache.get(sha(raw));
    return !!hit && now - hit.at < RECENTLY_VALID_MS && (!hit.row.expires_at || hit.row.expires_at.getTime() > now);
  }

  async list(): Promise<IngestKeyRow[]> {
    return (await this.prisma.ingest_keys.findMany({ orderBy: { created_at: 'desc' } })).map(pub);
  }

  async revoke(id: string): Promise<void> {
    const { count } = await this.prisma.ingest_keys.updateMany({ where: { id }, data: { revoked_at: new Date() } });
    if (!count) throw new IngestKeyNotFoundException(id);
    for (const [hash, c] of this.cache) if (c.row.id === id) this.cache.delete(hash);
  }
}
