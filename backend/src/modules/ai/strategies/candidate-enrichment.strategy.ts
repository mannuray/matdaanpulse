import { Logger } from '@nestjs/common';
import { EnrichmentStrategy, EnrichmentContext } from './enrichment-strategy.interface';

export class CandidateEnrichmentStrategy implements EnrichmentStrategy {
  name = 'candidate';
  private readonly logger = new Logger(CandidateEnrichmentStrategy.name);

  async execute(electionId: string, context: EnrichmentContext) {
    const { prisma, callAi } = context;
    
    const candidates = await prisma.candidates.findMany({
      where: { election_id: electionId, NOT: { name: 'NOTA' } },
      include: { constituencies: true }
    });

    for (const candidate of candidates) {
      try {
        const prompt = `Research candidate ${candidate.name} contesting in ${candidate.constituencies.name}. Return JSON with age, gender, education, and professional background.`;
        const text = await callAi(prompt, 1000);
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;
        const parsed = JSON.parse(jsonMatch[0]);

        await prisma.candidates.update({
          where: { id: candidate.id },
          data: { metadata: { ...(candidate.metadata as any || {}), ...parsed, ai_generated_at: new Date().toISOString() } }
        });
      } catch (err) {
        this.logger.warn(`Candidate enrichment failed for ${candidate.id} (${candidate.name}): ${(err as Error).message}`);
      }
    }
    return { total: candidates.length };
  }
}
