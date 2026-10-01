/** Suggested tags in the panel's tag input (free text is also allowed). */
export const TAG_PALETTE = [
  'yadav_dominated', 'bhumihar_dominated', 'rajput_dominated', 'kurmi_belt', 'ebc_majority', 'dalit_stronghold',
  'muslim_majority', 'muslim_significant', 'mixed_religious',
  'urban', 'semi_urban', 'rural', 'border', 'flood_prone', 'naxal_affected',
];

/** Tags offered by the toolbar's bulk "Add tag" select (unchanged from the old page). */
export const BULK_TAGS = ['yadav_dominated', 'bhumihar_dominated', 'kurmi_belt', 'urban', 'rural'];

/** 'yadav_dominated' → 'Yadav dominated' (sentence case; the stored value is unchanged). */
export function tagLabel(tag: string): string {
  const s = tag.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
