import { useCallback, useEffect, useRef, useState } from 'react';
import { getIngestStatus, getSources, putFeedSettings } from '../services/ingest.service';
import { useToast } from '../context/ToastContext';
import type { IngestStatus } from '../types';

const POLL_MS = 10_000;

/** CONTROLLER: the Live Console feed (spec §5) — status every 10 s, sources seen, settings save. */
export function useIngestFeed(electionId: string | null) {
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast, toastError } = useToast();
  const toastRef = useRef({ toast, toastError });
  toastRef.current = { toast, toastError };

  const reload = useCallback(async () => {
    if (!electionId) return;
    try { setStatus(await getIngestStatus(electionId)); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, [electionId]);

  useEffect(() => {
    if (!electionId) return;
    void reload();
    getSources(electionId).then(setSources).catch(() => setSources([]));
    const t = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(t);
  }, [electionId, reload]);

  const setFeed = useCallback(async (active_source: string | null, hold_minutes: number) => {
    if (!electionId) return false;
    setSaving(true);
    try { setStatus(await putFeedSettings(electionId, { active_source, hold_minutes })); toastRef.current.toast('Feed updated'); return true; }
    catch (e) { toastRef.current.toastError(e, 'Failed to update the feed'); return false; }
    finally { setSaving(false); }
  }, [electionId]);

  return { status, sources, error, saving, setFeed, reload };
}
