import { Logger } from '@nestjs/common';
import { EnrichmentStrategy, EnrichmentContext } from './enrichment-strategy.interface';
import { extractJsonObject, asString, asInt, JSON_ONLY_INSTRUCTION } from './ai-response.parser';

/** Fields the admin CandidateDetail/CandidateEdit pages read from candidates.metadata. */
export interface CandidateEnrichmentResult {
  age?: number;
  gender?: string;
  education?: string;
  criminal_cases?: number;
  assets?: string;
  profession?: string;
}

export function parseCandidateEnrichment(text: string): CandidateEnrichmentResult | null {
  const parsed = extractJsonObject(text);
  if (!parsed) return null;
  const out: CandidateEnrichmentResult = {
    age: asInt(parsed.age, 18, 120),
    gender: asString(parsed.gender, 10),
    education: asString(parsed.education, 255),
    criminal_cases: asInt(parsed.criminal_cases, 0),
    assets: asString(parsed.assets, 100),
    profession: asString(parsed.profession, 255),
  };
  // Drop undefined keys so we never overwrite existing metadata with nothing.
  Object.keys(out).forEach((k) => (out as any)[k] === undefined && delete (out as any)[k]);
  return out;
}

const CHUNK_SIZE = 5;

export class CandidateEnrichmentStrategy implements EnrichmentStrategy {
  name = 'candidate';
  private readonly logger = new Logger(CandidateEnrichmentStrategy.name);

  async execute(electionId: string, context: EnrichmentContext, options?: { candidateIds?: string[] }) {
    const { prisma, callAi, reportProgress } = context;

    const candidates = await prisma.candidates.findMany({
      where: {
        election_id: electionId,
        NOT: { name: 'NOTA' },
        ...(options?.candidateIds?.length ? { id: { in: options.candidateIds } } : {}),
      },
      include: { constituencies: true, parties: true },
    });

    const total = candidates.length;
    let completed = 0;
    let failed = 0;
    await reportProgress({ total, completed, failed, inProgress: total > 0 });

    for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
      const chunk = candidates.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (candidate) => {
        try {
          const prompt = [
            `Research the Indian election candidate ${candidate.name}` +
              `${candidate.parties ? ` (${candidate.parties.name})` : ''} contesting from ${candidate.constituencies.name}.`,
            'Use their election affidavit (e.g. myneta.info / ECI) where possible.',
            JSON_ONLY_INSTRUCTION,
            'Keys: {"age": number|null, "gender": "Male"|"Female"|"Other"|null, "education": string|null,',
            ' "criminal_cases": number|null, "assets": string|null (e.g. "Rs 2.3 Crore"), "profession": string|null}',
          ].join('\n');
          const text = await callAi(prompt, 1000);
          const parsed = parseCandidateEnrichment(text);
          if (!parsed) throw new Error('No JSON object in AI response');

          await prisma.candidates.update({
            where: { id: candidate.id },
            data: { metadata: { ...((candidate.metadata as any) || {}), ...parsed, ai_generated_at: new Date().toISOString() } },
          });
          completed++;
        } catch (err) {
          failed++;
          this.logger.warn(`Candidate enrichment failed for ${candidate.id} (${candidate.name}): ${(err as Error).message}`);
        }
      }));

      await reportProgress({
        total, completed, failed,
        inProgress: completed + failed < total,
        last_name: chunk[chunk.length - 1].name,
      });
    }
    return { total, completed, failed };
  }
}
