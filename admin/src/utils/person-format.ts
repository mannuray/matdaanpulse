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
