import { Logger } from '@nestjs/common';
import { EnrichmentStrategy, EnrichmentContext } from './enrichment-strategy.interface';
import { extractJsonObject, asString, asHttpUrl, asStringArray, JSON_ONLY_INSTRUCTION } from './ai-response.parser';

export interface PersonEnrichmentResult {
  bio?: string;
  wikipedia_url?: string;
  photo_url?: string;
  gender?: string;
  education?: string;
  notable_positions: string[];
}

export function parsePersonEnrichment(text: string): PersonEnrichmentResult | null {
  const parsed = extractJsonObject(text);
  if (!parsed) return null;
  return {
    bio: asString(parsed.bio),
    wikipedia_url: asHttpUrl(parsed.wikipedia_url),
    photo_url: asHttpUrl(parsed.photo_url),
    gender: asString(parsed.gender, 10),
    education: asString(parsed.education, 255),
    notable_positions: asStringArray(parsed.notable_positions, 15),
  };
}

const CHUNK_SIZE = 5;

export class PersonEnrichmentStrategy implements EnrichmentStrategy {
  name = 'person';
  private readonly logger = new Logger(PersonEnrichmentStrategy.name);

  async execute(id: string, context: EnrichmentContext, options?: { personIds?: string[] }) {
    const { prisma, callAi, reportProgress } = context;

    let persons = options?.personIds?.length
      ? await prisma.persons.findMany({ where: { id: { in: options.personIds } } })
      : await prisma.persons.findMany({ take: 100 }); // Batch size for safety

    persons = persons.filter((p) => !(p.metadata as any)?.ai_profile);

    const total = persons.length;
    let completed = 0;
    let failed = 0;
    await reportProgress({ total, completed, failed, inProgress: total > 0 });

    for (let i = 0; i < persons.length; i += CHUNK_SIZE) {
      const chunk = persons.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (person) => {
        try {
          const prompt = [
            `Research the Indian politician ${person.name}.`,
            JSON_ONLY_INSTRUCTION,
            'Keys: {"bio": string|null (3-4 sentences), "wikipedia_url": string|null, "photo_url": string|null (direct image URL),',
            ' "gender": "Male"|"Female"|"Other"|null, "education": string|null, "notable_positions": string[]}',
          ].join('\n');
          const text = await callAi(prompt, 1500);
          const parsed = parsePersonEnrichment(text);
          if (!parsed) throw new Error('No JSON object in AI response');

          const updatedMetadata = {
            ...((person.metadata as any) || {}),
            ai_profile: parsed.bio,
            wikipedia_url: parsed.wikipedia_url,
            notable_positions: parsed.notable_positions,
            ai_generated_at: new Date().toISOString(),
          };

          await prisma.persons.update({
            where: { id: person.id },
            data: {
              photo_url: person.photo_url || parsed.photo_url || undefined,
              gender: person.gender || parsed.gender || undefined,
              education: person.education || parsed.education || undefined,
              metadata: updatedMetadata
            }
          });
          completed++;
        } catch (err) {
          failed++;
          this.logger.warn(`Person enrichment failed for ${person.id} (${person.name}): ${(err as Error).message}`);
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
