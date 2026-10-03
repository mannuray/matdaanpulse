import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { IngestKeyNotFoundException } from '../../common/exceptions';

export interface IngestKeyRow { id: string; name: string; created_at: Date; last_used_at: Date | null; revoked_at: Date | null }
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const pub = ({ id, name, created_at, last_used_at, revoked_at }: any): IngestKeyRow => ({ id, name, created_at, last_used_at, revoked_at });
const TOUCH_MS = 60_000;

/** Machine keys for the ingest API: high-entropy random keys, so a sha256 (not a slow hash) is enough. */
@Injectable()
export class IngestKeysService {
  private readonly touched = new Map<string, number>();
  constructor(private readonly prisma: PrismaService) {}

  async create(name: string, userId: string | null): Promise<{ key: string; row: IngestKeyRow }> {
    const key = `mpk_${randomBytes(32).toString('base64url')}`;
    const row = await this.prisma.ingest_keys.create({ data: { name, key_hash: sha(key), created_by: userId } });
    return { key, row: pub(row) };
  }

  async verify(raw: string): Promise<IngestKeyRow | null> {
    const row = await this.prisma.ingest_keys.findUnique({ where: { key_hash: sha(raw) } });
    if (!row || row.revoked_at) return null;
    const now = Date.now();
    if (now - (this.touched.get(row.id) ?? 0) > TOUCH_MS) {
      this.touched.set(row.id, now);
      await this.prisma.ingest_keys.update({ where: { id: row.id }, data: { last_used_at: new Date(now) } });
    }
    return pub(row);
  }

  async list(): Promise<IngestKeyRow[]> {
    return (await this.prisma.ingest_keys.findMany({ orderBy: { created_at: 'desc' } })).map(pub);
  }

  async revoke(id: string): Promise<void> {
    const { count } = await this.prisma.ingest_keys.updateMany({ where: { id }, data: { revoked_at: new Date() } });
    if (!count) throw new IngestKeyNotFoundException(id);
  }
}
