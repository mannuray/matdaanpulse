import type { AdapterFactory } from './types';
import { EciWebAdapter } from './adapters/eci-web';

const aliases = (o: Record<string, string>) => (o.partyAliases ? JSON.parse(o.partyAliases) : undefined);
/** Source adapters this worker can run, by the API's `source` name. */
export const ADAPTERS: Record<string, AdapterFactory> = {
  'eci-web': o => new EciWebAdapter({ id: 'eci-web', baseUrl: o.baseUrl ?? process.env.ECI_VS_BASE_URL ?? '', stateCode: o.stateCode ?? '', intervalMs: o.intervalMs ? Number(o.intervalMs) : undefined, partyAliases: aliases(o) }),
  'mock-eci': o => new EciWebAdapter({ id: 'mock-eci', baseUrl: o.baseUrl ?? 'http://localhost:4444', stateCode: o.stateCode ?? 'S04', intervalMs: o.intervalMs ? Number(o.intervalMs) : 5_000, partyAliases: aliases(o) }),
};
