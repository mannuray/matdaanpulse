import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { IngestKeysService } from './ingest-keys.service';
import { IngestUnauthorizedException } from '../../common/exceptions';

/** `Authorization: Bearer mpk_…` → `request.ingestKey`. Admin JWTs are not accepted here. */
@Injectable()
export class IngestKeyGuard implements CanActivate {
  constructor(private readonly keys: IngestKeysService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const m = /^Bearer (\S+)$/.exec(req.headers?.authorization ?? '');
    const row = m ? await this.keys.verify(m[1]) : null;
    if (!row) throw new IngestUnauthorizedException();
    req.ingestKey = row;
    return true;
  }
}
