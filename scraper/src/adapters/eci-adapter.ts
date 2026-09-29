/**
 * NOT IMPLEMENTED — placeholder for live Lok Sabha ECI ingestion (see src/index.ts).
 * For Vidhan Sabha result pages see ./eci-vs-adapter.ts (used by seed generators + simulation).
 */
export class ECIAdapter {
  /**
   * Fetch raw election data from the ECI source.
   * Stub implementation — replace with actual HTTP request logic.
   */
  async fetch(): Promise<string> {
    // TODO: implement actual fetch from ECI data source
    return '';
  }

  /**
   * Normalize raw fetched data into a standard format.
   * Stub implementation — replace with actual parsing/normalization logic.
   */
  normalize(rawData: string): Record<string, unknown>[] {
    // TODO: implement normalization of raw ECI data
    return [];
  }
}
