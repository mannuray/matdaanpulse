/**
 * Shared GeoJSON feature property helpers.
 * Used by InteractiveMap, StatesMiniMap, and useMapRendering.
 */

export type FeatureProperties = {
  pc_name?: string;
  pc_id?: number;
  pc_category?: string;
  ac_name?: string;
  ac_no?: number;
  ac_category?: string;
  st_name: string;
};

export type GeoFeature = GeoJSON.Feature<GeoJSON.Geometry, FeatureProperties>;

export function featureName(props: Partial<FeatureProperties>): string {
  return props.pc_name || props.ac_name || '';
}

export function featureCategory(props: Partial<FeatureProperties>): string {
  return props.pc_category || props.ac_category || 'GEN';
}

export function normName(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
