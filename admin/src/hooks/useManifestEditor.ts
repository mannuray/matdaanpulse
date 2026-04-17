import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getManifest, saveManifestDraft, publishManifest, getElections } from '../services/election.service';
import { getParties } from '../services/geo.service';
import { getConstituencies } from '../services/constituency.service';
import { useToast } from '../context/ToastContext';
import type { Election, ManifestData, Party, Constituency, Watchlist } from '../types';

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

/**
 * CONTROLLER: Manifest Editor (MVC)
 */
export function useManifestEditor() {
  const { id: urlId } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedId, setSelectedId] = useState(urlId || '');
  const [parties, setParties] = useState<Party[]>([]);
  const [constituencies, setConstituencies] = useState<Constituency[]>([]);
  
  const [manifest, setManifest] = useState<ManifestData>(DEFAULT_MANIFEST);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDraft, setIsDraft] = useState(false);

  // Sync with URL if it changes
  useEffect(() => {
    if (urlId) setSelectedId(urlId);
  }, [urlId]);

  useEffect(() => {
    getElections().then(setElections).catch(() => {});
    getParties().then(setParties).catch(() => []);
  }, []);

  const loadManifest = useCallback(async (eid: string) => {
    if (!eid) return;
    setLoading(true);
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
        if (m.manifest_url.startsWith('{')) {
          try {
            data = JSON.parse(m.manifest_url);
          } catch {
            data = DEFAULT_MANIFEST;
          }
        } else {
          const response = await fetch(m.manifest_url);
          data = await response.json();
        }
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
    } catch (err) {
      console.error('Manifest load error:', err);
      toast('Failed to load manifest data', 'error');
      setManifest(DEFAULT_MANIFEST);
      setConstituencies([]);
      setIsDraft(false);
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
  };

  const setFullManifest = (data: ManifestData) => {
    setManifest({ ...DEFAULT_MANIFEST, ...data });
    setIsDraft(true);
  };

  const saveDraft = async (data: ManifestData) => {
    if (!selectedId) return;
    setSaving(true);
    try {
      await saveManifestDraft(selectedId, data);
      toast('Draft saved successfully');
      setIsDraft(true);
      setManifest(prev => ({ ...prev, ...data }));
    } catch {
      toast('Failed to save draft', 'error');
    } finally {
      setSaving(false);
    }
  };

  const publish = async () => {
    if (!selectedId) return;
    if (!window.confirm('Publish this manifest to the live frontend?')) return;
    setSaving(true);
    try {
      await publishManifest(selectedId);
      toast('Manifest published LIVE');
      setIsDraft(false);
      loadManifest(selectedId);
    } catch {
      toast('Publish failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return {
    selectedId, setSelectedId, elections, parties, constituencies,
    manifest, updateManifest, setFullManifest, loading, saving, isDraft,
    contestingParties: parties, partyMap, electionMap, trackedOptions,
    saveDraft, publish
  };
}
