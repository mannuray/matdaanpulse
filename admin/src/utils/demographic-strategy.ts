/**
 * STRATEGY: Demographic Transformation (SOLID: SRP)
 * Handles parsing and formatting of complex demographic data strings.
 */

export interface ParsedDemographics {
  population?: number;
  literacy_pct?: number;
  urban_pct?: number;
  sc_st_pct?: number;
  dominant_castes?: string[] | Record<string, number>;
  religions?: Record<string, number>;
  main_occupations?: string[];
}

export const DemographicStrategy = {
  /**
   * Formats a record or array into a comma-separated string for the UI.
   */
  format(value: any): string {
    if (!value) return '';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') {
      return Object.entries(value)
        .map(([k, v]) => (v != null ? `${k} ${v}%` : k))
        .join(', ');
    }
    return String(value);
  },

  /**
   * Parses a comma-separated string from the UI into structured JSON.
   */
  parseObject(input: string): Record<string, number> {
    const res: Record<string, number> = {};
    const parts = input.split(',').map(s => s.trim()).filter(Boolean);
    
    for (const part of parts) {
      const match = part.match(/^(.+?)\s+([\d.]+)%?$/);
      if (match) {
        res[match[1].trim()] = parseFloat(match[2]);
      } else {
        res[part] = 0;
      }
    }
    return res;
  },

  /**
   * Parses occupations or simple lists.
   */
  parseList(input: string): string[] {
    return input.split(',').map(s => s.trim()).filter(Boolean);
  }
};
