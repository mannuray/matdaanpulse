/**
 * The seats needed to win: the manifest's "Majority" milestone, else half the seats plus one. None when the manifest
 * says `no_majority` (Andhra 2009: the 175 Andhra seats of the undivided state's 294-seat assembly).
 */
export function majorityOf(manifest: { milestones?: { label: string; value: number }[]; no_majority?: boolean } | null | undefined, totalSeats: number): number | null {
  if (manifest?.no_majority) return null;
  return manifest?.milestones?.find(m => /majority/i.test(m.label))?.value || Math.floor(totalSeats / 2) + 1;
}
