/**
 * The mock ECI's party-wise results page (partywiseresult-<state>.htm): seats won and leading per party at the current
 * round, in the table shape the real adapter's parsePartywisePage reads, so the worker's tally check runs in simulation.
 */
export interface SeatAtRound { status: string; candidates: { partyName: string; votes: number }[] }

/** Declared seats count as won, counting seats as leading; an exact tie at the top counts for nobody (as the backend). Party order: first seen. */
export function partywiseRows(seats: (SeatAtRound | null)[]): { party: string; won: number; leading: number }[] {
  const out = new Map<string, { party: string; won: number; leading: number }>();
  for (const s of seats) {
    if (!s || s.candidates.length === 0) continue;
    const [a, b] = [...s.candidates].sort((x, y) => y.votes - x.votes);
    if (a.votes <= 0 || (b && b.votes === a.votes)) continue;
    const row = out.get(a.partyName) ?? out.set(a.partyName, { party: a.partyName, won: 0, leading: 0 }).get(a.partyName)!;
    if (s.status === 'Result Declared') row.won++; else row.leading++;
  }
  return [...out.values()];
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderPartywise(rows: { party: string; won: number; leading: number }[]): string {
  const body = rows.map(r => `<tr><td>${esc(r.party)}</td><td>${r.won}</td><td>${r.leading}</td><td>${r.won + r.leading}</td></tr>`).join('');
  return `<html><body><table class="table"><thead><tr><th>Party</th><th>Won</th><th>Leading</th><th>Total</th></tr></thead><tbody>${body}</tbody></table></body></html>`;
}
