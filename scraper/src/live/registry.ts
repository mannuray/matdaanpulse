import type { AdapterFactory } from './types';
/** Source adapters this worker can run, by the API's `source` name. Tasks 12–13 add 'mock-eci' and 'eci-web'. */
export const ADAPTERS: Record<string, AdapterFactory> = {};
