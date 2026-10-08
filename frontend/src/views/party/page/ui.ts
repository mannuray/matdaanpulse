/** Shared look of the party page cards (as the person page). */
export const tile = 'rounded-2xl border border-line bg-tile';
export const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;
export const heading = 'font-display text-lg font-bold uppercase tracking-wide text-ink';
export const fmtShare = (n: number) => `${n.toFixed(1)}%`;
/** A signed number: "+3", "−4", "0". */
export const signed = (n: number, digits = 0) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(digits);
