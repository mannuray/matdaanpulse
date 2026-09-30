import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AiConfigMissingException, AiApiErrorException } from '../../common/exceptions';
import { EnrichmentStrategy, EnrichmentContext } from './strategies/enrichment-strategy.interface';
import { ConstituencyEnrichmentStrategy } from './strategies/constituency-enrichment.strategy';
import { CandidateEnrichmentStrategy } from './strategies/candidate-enrichment.strategy';
import { PartyEnrichmentStrategy } from './strategies/party-enrichment.strategy';
import { PersonEnrichmentStrategy } from './strategies/person-enrichment.strategy';

export type EnrichmentMode = 'pre_poll' | 'post_poll';

export interface EnrichmentProgress {
  total: number;
  completed: number;
  failed: number;
  inProgress: boolean;
}

/** Model id when GEMINI_MODEL is unset. Google retires Flash generations: a retired id 404s. */
export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const MODEL_ID_RE = /^[\w.-]{1,64}$/;

export function geminiApiUrl(model: string | undefined): string {
  const id = model?.trim() && MODEL_ID_RE.test(model.trim()) ? model.trim() : DEFAULT_GEMINI_MODEL;
  return `https://generativelanguage.googleapis.com/v1beta/models/${id}:generateContent`;
}

@Injectable()
export class AiEnrichmentService {
  private readonly logger = new Logger(AiEnrichmentService.name);
  private progress = new Map<string, EnrichmentProgress & { updatedAt: number }>();
  private readonly strategies: Map<string, EnrichmentStrategy> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {
    // Register strategies
    [
      new ConstituencyEnrichmentStrategy(),
      new CandidateEnrichmentStrategy(),
      new PartyEnrichmentStrategy(),
      new PersonEnrichmentStrategy(),
    ].forEach(s => this.strategies.set(s.name, s));
  }

  private async callGemini(prompt: string, maxTokens = 2000, retryCount = 0): Promise<string> {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new AiConfigMissingException();

    const MAX_RETRIES = 3;
    const INITIAL_BACKOFF = 2000; // 2 seconds

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    
    try {
      // Key goes in a header, never the URL (URLs end up in logs/proxies/traces).
      const response = await fetch(geminiApiUrl(this.configService.get<string>('GEMINI_MODEL')), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
        }),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        if (response.status === 429 && retryCount < MAX_RETRIES) {
          const backoff = INITIAL_BACKOFF * Math.pow(2, retryCount);
          this.logger.warn(`Gemini rate limit hit (429). Retrying in ${backoff}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoff));
          return this.callGemini(prompt, maxTokens, retryCount + 1);
        }
        throw new AiApiErrorException(response.status);
      }

      const result = await response.json();
      return result.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError' && retryCount < MAX_RETRIES) {
        this.logger.warn(`Gemini request timeout. Retrying...`);
        return this.callGemini(prompt, maxTokens, retryCount + 1);
      }
      throw err;
    }
  }

  private getContext(reportId: string): EnrichmentContext {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) throw new AiConfigMissingException();

    return {
      prisma: this.prisma,
      apiKey,
      callAi: this.callGemini.bind(this),
      reportProgress: async (p: any) => {
        this.progress.set(reportId, { ...p, updatedAt: Date.now() });
        this.cleanupStaleProgress();
        try {
          await this.redis.publish(`enrichment:${reportId}:events`, { type: 'enrichment-progress', data: p });
        } catch (err) {
          // Progress is still available via the status endpoint.
          this.logger.warn(`Failed to publish enrichment progress for ${reportId}: ${(err as Error).message}`);
        }
      }
    };
  }

  private cleanupStaleProgress() {
    const STALE_MS = 2 * 60 * 60 * 1000; // 2 hours
    const now = Date.now();
    for (const [key, entry] of this.progress) {
      if (!entry.inProgress && now - entry.updatedAt > STALE_MS) this.progress.delete(key);
    }
  }

  getProgress(id: string): EnrichmentProgress {
    return this.progress.get(id) || { total: 0, completed: 0, failed: 0, inProgress: false };
  }

  async enrichConstituencies(electionId: string, constIds?: string[], mode?: EnrichmentMode) {
    const strategy = this.strategies.get('constituency')!;
    const context = this.getContext(electionId);
    const total = constIds?.length ?? await this.prisma.constituencies.count({ where: { election_id: electionId } });
    strategy.execute(electionId, context, { constIds, mode })
      .catch(err => this.logger.error(`Enrichment failed: ${err.message}`));
    return { message: 'Enrichment started', total };
  }

  async enrichCandidates(electionId: string, candidateIds?: string[]) {
    const strategy = this.strategies.get('candidate')!;
    const context = this.getContext(`candidates_${electionId}`);
    // Same filter as CandidateEnrichmentStrategy, so the admin can show the count.
    const total = await this.prisma.candidates.count({
      where: {
        election_id: electionId,
        NOT: { name: 'NOTA' },
        ...(candidateIds?.length ? { id: { in: candidateIds } } : {}),
      },
    });
    strategy.execute(electionId, context, { candidateIds })
      .catch(err => this.logger.error(`Candidate enrichment failed: ${err.message}`));
    return { message: 'Candidate enrichment started', total };
  }

  async enrichParty(partyId: string) {
    const strategy = this.strategies.get('party')!;
    return strategy.execute(partyId, this.getContext(`party_${partyId}`));
  }

  async enrichPersons(personIds?: string[]) {
    const strategy = this.strategies.get('person')!;
    strategy.execute('persons', this.getContext('persons'), { personIds })
      .catch(err => this.logger.error(`Person enrichment failed: ${err.message}`));
    return { message: 'Person enrichment started' };
  }
}
