/**
 * The Regions map layer: every region is outlined around its seats (no region shapes are drawn; the outline is built
 * from the seats), and the region whose seats are exactly the current highlight gets a strong outline. A later
 * auto-zoom can take the strong region's seats from here.
 */
export interface RegionOutline { name: string; seatIds: string[]; strong: boolean }

export function regionOutlines(regions: { name: string; seatIds: string[] }[], highlight: Set<string>): RegionOutline[] {
  return regions.filter(r => r.seatIds.length > 0).map(r => ({
    name: r.name, seatIds: r.seatIds,
    strong: highlight.size === r.seatIds.length && r.seatIds.every(id => highlight.has(id)),
  }));
}
