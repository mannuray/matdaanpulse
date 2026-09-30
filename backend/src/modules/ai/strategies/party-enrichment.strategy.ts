import { EnrichmentStrategy, EnrichmentContext } from './enrichment-strategy.interface';
import { PartyNotFoundException, AiParseErrorException } from '../../../common/exceptions';
import { extractJsonObject, asString, asHttpUrl, asInt, JSON_ONLY_INSTRUCTION } from './ai-response.parser';

export interface PartyEnrichmentResult {
  leader_name?: string;
  founded_year?: number;
  headquarters?: string;
  website?: string;
  wikipedia_url?: string;
  description?: string;
}

export function parsePartyEnrichment(text: string): PartyEnrichmentResult | null {
  const parsed = extractJsonObject(text);
  if (!parsed) return null;
  return {
    leader_name: asString(parsed.leader_name, 255),
    founded_year: asInt(parsed.founded_year, 1800, 2100),
    headquarters: asString(parsed.headquarters, 255),
    website: asHttpUrl(parsed.website),
    wikipedia_url: asHttpUrl(parsed.wikipedia_url),
    description: asString(parsed.description),
  };
}

export class PartyEnrichmentStrategy implements EnrichmentStrategy {
  name = 'party';

  async execute(partyId: string, context: EnrichmentContext) {
    const { prisma, callAi } = context;

    const party = await prisma.parties.findUnique({ where: { id: partyId } });
    if (!party) throw new PartyNotFoundException(partyId);

    const prompt = [
      `Research the Indian political party ${party.name} (${party.id}).`,
      JSON_ONLY_INSTRUCTION,
      'Keys: {"leader_name": string|null, "founded_year": number|null, "headquarters": string|null,',
      ' "website": string|null, "wikipedia_url": string|null, "description": string|null (2-3 sentences)}',
    ].join('\n');
    const text = await callAi(prompt, 1000);
    const parsed = parsePartyEnrichment(text);
    if (!parsed) throw new AiParseErrorException(`party ${partyId}`);

    return prisma.parties.update({
      where: { id: partyId },
      data: {
        leader_name: party.leader_name || parsed.leader_name,
        founded_year: party.founded_year || parsed.founded_year,
        headquarters: party.headquarters || parsed.headquarters,
        website: party.website || parsed.website,
        wikipedia_url: parsed.wikipedia_url ?? party.wikipedia_url,
        description: parsed.description ?? party.description,
      }
    });
  }
}
