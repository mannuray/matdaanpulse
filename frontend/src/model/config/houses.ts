/**
 * Houses the site shows. Lok Sabha is hidden for now (decided 2026-10-05): its data stays in the database and the
 * admin, but no list, picker, page or About row offers it, and its direct links redirect home. Add 'LS' to show it again.
 */
export type House = 'LS' | 'VS';
export const SHOWN_HOUSES: readonly House[] = ['VS'];

export const houseShown = (h: House | null | undefined): boolean => !!h && SHOWN_HOUSES.includes(h);

export function visibleElections<T extends { type: House }>(list: T[]): T[] {
  return list.filter(e => houseShown(e.type));
}
