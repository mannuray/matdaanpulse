import { allianceByParty, FALLBACK_COLOR, int, seatLabel, shortName } from './shared';

const FLIPPED_LIMIT = 15;
import type { SummaryContext, SummaryRow, SummarySection } from './types';

/** SwingSection.tsx:13-65 — flips grouped by alliance (or the party itself when it has no alliance). */
export function swingSummary(ctx: SummaryContext): SummarySection[] {
  const swing = ctx.swing;
  if (!swing || swing.size === 0) return [];
  const al = allianceByParty(ctx.alliances);
  const seatName = new Map(ctx.seats.map(s => [s.id, seatLabel(s.name)]));
  const gains = new Map<string, number>();
  const gainedIds = new Map<string, string[]>();
  const losses = new Map<string, number>();
  const info = new Map<string, { name: string; color: string; partyIds: string[] }>();
  const describe = (party: string) => {
    const a = al.get(party);
    const key = a?.id ?? party;
    if (!info.has(key)) info.set(key, { name: a?.name ?? party, color: a?.color ?? ctx.partyColor.get(party) ?? FALLBACK_COLOR, partyIds: a?.parties ?? [party] });
    return { key, ...info.get(key)! };
  };
  // A seat won unopposed flips like any other but has no margin: it lists after the real margins.
  const unopposed = new Set(ctx.seats.filter(s => s.uncontested).map(s => s.id));
  const flips: { id: string; from: string; to: string; fromColor: string; toColor: string; margin: number | null; parties: string[] }[] = [];
  for (const e of swing.values()) {
    if (!e.flipped) continue;
    const from = describe(e.prevParty);
    const to = describe(e.currentParty);
    losses.set(from.key, (losses.get(from.key) ?? 0) + 1);
    gains.set(to.key, (gains.get(to.key) ?? 0) + 1);
    gainedIds.set(to.key, [...(gainedIds.get(to.key) ?? []), e.constId]);
    flips.push({ id: e.constId, from: from.name, to: to.name, fromColor: from.color, toColor: to.color, margin: unopposed.has(e.constId) ? null : e.currentMargin, parties: [e.prevParty, e.currentParty] });
  }
  if (flips.length === 0) return [];
  flips.sort((a, b) => (a.margin ?? Infinity) - (b.margin ?? Infinity));

  const net = [...new Set([...gains.keys(), ...losses.keys()])].map(key => {
    const g = gains.get(key) ?? 0;
    const l = losses.get(key) ?? 0;
    return { key, ...info.get(key)!, gained: g, lost: l, net: g - l };
  }).sort((a, b) => b.net - a.net);
  const max = Math.max(...net.map(n => Math.abs(n.net)), 1);
  const netRows: SummaryRow[] = net.map(n => ({
    id: `bloc:${n.key}`, label: n.name, value: n.gained, valueFormat: 'int' as const,
    extra: [int(n.lost), { value: n.net, format: 'signed' as const }], color: n.color, partyIds: n.partyIds, seatIds: gainedIds.get(n.key) ?? [],
    bar: { value: n.net, max, color: n.color },
  }));

  // Legacy order: flipped seats (closest 15, header shows the total), then net swing by alliance (Gained, Lost, Net).
  return [
    {
      id: 'flipped', titleKey: 'studio_sum_flipped', titleParams: { count: flips.length }, more: Math.max(0, flips.length - FLIPPED_LIMIT),
      rows: flips.slice(0, FLIPPED_LIMIT).map(f => ({
        id: `seat:${f.id}`, label: seatName.get(f.id) ?? shortName(f.id), sub: `${f.from} → ${f.to}`,
        value: f.margin, valueFormat: 'compact' as const, color: f.toColor, seatIds: [f.id], partyIds: f.parties,
      })),
    },
    { id: 'net_swing', titleKey: 'studio_sum_net_swing', columnsKeys: ['studio_col_gained', 'studio_col_lost', 'studio_col_net'], primaryCol: 2, rows: netRows },
  ];
}
