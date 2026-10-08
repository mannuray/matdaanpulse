import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { gunzip as gunzipCb, gzip as gzipCb } from 'zlib';
import type { Request, Response } from 'express';

const gzip = promisify(gzipCb);
const gunzip = promisify(gunzipCb);

/** Bytes of gzipped snapshot bodies kept per process (~100–150 KB per state-sized version, so a few hundred versions). */
export const SNAPSHOT_BODY_CACHE_BYTES = 32 * 1024 * 1024;

export interface SnapshotBody {
  gzip: Buffer;
  /** Strong ETags of the gzipped and the identity body (each encoding is its own representation). */
  etagGzip: string;
  etagIdentity: string;
}

/** Same format as Express's strong ETag (`"<length hex>-<sha1 base64, 27 chars>"`). */
function strongEtag(buf: Buffer): string {
  return `"${buf.length.toString(16)}-${createHash('sha1').update(buf).digest('base64').slice(0, 27)}"`;
}

/**
 * The serialized, gzipped response body of each immutable snapshot version (`results?v=<current>`), so repeated origin
 * hits for a version (CDN tiers, colos, retries) skip JSON.stringify and gzip of a ~1 MB body. Only bodies of versions
 * that were verified as exactly version v are stored — a version never changes, so an entry never goes stale.
 * In-process LRU bounded by bytes (gzip only; an identity client gets it gunzipped, which is rare behind the CDN).
 */
@Injectable()
export class SnapshotBodyCache {
  private readonly entries = new Map<string, SnapshotBody>();
  private bytes = 0;

  constructor(private readonly maxBytes: number = SNAPSHOT_BODY_CACHE_BYTES) {}

  get(key: string): SnapshotBody | undefined {
    const hit = this.entries.get(key);
    if (hit) {
      // Most recently used last.
      this.entries.delete(key);
      this.entries.set(key, hit);
    }
    return hit;
  }

  /** Serialize + gzip `body` once and keep it (a body larger than the whole budget is returned but not kept). */
  async put(key: string, body: unknown): Promise<SnapshotBody> {
    const json = Buffer.from(JSON.stringify(body), 'utf8');
    const gz = await gzip(json);
    const entry: SnapshotBody = { gzip: gz, etagGzip: strongEtag(gz), etagIdentity: strongEtag(json) };
    const old = this.entries.get(key);
    if (old) {
      this.entries.delete(key);
      this.bytes -= old.gzip.length;
    }
    if (gz.length <= this.maxBytes) {
      this.entries.set(key, entry);
      this.bytes += gz.length;
      for (const [k, v] of this.entries) {
        if (this.bytes <= this.maxBytes) break;
        this.entries.delete(k);
        this.bytes -= v.gzip.length;
      }
    }
    return entry;
  }

  clear(): void {
    this.entries.clear();
    this.bytes = 0;
  }

  get size(): { entries: number; bytes: number } {
    return { entries: this.entries.size, bytes: this.bytes };
  }
}

/**
 * Send a cached body: gzipped as-is to clients that accept gzip (the compression middleware leaves a response that
 * already has a Content-Encoding alone), gunzipped otherwise. Express's res.send keeps our ETag and answers a matching
 * If-None-Match with 304. Cache-Control must already be set.
 */
export async function sendSnapshotBody(req: Request, res: Response, entry: SnapshotBody): Promise<void> {
  res.vary('Accept-Encoding');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.acceptsEncodings('gzip', 'identity') === 'gzip') {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('ETag', entry.etagGzip);
    res.send(entry.gzip);
    return;
  }
  res.setHeader('ETag', entry.etagIdentity);
  res.send(await gunzip(entry.gzip));
}
