import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getManifest, saveManifestDraft, publishManifest, getElections } from '../services/election.service';
import { getParties } from '../services/geo.service';
import { getConstituencies } from '../services/constituency.service';
import { useToast } from '../context/ToastContext';
import { ApiError } from '../services/api-client';
import { resolvePublishedManifest } from '../utils/manifest-helpers';
import type { Election, ManifestData, Party, Constituency } from '../types';

const DEFAULT_MANIFEST: ManifestData = {
  alliances: [],
  watchlists: [],
  tracked: [],
  milestones: [{ label: 'Majority', value: 272 }],
  compare_with: [],
  history: [],
  history_years: [],
  leaders: [],
  cabinet: [],
  vote_splits: [],
  live_tabs: [],
  geo: {}
};

/** 'not_found' only for a 404; anything else (network, 5xx) is a retryable failure. */
export type ManifestLoadError = 'not_found' | 'failed';

/**
 * CONTROLLER: Manifest Editor (MVC)
 * One election's manifest (the panel at /manifests/:electionId): load draft → published → default,
 * edit, save draft, publish.
 */
export function useManifestEditor(electionId: string | null) {
  const selectedId = electionId ?? '';
  const { toast, toastError } = useToast();

  const [elections, setElections] = useState<Election[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  
  const [manifest, setManifest] = useState<ManifestData>(DEFAULT_MANIFEST);
  const [loading, setLoading] = useState(!!electionId);
  const [saving, setSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  // Local edits not yet persisted to the server draft
  const [isDirty, setIsDirty] = useState(false);
  // True once a manifest (or its default) has been loaded for this election; a failed first load leaves it false.
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<ManifestLoadError | null>(null);
  const loadedIdRef = useRef<string | null>(null);

  useEffect(() => {
    getElections().then(setElections).catch(() => {});
    getParties().then(setParties).catch(() => []);
  }, []);

  const loadManifest = useCallback(async (eid: string) => {
    if (!eid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [m, c] = await Promise.all([
        getManifest(eid),
        getConstituencies(eid).catch(() => [])
      ]);
      
      setConstituencies(c);
      
      let data: ManifestData;
      if (m.draft) {
        data = m.draft;
        setIsDraft(true);
      } else if (m.manifest_url) {
        data = (await resolvePublishedManifest(m.manifest_url)) || DEFAULT_MANIFEST;
        setIsDraft(false);
      } else {
        data = DEFAULT_MANIFEST;
        setIsDraft(false);
      }

      // MIGRATION: Convert old leaders/cabinet formats to watchlists if needed
      const watchlists = data.watchlists || [];
      
      if (data.leaders && data.leaders.length > 0 && !watchlists.some(w => w.id === 'leaders')) {
        watchlists.push({ id: 'leaders', name: 'Leaders', entries: data.leaders as any });
      }
      if (data.cabinet && data.cabinet.length > 0 && !watchlists.some(w => w.id === 'cabinet')) {
        watchlists.push({ id: 'cabinet', name: 'Cabinet', entries: data.cabinet as any });
      }

      const merged: ManifestData = {
        ...DEFAULT_MANIFEST,
        ...data,
        alliances: data.alliances || [],
        watchlists: watchlists.map(w => ({ ...w, entries: w.entries || [] })),
        tracked: data.tracked || [],
        milestones: data.milestones || DEFAULT_MANIFEST.milestones,
        compare_with: data.compare_with || [],
        history: data.history || [],
        history_years: data.history_years || [],
        vote_splits: data.vote_splits || [],
        live_tabs: data.live_tabs || [],
        geo: data.geo || {}
      };

      setManifest(merged);
      setIsDirty(false);
      loadedIdRef.current = eid;
      setLoaded(true);
    } catch (err) {
      console.error('Manifest load error:', err);
      setLoadError(err instanceof ApiError && err.status === 404 ? 'not_found' : 'failed');
      toastError(err, 'Failed to load manifest data');
      // Only reset when switching elections; a failed reload keeps the local state.
      if (loadedIdRef.current !== eid) {
        setManifest(DEFAULT_MANIFEST);
        setConstituencies([]);
        setIsDraft(false);
        setIsDirty(false);
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedId) loadManifest(selectedId);
  }, [selectedId, loadManifest]);

  const partyMap = useMemo(() => {
    const map = new Map<string, Party>();
    parties.forEach(p => { if (p && p.id) map.set(p.id, p); });
    return map;
  }, [parties]);

  const electionMap = useMemo(() => {
    const map = new Map<string, Election>();
    elections.forEach(e => { if (e && e.id) map.set(e.id, e); });
    return map;
  }, [elections]);

  const trackedOptions = useMemo(() => {
    return constituencies.map(c => ({ id: c.id, name: c.name }));
  }, [constituencies]);

  const updateManifest = (key: keyof ManifestData, value: any) => {
    setManifest(prev => ({ ...prev, [key]: value }));
    setIsDraft(true);
    setIsDirty(true);
  };

  const setFullManifest = (data: ManifestData) => {
    setManifest({ ...DEFAULT_MANIFEST, ...data });
    setIsDraft(true);
    setIsDirty(true);
  };

  const saveDraft = async (data: ManifestData): Promise<boolean> => {
    if (!selectedId) return false;
    setSaving(true);
    try {
      await saveManifestDraft(selectedId, data);
      toast('Draft saved successfully');
      setIsDraft(true);
      setIsDirty(false);
      setManifest({ ...DEFAULT_MANIFEST, ...data });
      return true;
    } catch (err) {
      toastError(err, 'Failed to save draft');
      return false;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Publishes the server draft (the caller has already confirmed). Unsaved local edits (or `pending` data,
   * e.g. from the JSON tab) are saved first so the published version matches what's on screen.
   * Resolves true when published.
   */
  const publish = async (pending?: ManifestData): Promise<boolean> => {
    if (!selectedId) return false;
    if (isDirty || pending !== undefined) {
      const saved = await saveDraft(pending ?? manifest);
      if (!saved) {
        toast('Publish aborted: unsaved changes could not be saved', 'error');
        return false;
      }
    }
    setSaving(true);
    try {
      await publishManifest(selectedId);
      toast('Manifest published to the live site');
      setIsDraft(false);
      loadManifest(selectedId);
      return true;
    } catch (err) {
      toastError(err, 'Publish failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    selectedId, elections, parties, constituencies,
    manifest, updateManifest, setFullManifest, loading, saving, isDraft, isDirty, loadError, loaded, reload: loadManifest,
    contestingParties: parties, partyMap, electionMap, trackedOptions,
    saveDraft, publish
  };
}
