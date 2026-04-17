import { Logger } from '@nestjs/common';
import { EnrichmentStrategy, EnrichmentContext } from './enrichment-strategy.interface';
import { ElectionNotFoundException } from '../../../common/exceptions';

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
          const prompt = `Perform ${effectiveMode} analysis for ${constituency.name} in ${election.name}.\n${contextStr}`;
          
          const text = await callAi(prompt, 2000);
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) throw new Error(`No JSON in AI response for ${constituency.name}`);
          const parsed = JSON.parse(jsonMatch[0]);

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
              ai_demographics: parsed.demographics,
              ai_key_issues: parsed.key_issues,
              ai_status: effectiveMode === 'pre_poll' ? 'pre_poll' : 'generated',
              ai_generated_at: new Date(),
            },
            create: {
              const_id: constituency.id,
              election_id: electionId,
              ai_briefing: parsed.briefing,
              ai_demographics: parsed.demographics,
              ai_key_issues: parsed.key_issues,
              ai_status: effectiveMode === 'pre_poll' ? 'pre_poll' : 'generated',
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
