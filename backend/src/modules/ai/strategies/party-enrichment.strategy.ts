import { EnrichmentStrategy, EnrichmentContext } from './enrichment-strategy.interface';
import { PartyNotFoundException, AiParseErrorException } from '../../../common/exceptions';

export class PartyEnrichmentStrategy implements EnrichmentStrategy {
  name = 'party';

  async execute(partyId: string, context: EnrichmentContext) {
    const { prisma, callAi } = context;

    const party = await prisma.parties.findUnique({ where: { id: partyId } });
    if (!party) throw new PartyNotFoundException(partyId);

    const prompt = `Research political party: ${party.name} (${party.id}). Return JSON with leader_name, founded_year, headquarters, website, wikipedia_url, and a brief description.`;
    const text = await callAi(prompt, 1000);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new AiParseErrorException(`party ${partyId}`);
    const parsed = JSON.parse(jsonMatch[0]);

    return prisma.parties.update({
      where: { id: partyId },
      data: {
        leader_name: party.leader_name || parsed.leader_name,
        founded_year: party.founded_year || parsed.founded_year,
        headquarters: party.headquarters || parsed.headquarters,
        website: party.website || parsed.website,
        wikipedia_url: parsed.wikipedia_url,
        description: parsed.description
      }
    });
  }
}
