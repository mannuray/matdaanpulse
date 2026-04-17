import { PrismaService } from '../../prisma/prisma.service';

export interface EnrichmentContext {
  prisma: PrismaService;
  apiKey: string;
  callAi: (prompt: string, maxTokens?: number) => Promise<string>;
  reportProgress: (progress: any) => Promise<void>;
}

export interface EnrichmentStrategy {
  name: string;
  execute(id: string, context: EnrichmentContext, options?: any): Promise<any>;
}
