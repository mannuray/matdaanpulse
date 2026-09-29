/**
 * RE-EXPORT LAYER (SOLID: Interface Segregation)
 * This file maintains backward compatibility while the system migrates 
 * to domain-specific services.
 */

export * from './api-client';
export * from './election.service';
export * from './geo.service';
export * from './search.service';
export * from './person.service';

import { apiFetch } from './api-client';
export default apiFetch;
