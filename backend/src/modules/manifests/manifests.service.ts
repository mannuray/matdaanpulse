import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ManifestNotFoundException, ManifestNoDraftException } from '../../common/exceptions';

const DRAFT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_DRAFTS = 50;

@Injectable()
export class ManifestsService {
  private drafts = new Map<string, { data: object; savedAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  private cleanupDrafts() {
    const now = Date.now();
    for (const [key, entry] of this.drafts) {
      if (now - entry.savedAt > DRAFT_TTL_MS) this.drafts.delete(key);
    }
    // Evict oldest if over capacity
    if (this.drafts.size > MAX_DRAFTS) {
      const oldest = [...this.drafts.entries()].sort((a, b) => a[1].savedAt - b[1].savedAt);
      for (let i = 0; i < this.drafts.size - MAX_DRAFTS; i++) this.drafts.delete(oldest[i][0]);
    }
  }

  async getManifest(electionId: string) {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId } });
    if (!election) throw new ManifestNotFoundException(electionId);
    const draft = this.drafts.get(electionId)?.data || null;
    return { election_id: electionId, manifest_url: election.manifest_url, draft };
  }

  async saveDraft(electionId: string, manifest: object) {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId } });
    if (!election) throw new ManifestNotFoundException(electionId);
    this.cleanupDrafts();
    this.drafts.set(electionId, { data: manifest, savedAt: Date.now() });
    return { election_id: electionId, status: 'draft_saved' };
  }

  async publish(electionId: string) {
    const election = await this.prisma.elections.findUnique({ where: { id: electionId } });
    if (!election) throw new ManifestNotFoundException(electionId);

    const draftEntry = this.drafts.get(electionId);
    if (!draftEntry) throw new ManifestNoDraftException(electionId);
    const draft = draftEntry.data;

    await this.prisma.elections.update({
      where: { id: electionId },
      data: { manifest_url: JSON.stringify(draft) }
    });

    this.drafts.delete(electionId);
    return { election_id: electionId, status: 'published' };
  }
}
