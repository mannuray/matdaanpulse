import { useState, useEffect, useRef } from 'react';
import { getEnrichmentStatus, subscribeEnrichmentStream } from '../services/ai.service';
import type { EnrichmentProgress } from '../types';

/**
 * HOOK: useEnrichmentProgress (SOLID: SRP/DIP)
 * Manages Server-Sent Events (SSE) for real-time AI enrichment tracking.
 */
export function useEnrichmentProgress(electionId?: string) {
  const [progress, setProgress] = useState<EnrichmentProgress | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!electionId) return;

    // 1. Initial Status
    getEnrichmentStatus(electionId)
      .then(setProgress)
      .catch(() => {});

    // 2. Stream Updates
    const es = subscribeEnrichmentStream(electionId, (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);
      } catch {}
    });

    esRef.current = es;
    return () => es.close();
  }, [electionId]);

  return progress;
}
