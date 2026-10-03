import { apiFetch } from './api-client';
import type { ImageCredit } from '../types';

/** Credits for the images we host (About page). */
export async function getCredits(): Promise<ImageCredit[]> {
  return (await apiFetch<ImageCredit[]>('/credits')) ?? [];
}
