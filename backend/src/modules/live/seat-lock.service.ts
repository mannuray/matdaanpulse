import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { LivePublisher } from './live.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConstituencyNotFoundException, LocksUnavailableException, SeatLockedException } from '../../common/exceptions';

/** Soft-lock lifetime; the Live Console refreshes it every 45 s while a seat is open. */
export const SEAT_LOCK_TTL_SECONDS = 120;

export interface SeatLock {
  const_id: string;
  user_id: string;
  user_name: string;
  acquired_at: string;
}

const keyFor = (electionId: string, constId: string) => `lock:seat:${electionId}:${constId}`;

function parse(raw: string | null): SeatLock | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v.user_id === 'string' && typeof v.const_id === 'string' ? (v as SeatLock) : null;
  } catch {
    return null;
  }
}

/** Advisory per-seat edit locks for the Live Console. Saving never requires a lock. */
@Injectable()
export class SeatLockService {
  constructor(
    private readonly redis: RedisService,
    private readonly live: LivePublisher,
    private readonly audit: AuditLogService,
    private readonly prisma: PrismaService,
  ) {}

  private ensureReady() {
    if (!this.redis.isPubReady()) throw new LocksUnavailableException();
  }

  async list(electionId: string): Promise<SeatLock[]> {
    this.ensureReady();
    const values = await this.redis.getMany(keyFor(electionId, '*'));
    return values.map(parse).filter((l): l is SeatLock => l !== null);
  }

  async acquire(electionId: string, constId: string, user: { id: string; name: string }, takeOver: boolean): Promise<SeatLock> {
    this.ensureReady();
    const seat = await this.prisma.constituencies.findFirst({ where: { id: constId, election_id: electionId }, select: { id: true } });
    if (!seat) throw new ConstituencyNotFoundException(constId);

    const lock: SeatLock = { const_id: constId, user_id: user.id, user_name: user.name, acquired_at: new Date().toISOString() };
    const key = keyFor(electionId, constId);
    const value = JSON.stringify(lock);

    if (takeOver) {
      const previous = parse(await this.redis.forceSet(key, value, SEAT_LOCK_TTL_SECONDS));
      if (previous && previous.user_id !== user.id) {
        await this.audit.create({
          userId: user.id, action: 'SEAT_LOCK_TAKEOVER', entityType: 'constituency', entityId: constId,
          oldValue: previous, newValue: lock,
        });
      }
    } else {
      const holder = await this.redis.acquireOwned(key, user.id, value, SEAT_LOCK_TTL_SECONDS);
      if (holder !== null) throw new SeatLockedException((parse(holder) ?? {}) as unknown as Record<string, unknown>);
    }

    await this.live.publish(electionId, { type: 'seat-lock', data: { const_id: constId, lock } });
    return lock;
  }

  async release(electionId: string, constId: string, userId: string): Promise<void> {
    this.ensureReady();
    if (await this.redis.releaseOwned(keyFor(electionId, constId), userId)) {
      await this.live.publish(electionId, { type: 'seat-lock', data: { const_id: constId, lock: null } });
    }
  }
}
