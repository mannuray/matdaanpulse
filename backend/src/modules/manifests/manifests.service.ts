import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ElectionNotFoundException, ManifestNoDraftException } from '../../common/exceptions';

/**
 * Manifest drafts are persisted in `elections.manifest_draft` (JSONB).
 * Publishing copies the draft into `manifest_url` (as a JSON string, the
 * format the frontend already parses) and clears the draft.
 */
@Injectable()
export class ManifestsService {
  constructor(private readonly prisma: PrismaService) {}

  private async findElection(electionId: string) {
    const election = await this.prisma.elections.findUnique({
      where: { id: electionId },
      select: { id: true, manifest_url: true, manifest_draft: true },
    });
    if (!election) throw new ElectionNotFoundException(electionId);
    return election;
  }

  async getManifest(electionId: string) {
    const election = await this.findElection(electionId);
    return {
      election_id: electionId,
      manifest_url: election.manifest_url,
      draft: election.manifest_draft ?? null,
    };
  }

  async saveDraft(electionId: string, manifest: object) {
    await this.findElection(electionId);
    await this.prisma.elections.update({
      where: { id: electionId },
      data: { manifest_draft: manifest as Prisma.InputJsonValue },
    });
    return { election_id: electionId, status: 'draft_saved' };
  }

  async publish(electionId: string) {
    const election = await this.findElection(electionId);
    if (election.manifest_draft === null || election.manifest_draft === undefined) {
      throw new ManifestNoDraftException(electionId);
    }

    await this.prisma.elections.update({
      where: { id: electionId },
      data: {
        manifest_url: JSON.stringify(election.manifest_draft),
        manifest_draft: Prisma.DbNull,
      },
    });
    return { election_id: electionId, status: 'published' };
  }
}
