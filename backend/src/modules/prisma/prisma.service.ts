import { Injectable, OnModuleInit, Logger, LoggerService } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { resolveLogLevel } from '../../common/logger/winston.config';
import { RateLimitedLog } from '../../common/util/rate-limited-log';

/** Every Prisma log is an event handed to the app logger (one JSON stream), never Prisma's own stdout printing. */
export function prismaLogConfig(logLevel = process.env.LOG_LEVEL): Prisma.LogDefinition[] {
  const base: Prisma.LogDefinition[] = [
    { emit: 'event', level: 'info' },
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ];
  // Query events only when explicitly debugging (review P-L2).
  return resolveLogLevel(logLevel) === 'debug' ? [{ emit: 'event', level: 'query' }, ...base] : base;
}

type LogEvent = { message: string; target?: string };
type QueryEvent = { query: string; params: string; duration: number };
interface PrismaEvents {
  $on(event: 'info' | 'warn' | 'error', cb: (e: LogEvent) => void): void;
  $on(event: 'query', cb: (e: QueryEvent) => void): void;
}

/** First non-empty line, capped: the rest of an engine message can render query arguments (emails, hashes). */
const firstLine = (s: string) => (s.split('\n').map((l) => l.trim()).find((l) => l) ?? '').slice(0, 300);

/**
 * Routes Prisma's log events to the app logger. Errors and warnings come in floods when the pool is full or the DB is
 * down, so each distinct message is logged at most once a minute. The debug query log omits the parameters.
 */
export function attachPrismaLogs(
  client: PrismaEvents,
  logger: Pick<LoggerService, 'log' | 'warn' | 'error'> & { debug: (m: unknown) => void },
  opts: { debug: boolean; now?: () => number },
) {
  const gate = new RateLimitedLog(60_000, opts.now);
  client.$on('error', (e) => {
    const msg = firstLine(e.message);
    if (gate.shouldLog(`error:${msg}`)) logger.error({ message: `Prisma: ${msg}`, event: 'prisma_error', target: e.target });
  });
  client.$on('warn', (e) => {
    const msg = firstLine(e.message);
    if (gate.shouldLog(`warn:${msg}`)) logger.warn({ message: `Prisma: ${msg}`, event: 'prisma_warn', target: e.target });
  });
  client.$on('info', (e) => logger.log({ message: `Prisma: ${firstLine(e.message)}`, event: 'prisma_info' }));
  if (opts.debug) {
    client.$on('query', (e) => logger.debug({ message: `Query (${e.duration}ms): ${e.query}`, event: 'prisma_query', duration: e.duration }));
  }
}

/**
 * Disconnect is done by GracefulShutdownService after the HTTP server has
 * closed, so in-flight requests keep their DB connection during shutdown.
 */
@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'info' | 'warn' | 'error'> implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: prismaLogConfig() });
    // Before $connect, so connection errors are routed too.
    attachPrismaLogs(this as unknown as PrismaEvents, this.logger, { debug: resolveLogLevel() === 'debug' });
  }

  async onModuleInit() {
    await this.$connect();
  }
}
