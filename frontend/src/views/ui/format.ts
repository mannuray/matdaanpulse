/** Indian digit grouping (20,14,532). */
export function formatIN(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

const trim = (x: number) => (Math.round(x * 10) / 10).toString();

/** Affidavit money: ₹4.8 Cr / ₹32 L / ₹8,500. */
export function formatRupees(n: number | null | undefined): string | null {
  if (n == null) return null;
  if (n >= 1e7) return `₹${trim(n / 1e7)} Cr`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} L`;
  return `₹${formatIN(n)}`;
}
