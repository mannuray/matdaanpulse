/** The election last opened in each house, kept in localStorage as the raw id (`lastElection_<type>`); best effort. */
type House = 'LS' | 'VS';
const keyOf = (type: House) => `lastElection_${type}`;

export function rememberElection(type: House, id: string | null): void {
  try { if (id) localStorage.setItem(keyOf(type), id); else localStorage.removeItem(keyOf(type)); } catch { /* storage unavailable */ }
}

export function recallElectionId(type: House): string | null {
  try { return localStorage.getItem(keyOf(type)); } catch { return null; }
}
