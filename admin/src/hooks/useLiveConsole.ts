import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  getElections, getManifest, getLiveResults, 
  overrideResult, subscribeLiveUpdates 
} from '../services/election.service';
import { getStates } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import { resolvePublishedManifest } from '../utils/manifest-helpers';
import type { OverridePayload } from '../utils/override-validation';
import type { Election, State, LiveConstituency, LiveTab, ManifestData } from '../types';

const TAB_SIZE = 15;
const FLASH_MS = 1500;
const RELOAD_DEBOUNCE_MS = 500;

function autoChunkTabs(constituencies: LiveConstituency[]): LiveTab[] {
  const tabs: LiveTab[] = [];
  for (let i = 0; i < constituencies.length; i += TAB_SIZE) {
    const chunk = constituencies.slice(i, i + TAB_SIZE);
    const first = chunk[0].const_no;
    const last = chunk[chunk.length - 1].const_no;
    tabs.push({ label: `${first}–${last}`, const_nos: chunk.map((c) => c.const_no) });
  }
  return tabs;
}

/**
 * CONTROLLER: Live Console (MVC)
 * Handles real-time result streaming, manual overrides, and multi-tab navigation.
 */
export function useLiveConsole() {
  const { toast, toastError } = useToast();
  
  // Master Data
  const [elections, setElections] = useState<Election[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [constituencies, setConstituencies] = useState<LiveConstituency[]>([]);
  const [tabs, setTabs] = useState<LiveTab[]>([]);
  const [activeTab, setActiveTab] = useState(0);
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  
  const esRef = useRef<EventSource | null>(null);

  // 1. Initial Load
  useEffect(() => {
    getElections().then((all) => {
      setElections(all);
      const live = all.find((e) => e.status === 'Live');
      if (live) setSelectedElectionId(live.id);
    }).catch(() => {});
    getStates().then(setStates).catch(() => {});
  }, []);

  // 2. Load Results & Config
  const loadResults = useCallback(async (eid: string, opts?: { silent?: boolean }) => {
    if (!eid) return;
    if (!opts?.silent) setLoading(true);
    try {
      const [data, manifest] = await Promise.all([
        getLiveResults(eid),
        getManifest(eid).catch(() => null),
      ]);
      setConstituencies(data);

      // Prefer the working draft; fall back to the published manifest.
      let manifestData = manifest?.draft as ManifestData | null;
      if (!manifestData?.live_tabs?.length) {
        manifestData = await resolvePublishedManifest(manifest?.manifest_url);
      }
      if (manifestData?.live_tabs?.length) {
        setTabs(manifestData.live_tabs);
      } else {
        setTabs(autoChunkTabs(data));
      }
    } catch (err) {
      if (!opts?.silent) toast('Failed to load live results', 'error');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedElectionId) loadResults(selectedElectionId);
  }, [selectedElectionId, loadResults]);

  // 3. Real-time Subscription (SSE)
  useEffect(() => {
    if (!selectedElectionId) return;
    esRef.current?.close();

    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    const flashTimers = new Set<ReturnType<typeof setTimeout>>();

    const flash = (constIds: string[]) => {
      if (constIds.length === 0) return;
      setFlashIds((prev) => {
        const next = new Set(prev);
        constIds.forEach((id) => next.add(id));
        return next;
      });
      const timer = setTimeout(() => {
        flashTimers.delete(timer);
        setFlashIds((prev) => {
          const next = new Set(prev);
          constIds.forEach((id) => next.delete(id));
          return next;
        });
      }, FLASH_MS);
      flashTimers.add(timer);
    };

    const scheduleReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        reloadTimer = null;
        loadResults(selectedElectionId, { silent: true });
      }, RELOAD_DEBOUNCE_MS);
    };

    const es = subscribeLiveUpdates(selectedElectionId, {
      onResultUpdate: (update) => {
        flash([update.const_id]);
        scheduleReload();
      },
      onBatchUpdate: (updates) => {
        if (updates.length === 0) return;
        flash(updates.map((u) => u.const_id));
        scheduleReload();
      },
    });

    esRef.current = es;
    return () => {
      es.close();
      if (reloadTimer) clearTimeout(reloadTimer);
      flashTimers.forEach(clearTimeout);
    };
  }, [selectedElectionId, loadResults]);

  // 4. Computed Stats & Views
  const stats = useMemo(() => {
    let won = 0, leading = 0, pending = 0;
    constituencies.forEach(c => {
      const leader = c.candidates[0];
      if (!leader) pending++;
      else if (leader.status === 'WON') won++;
      else if (leader.status === 'LEADING') leading++;
      else pending++;
    });
    return { won, leading, pending, total: constituencies.length };
  }, [constituencies]);

  const tabConstituencies = useMemo(() => {
    if (tabs.length === 0) return constituencies;
    const nos = new Set(tabs[activeTab]?.const_nos || []);
    return constituencies.filter(c => nos.has(c.const_no));
  }, [constituencies, tabs, activeTab]);

  // 5. Actions
  const handleOverride = async (payload: OverridePayload) => {
    setSaving(true);
    try {
      await overrideResult(payload);
      toast('Override applied successfully');
      setEditingResultId(null);
      loadResults(selectedElectionId);
      return true;
    } catch (err) {
      toastError(err, 'Failed to apply override');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    elections, states, selectedElectionId, setSelectedElectionId,
    constituencies: tabConstituencies, allConstituencies: constituencies,
    tabs, activeTab, setActiveTab,
    loading, saving, expandedId, setExpandedId,
    editingResultId, setEditingResultId,
    searchQuery, setSearchQuery, flashIds,
    stats, handleOverride, refresh: () => loadResults(selectedElectionId)
  };
}
