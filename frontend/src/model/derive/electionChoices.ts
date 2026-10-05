/**
 * The election picker's content: Vidhan Sabha elections as one row per state (alphabetical, years oldest first), live
 * and upcoming ones pinned on top, filtered by a typed query ("bih", "2025", "bih 20": every word must match the state
 * name or the year). Pure: no React.
 */

interface ElectionLike { id: string; type: 'LS' | 'VS'; state_id: number | null; year: number; status: 'Live' | 'Upcoming' | 'Finalized' }
export interface ChoiceElection { id: string; year: number; status: ElectionLike['status'] }
export interface ChoiceRow { stateId: number; name: string; elections: ChoiceElection[] }
export interface ElectionChoices { pinned: (ChoiceElection & { stateName: string })[]; rows: ChoiceRow[] }

export function electionChoices(elections: ElectionLike[], states: { id: number; name: string }[], query: string): ElectionChoices {
  const name = new Map(states.map(s => [s.id, s.name]));
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = (stateName: string, year: number) =>
    words.every(w => stateName.toLowerCase().includes(w) || String(year).startsWith(w));
  const rows = new Map<number, ChoiceRow>();
  for (const e of elections) {
    if (e.type !== 'VS' || e.state_id == null || !name.has(e.state_id) || !matches(name.get(e.state_id)!, e.year)) continue;
    const row = rows.get(e.state_id) ?? { stateId: e.state_id, name: name.get(e.state_id)!, elections: [] };
    row.elections.push({ id: e.id, year: e.year, status: e.status });
    rows.set(e.state_id, row);
  }
  const list = [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
  for (const r of list) r.elections.sort((a, b) => a.year - b.year);
  const pinned = list.flatMap(r => r.elections.filter(x => x.status !== 'Finalized').map(x => ({ ...x, stateName: r.name })))
    .sort((a, b) => Number(b.status === 'Live') - Number(a.status === 'Live') || a.year - b.year || a.stateName.localeCompare(b.stateName));
  return { pinned, rows: list };
}
