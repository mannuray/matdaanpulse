import type { AdapterFactory } from './types';
import type { LoopDeps } from './loop';
import { EciWebAdapter } from './adapters/eci-web';

/** What the adapters take from the worker: the default ECI base URL (the caller reads ECI_VS_BASE_URL), its log and clock. */
export interface AdapterEnv { eciBaseUrl?: string; log: LoopDeps['log']; now?: LoopDeps['now'] }

const aliases = (o: Record<string, string>) => (o.partyAliases ? JSON.parse(o.partyAliases) : undefined);
/** Source adapters this worker can run, by the API's `source` name. */
export function adaptersFor(env: AdapterEnv): Record<string, AdapterFactory> {
  const { log } = env;
  const now = env.now ? () => env.now!().getTime() : undefined;
  return {
    'eci-web': o => new EciWebAdapter({ id: 'eci-web', baseUrl: o.baseUrl ?? env.eciBaseUrl ?? '', stateCode: o.stateCode ?? '', intervalMs: o.intervalMs ? Number(o.intervalMs) : undefined, partyAliases: aliases(o), log, now }),
    'mock-eci': o => new EciWebAdapter({ id: 'mock-eci', baseUrl: o.baseUrl ?? 'http://localhost:4444', stateCode: o.stateCode ?? 'S04', intervalMs: o.intervalMs ? Number(o.intervalMs) : 5_000, partyAliases: aliases(o), log, now }),
  };
}
