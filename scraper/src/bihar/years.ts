/** Bihar's elections (kept for existing imports; the registry is elections.ts). */
import { electionsOf, type ElectionConfig } from './elections';

export type { YearConfig } from './elections';
export const YEARS: Record<number, ElectionConfig> = Object.fromEntries(electionsOf('BR').map(e => [e.year, e]));
