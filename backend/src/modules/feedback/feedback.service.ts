import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { paginated } from '../../common/paginated';
import { FeedbackNotFoundException } from '../../common/exceptions';
import type { FeedbackStatus } from '../../common/dto/query.dto';
import type { CreateFeedbackDto } from './dto/feedback.dto';

/** Used when FEEDBACK_IP_SALT is unset (local dev). Production must set its own. */
export const DEV_FEEDBACK_IP_SALT = 'matdaanpulse-dev-feedback-salt';
export const USER_AGENT_MAX = 300;

export interface FeedbackClient {
  ip?: string;
  userAgent?: string;
}

export interface FeedbackItem {
  id: string;
  kind: string;
  message: string;
  email: string | null;
  page: string | null;
  status: string;
  createdAt: Date;
}

const ITEM_SELECT = {
  id: true,
  kind: true,
  message: true,
  email: true,
  page: true,
  status: true,
  created_at: true,
} satisfies Prisma.feedbackSelect;

type FeedbackRow = Prisma.feedbackGetPayload<{ select: typeof ITEM_SELECT }>;

function toItem({ created_at, ...rest }: FeedbackRow): FeedbackItem {
  return { ...rest, createdAt: created_at };
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly salt: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const salt = config.get<string>('FEEDBACK_IP_SALT')?.trim();
    if (!salt) this.logger.warn('FEEDBACK_IP_SALT not set; using the built-in dev salt for feedback IP hashes');
    this.salt = salt || DEV_FEEDBACK_IP_SALT;
  }

  /** sha256(salt + ip) as hex; the raw IP is never stored. */
  hashIp(ip: string | undefined): string | null {
    if (!ip) return null;
    return createHash('sha256').update(this.salt + ip).digest('hex');
  }

  /** Stores one feedback row; a filled honeypot is silently dropped (same response for the caller). */
  async submit(dto: CreateFeedbackDto, client: FeedbackClient): Promise<{ ok: true }> {
    if (dto.website?.trim()) return { ok: true };
    await this.prisma.feedback.create({
      data: {
        kind: dto.kind,
        message: dto.message,
        email: dto.email || null,
        page: dto.page || null,
        ip_hash: this.hashIp(client.ip),
        user_agent: client.userAgent ? client.userAgent.slice(0, USER_AGENT_MAX) : null,
      },
    });
    return { ok: true };
  }

  async list(page: number, limit: number, status?: FeedbackStatus) {
    const where: Prisma.feedbackWhereInput = status ? { status } : {};
    const [total, rows] = await Promise.all([
      this.prisma.feedback.count({ where }),
      this.prisma.feedback.findMany({
        where,
        select: ITEM_SELECT,
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    return paginated(rows.map(toItem), { page, limit, total });
  }

  async updateStatus(id: string, status: FeedbackStatus): Promise<FeedbackItem> {
    const existing = await this.prisma.feedback.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new FeedbackNotFoundException(id);
    const row = await this.prisma.feedback.update({ where: { id }, data: { status }, select: ITEM_SELECT });
    return toItem(row);
  }
}
