import type { Party } from '../types';

export interface PartyMeta {
  id: string;
  name: string;
  abbreviation: string | null;
  color: string | null;
  /** Image URL: logo, else ECI ballot symbol, else null (draw the colour dot). */
  mark: string | null;
  eciRecognition: 'National' | 'State' | 'Unrecognised' | null;
}

const present = (s: string | null | undefined) => (s && s.trim() ? s : null);

/** D1: party logo → ECI ballot symbol → none. */
export function partyMark(p: { symbol_url?: string | null; eci_symbol_url?: string | null } | null | undefined): string | null {
  if (!p) return null;
  return present(p.symbol_url) ?? present(p.eci_symbol_url);
}

export function buildPartyMeta(parties: Party[]): Map<string, PartyMeta> {
  return new Map(parties.map(p => [p.id, {
    id: p.id, name: p.name, abbreviation: p.abbreviation ?? null, color: p.color, mark: partyMark(p), eciRecognition: p.eci_recognition ?? null,
  }]));
}

/** NOTA rows: party id 'NOTA' (seeds) or the name. Never a person link, never a party dialog, always last. */
export function isNota(partyId: string | null | undefined, name?: string): boolean {
  return partyId === 'NOTA' || (!!name && name.trim().toUpperCase() === 'NOTA');
}
