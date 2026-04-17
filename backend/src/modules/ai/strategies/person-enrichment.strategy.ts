import { Logger } from '@nestjs/common';
import { EnrichmentStrategy, EnrichmentContext } from './enrichment-strategy.interface';

export class PersonEnrichmentStrategy implements EnrichmentStrategy {
  name = 'person';
  private readonly logger = new Logger(PersonEnrichmentStrategy.name);

  async execute(id: string, context: EnrichmentContext, options?: { personIds?: string[] }) {
    const { prisma, callAi } = context;
    
    let persons = options?.personIds?.length
      ? await prisma.persons.findMany({ where: { id: { in: options.personIds } } })
      : await prisma.persons.findMany({ take: 100 }); // Batch size for safety

    persons = persons.filter((p) => !(p.metadata as any)?.ai_profile);

    for (const person of persons) {
      try {
        const prompt = `Research politician ${person.name}. Return JSON with bio, wikipedia_url, gender, education, and notable_positions.`;
        const text = await callAi(prompt, 1500);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        const parsed = JSON.parse(jsonMatch[0]);

        const updatedMetadata = {
          ...(person.metadata as any || {}),
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
      } catch (err) {
        this.logger.warn(`Person enrichment failed for ${person.id} (${person.name}): ${(err as Error).message}`);
      }
    }
    return { total: persons.length };
  }
}
