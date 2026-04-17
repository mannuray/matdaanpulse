import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  getElections, getManifest, getLiveResults, 
  overrideResult, subscribeLiveUpdates 
} from '../services/election.service';
import { getStates } from '../services/geo.service';
import { useToast } from '../context/ToastContext';
import type { Election, State, LiveConstituency, LiveCandidate, LiveTab, ManifestData } from '../types';

const TAB_SIZE = 15;

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
  const { toast } = useToast();
  
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
  const loadResults = useCallback(async (eid: string) => {
    if (!eid) return;
    setLoading(true);
    try {
      const [data, manifest] = await Promise.all([
        getLiveResults(eid),
        getManifest(eid).catch(() => null),
      ]);
      setConstituencies(data);

      const manifestData = manifest?.draft as ManifestData | null;
      if (manifestData?.live_tabs?.length) {
        setTabs(manifestData.live_tabs);
      } else {
        setTabs(autoChunkTabs(data));
      }
    } catch (err) {
      toast('Failed to load live results', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (selectedElectionId) loadResults(selectedElectionId);
  }, [selectedElectionId, loadResults]);

  // 3. Real-time Subscription (SSE)
  useEffect(() => {
    if (!selectedElectionId) return;
    esRef.current?.close();
    
    const es = subscribeLiveUpdates(selectedElectionId, (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'result-update' && payload.data?.const_id) {
          const constId = payload.data.const_id;
          setFlashIds((prev) => new Set(prev).add(constId));
          setTimeout(() => setFlashIds((prev) => {
            const next = new Set(prev);
            next.delete(constId);
            return next;
          }), 1500);
          loadResults(selectedElectionId);
        }
      } catch {}
    });
    
    esRef.current = es;
    return () => es.close();
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
  const handleOverride = async (payload: any) => {
    setSaving(true);
    try {
      await overrideResult(payload);
      toast('Override applied successfully');
      setEditingResultId(null);
      loadResults(selectedElectionId);
      return true;
    } catch (err) {
      toast('Failed to apply override', 'error');
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
