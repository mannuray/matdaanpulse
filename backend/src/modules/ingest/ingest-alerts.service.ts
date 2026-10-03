import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IngestStatusService } from './ingest-status.service';

export const ALERT_WEBHOOK_URL = 'INGEST_ALERT_WEBHOOK_URL';
export const ALERT_POST = 'INGEST_ALERT_POST';
const EVERY_MS = 60_000;
const REPEAT_MS = 15 * 60_000;
type Post = (url: string, body: { text: string }) => Promise<void>;

/** Spec §5: the Live Console's alerts, also posted to a webhook (Slack- and Telegram-bridge-compatible `{ text }`). Also prunes ingest_log (spec §3). */
@Injectable()
export class IngestAlertsService implements OnModuleInit, OnModuleDestroy {
  static readonly RETENTION_DAYS = 30;
  private readonly logger = new Logger(IngestAlertsService.name);
  private readonly sent = new Map<string, number>();
  private timer: NodeJS.Timeout | null = null;
  private prune: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly status: IngestStatusService,
    @Optional() @Inject(ALERT_WEBHOOK_URL) private readonly url: string | undefined,
    @Optional() @Inject(ALERT_POST) private readonly post: Post = async (u, b) => {
      const res = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    },
  ) {}

  onModuleInit() {
    this.prune = setInterval(() => void this.pruneLog().catch(e => this.logger.warn(`ingest_log prune failed: ${e.message}`)), 60 * 60_000);
    if (this.url) this.timer = setInterval(() => void this.tick().catch(e => this.logger.warn(`alert tick failed: ${e.message}`)), EVERY_MS);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.prune) clearInterval(this.prune);
  }

  async pruneLog(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - IngestAlertsService.RETENTION_DAYS * 86_400_000);
    return (await this.prisma.ingest_log.deleteMany({ where: { received_at: { lt: cutoff } } })).count;
  }

  async tick(now = new Date()): Promise<void> {
    if (!this.url) return;
    for (const e of await this.prisma.elections.findMany({ where: { status: 'Live' }, select: { id: true, name: true } })) {
      for (const a of (await this.status.status(e.id, now)).alerts) {
        const last = this.sent.get(a.key);
        if (last && now.getTime() - last < REPEAT_MS) continue;
        // Marked sent only once the webhook took it, so a failed post is retried on the next tick.
        try {
          await this.post(this.url, { text: `${a.level === 'error' ? '🚨' : '⚠️'} ${e.name} — ${a.message}` });
          this.sent.set(a.key, now.getTime());
        } catch (err) { this.logger.warn(`alert webhook failed: ${(err as Error).message}`); }
      }
    }
  }
}
