import { useState, useEffect } from 'react';
import { getEnrichmentStatus, subscribeEnrichmentStream } from '../services/ai.service';
import type { EnrichmentProgress } from '../types';

/**
 * HOOK: useEnrichmentProgress (SOLID: SRP/DIP)
 * Tracks real-time AI enrichment progress via the authenticated SSE stream.
 */
export function useEnrichmentProgress(electionId?: string) {
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);

  useEffect(() => {
    if (!electionId) return;

    // 1. Initial Status
    getEnrichmentStatus(electionId)
      .then(setProgress)
      .catch(() => {});

    // 2. Stream Updates (returns an abort function)
    const unsubscribe = subscribeEnrichmentStream(electionId, setProgress);
    return unsubscribe;
  }, [electionId]);

  return progress;
}
