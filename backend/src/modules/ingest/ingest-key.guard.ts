import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IngestKeysService } from './ingest-keys.service';
import { IngestKeyExpiredException, IngestKeyScopeException, IngestUnauthorizedException } from '../../common/exceptions';

/**
 * `Authorization: Bearer mpk_…` → `request.ingestKey`. Admin JWTs are not accepted here.
 * Unknown / revoked: 401 INGEST_0001; expired: 401 INGEST_0009; created for another election: 403 INGEST_0010
 * (keys from before migration 026 have no election and no expiry and pass both checks).
 */
@Injectable()
export class IngestKeyGuard implements CanActivate {
  constructor(private readonly keys: IngestKeysService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const m = /^Bearer (\S+)$/.exec(req.headers?.authorization ?? '');
    const row = m ? await this.keys.verify(m[1]) : null;
    if (!row) throw new IngestUnauthorizedException();
    if (row.expires_at && row.expires_at.getTime() <= Date.now()) throw new IngestKeyExpiredException();
    // Compared as strings: the guard runs before ParseUUIDPipe.
    if (row.election_id && row.election_id !== String(req.params?.electionId ?? '')) throw new IngestKeyScopeException();
    req.ingestKey = row;
    return true;
  }
}
