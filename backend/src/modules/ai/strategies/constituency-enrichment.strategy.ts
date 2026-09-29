import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { EnrichmentStrategy, EnrichmentContext } from './enrichment-strategy.interface';
import { ElectionNotFoundException } from '../../../common/exceptions';
import { extractJsonObject, asString, asStringArray, asObject, JSON_ONLY_INSTRUCTION } from './ai-response.parser';

export interface ConstituencyEnrichmentResult {
  briefing: string;
  demographics: Record<string, unknown> | null;
  key_issues: string[];
  tags: string[];
}

/** Build the prompt; the JSON keys here must match parseConstituencyEnrichment. */
export function buildConstituencyPrompt(constituencyName: string, electionName: string, mode: string, contextStr: string): string {
  const focus = mode === 'post_poll'
    ? 'Explain the outcome: why the winner won, the margin, vote-share shifts and what it signals.'
    : 'Give a pre-poll outlook: key contenders, local factors and what will decide the seat.';
  return [
    `You are an Indian election analyst. Perform a ${mode} analysis of the ${constituencyName} constituency in the ${electionName}.`,
    focus,
    '',
    contextStr,
    '',
    JSON_ONLY_INSTRUCTION,
    'The JSON object must have exactly these keys:',
    '{',
    '  "briefing": string,            // 3-5 sentence analytical briefing',
    '  "demographics": {              // best-known estimates, null if unknown',
    '    "population": number|null, "literacy_pct": number|null, "urban_pct": number|null,',
    '    "sc_st_pct": number|null, "dominant_castes": string[]|null, "religions": {"<name>": pct}|null',
    '  },',
    '  "key_issues": string[],        // 3-6 short local issues',
    '  "tags": string[]               // 1-5 short lowercase labels, e.g. "urban", "swing-seat"',
    '}',
  ].join('\n');
}

/** Parse and coerce a model response. Throws if no usable briefing is present. */
export function parseConstituencyEnrichment(text: string): ConstituencyEnrichmentResult {
  const parsed = extractJsonObject(text);
  if (!parsed) throw new Error('No JSON object in AI response');
  const briefing = asString(parsed.briefing);
  if (!briefing) throw new Error('AI response missing "briefing"');
  return {
    briefing,
    demographics: asObject(parsed.demographics) ?? null,
    key_issues: asStringArray(parsed.key_issues, 10),
    tags: asStringArray(parsed.tags, 5, 40).map((t) => t.toLowerCase()),
  };
}

export class ConstituencyEnrichmentStrategy implements EnrichmentStrategy {
  name = 'constituency';
  private readonly logger = new Logger(ConstituencyEnrichmentStrategy.name);

  async execute(electionId: string, context: EnrichmentContext, options?: { constIds?: string[], mode?: string }) {
    const { prisma, callAi, reportProgress } = context;

    const election = await prisma.elections.findUnique({ where: { id: electionId }, include: { states: true } });
    if (!election) throw new ElectionNotFoundException(electionId);

    const effectiveMode = options?.mode || (election.status === 'Finalized' ? 'post_poll' : 'pre_poll');
    
    let targetConstituencies: any[];
    if (options?.constIds?.length) {
      targetConstituencies = await prisma.constituencies.findMany({ where: { id: { in: options.constIds } } });
    } else {
      targetConstituencies = await prisma.constituencies.findMany({ where: { election_id: electionId } });
    }

    const total = targetConstituencies.length;
    let completed = 0;
    let failed = 0;
    await reportProgress({ total, completed, failed, inProgress: total > 0 });

    // Process in smaller chunks to be memory efficient and parallel
    const CHUNK_SIZE = 5;
    for (let i = 0; i < targetConstituencies.length; i += CHUNK_SIZE) {
      const chunk = targetConstituencies.slice(i, i + CHUNK_SIZE);
      const chunkIds = chunk.map(c => c.id);

      // Fetch ONLY what's needed for this chunk
      const [chunkCandidates, chunkResults] = await Promise.all([
        prisma.candidates.findMany({ where: { const_id: { in: chunkIds } }, include: { parties: true } }),
        prisma.results.findMany({ where: { const_id: { in: chunkIds }, election_id: electionId } }),
      ]);

      const candidatesByConst = new Map<string, any[]>();
      for (const c of chunkCandidates) {
        const arr = candidatesByConst.get(c.const_id) || [];
        arr.push(c);
        candidatesByConst.set(c.const_id, arr);
      }
      const resultsByConst = new Map<string, any[]>();
      for (const r of chunkResults) {
        const arr = resultsByConst.get(r.const_id) || [];
        arr.push(r);
        resultsByConst.set(r.const_id, arr);
      }

      await Promise.all(chunk.map(async (constituency) => {
        try {
          const contextStr = this.buildContext(constituency, candidatesByConst.get(constituency.id) || [], resultsByConst.get(constituency.id) || []);
          const prompt = buildConstituencyPrompt(constituency.name, election.name, effectiveMode, contextStr);

          const text = await callAi(prompt, 2000);
          const parsed = parseConstituencyEnrichment(text);

          if (parsed.tags?.length) {
            const meta = (constituency.metadata as any) || {};
            const tags = [...new Set([...(meta.tags || []), ...parsed.tags])];
            await prisma.constituencies.update({
              where: { id: constituency.id },
              data: { metadata: { ...meta, tags } }
            });
          }

          await prisma.constituency_analysis.upsert({
            where: { const_id_election_id: { const_id: constituency.id, election_id: electionId } },
            update: {
              ai_briefing: parsed.briefing,
              ai_demographics: parsed.demographics ? (parsed.demographics as Prisma.InputJsonValue) : Prisma.JsonNull,
              ai_key_issues: parsed.key_issues,
              ai_status: effectiveMode === 'pre_poll' ? 'pre_poll' : 'generated',
              ai_generated_at: new Date(),
            },
            create: {
              const_id: constituency.id,
              election_id: electionId,
              ai_briefing: parsed.briefing,
              ai_demographics: parsed.demographics ? (parsed.demographics as Prisma.InputJsonValue) : Prisma.JsonNull,
              ai_key_issues: parsed.key_issues,
              ai_status: effectiveMode === 'pre_poll' ? 'pre_poll' : 'generated',
              ai_generated_at: new Date(),
            }
          });

          completed++;
        } catch (err) {
          failed++;
          this.logger.warn(`Enrichment failed for ${constituency.id} (${constituency.name}): ${(err as Error).message}`);
        }
      }));
      
      await reportProgress({ 
        total, completed, failed, 
        inProgress: completed + failed < total,
        last_const_name: chunk[chunk.length - 1].name 
      });
    }

    return { total, completed, failed };
  }

  private buildContext(constituency: any, candidates: any[], results: any[]): string {
    const lines: string[] = [];
    const sorted = [...results].sort((a, b) => b.votes - a.votes);
    if (sorted.length > 0) {
      lines.push('ELECTION RESULTS (current):');
      for (const r of sorted.slice(0, 6)) {
        const cand = candidates.find((c) => c.id === r.candidate_id);
        lines.push(`  ${cand?.name || '?'} (${cand?.party_id || 'IND'}) — ${r.votes} votes ${r.status === 'WON' ? '← WINNER' : ''}`);
      }
    }
    lines.push(`Total electors: ${constituency.total_electors || 'Unknown'}`);
    lines.push(`Seat category: ${constituency.type}`);
    return lines.join('\n');
  }
}
