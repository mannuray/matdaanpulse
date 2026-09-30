import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

export function prismaLogConfig(logLevel = process.env.LOG_LEVEL): Prisma.LogDefinition[] {
  const base: Prisma.LogDefinition[] = [
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ];
  // Query events only when explicitly debugging (review P-L2).
  return logLevel === 'debug' ? [{ emit: 'event', level: 'query' }, ...base] : base;
}

/**
 * Disconnect is done by GracefulShutdownService after the HTTP server has
 * closed, so in-flight requests keep their DB connection during shutdown.
 */
@Injectable()
export class PrismaService extends PrismaClient<Prisma.PrismaClientOptions, 'query'> implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({ log: prismaLogConfig() });
  }

  async onModuleInit() {
    await this.$connect();

    if (process.env.LOG_LEVEL === 'debug') {
      this.$on('query', (e) => {
        this.logger.debug(`Query: ${e.query} - Params: ${e.params} - Duration: ${e.duration}ms`);
      });
    }
  }
}
