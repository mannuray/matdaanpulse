const GENDERS: Record<string, string> = {
  m: 'Male', male: 'Male',
  f: 'Female', female: 'Female',
  o: 'Other', other: 'Other',
};

/** Form value for a stored gender: legacy 'M'/'F'/'O' become 'Male'/'Female'/'Other'; unknown values pass through. */
export function normalizeGender(g: string | null | undefined): string {
  const v = (g ?? '').trim();
  return GENDERS[v.toLowerCase()] ?? v;
}

/** Display label for tables and the panel header. */
export function genderLabel(g: string | null | undefined): string {
  return normalizeGender(g) || 'Not specified';
}

/** "5 contests · first 2010" (no first year when it is unknown). */
export function contestsLabel(contests: number, firstYear: number | null | undefined): string {
  const count = `${contests} ${contests === 1 ? 'contest' : 'contests'}`;
  return typeof firstYear === 'number' ? `${count} · first ${firstYear}` : count;
}
