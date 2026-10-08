import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IngestKeysService } from './ingest-keys.service';
import { IngestAuthLimiter } from './ingest-auth-limiter';
import { IngestKeyExpiredException, IngestKeyScopeException, IngestUnauthorizedException } from '../../common/exceptions';

/**
 * `Authorization: Bearer mpk_…` → `request.ingestKey`. Admin JWTs are not accepted here.
 * Unknown / revoked: 401 INGEST_0001; expired: 401 INGEST_0009; created for another election: 403 INGEST_0010
 * (keys from before migration 026 have no election and no expiry and pass both checks).
 */
@Injectable()
export class IngestKeyGuard implements CanActivate {
  constructor(private readonly keys: IngestKeysService, private readonly limiter: IngestAuthLimiter) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const m = /^Bearer (\S+)$/.exec(req.headers?.authorization ?? '');
    const row = m ? await this.keys.verify(m[1]) : null;
    // Unknown, revoked and expired keys count against the IP (the gate in app.setup answers 429 past the limit).
    if (!row) { this.limiter.fail(req.ip ?? ''); throw new IngestUnauthorizedException(); }
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) { this.limiter.fail(req.ip ?? ''); throw new IngestKeyExpiredException(); }
    // Compared as lower-case strings: the guard runs before ParseUUIDPipe, which also accepts an upper-case id.
    if (row.election_id && row.election_id.toLowerCase() !== String(req.params?.electionId ?? '').toLowerCase()) throw new IngestKeyScopeException();
    req.ingestKey = row;
    return true;
  }
}
