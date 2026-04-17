import { useState, useEffect } from 'react';
import { useManifestEditor } from '../hooks/useManifestEditor';
import { useToast } from '../context/ToastContext';
import ElectionPicker from '../components/ElectionPicker';
import AdminPageHeader from '../components/common/AdminPageHeader';
import ErrorBoundary from '../components/atoms/ErrorBoundary';
import { AllianceEditor } from '../components/manifest/AllianceEditor';
import { WatchlistEditor } from '../components/manifest/WatchlistEditor';
import { TrackedEditor } from '../components/manifest/TrackedEditor';
import { 
  MilestonesEditor, 
  CompareHistoryEditor, 
  VoteSplitsEditor, 
  GeoConfigEditor, 
  LiveTabsEditor, 
  RevisionEditor 
} from '../components/manifest/MiscEditors';
import { searchCandidates } from '../services/candidate.service';
import type { ManifestData } from '../types';

type EditorTab = 'form' | 'json';

/**
 * PAGE: Manifest Editor (MVC: View)
 * Integrated dashboard for managing election metadata.
 */
export default function ManifestEditor() {
  const { toast } = useToast();
  const controller = useManifestEditor();
  const { 
    selectedId, setSelectedId, manifest, setFullManifest, 
    saveDraft, publish, loading, saving, isDraft,
    constituencies, contestingParties, 
    partyMap, elections, trackedOptions, electionMap
  } = controller;

  const [activeTab, setActiveTab] = useState<EditorTab>('form');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');

  // Synchronize JSON tab with form state
  useEffect(() => {
    if (activeTab === 'json') {
      setJsonText(JSON.stringify(manifest, null, 2));
    }
  }, [manifest, activeTab]);

  const handleSwitchTab = (tab: EditorTab) => {
    if (tab === 'form' && activeTab === 'json') {
      try {
        const parsed = JSON.parse(jsonText);
        setFullManifest(parsed);
        setJsonError('');
      } catch (e) {
        toast('Fix JSON errors before switching back', 'error');
        return;
      }
    }
    setActiveTab(tab);
  };

  const handleSave = async () => {
    let data = manifest;
    if (activeTab === 'json') {
      try {
        data = JSON.parse(jsonText);
      } catch (e) {
        toast('Invalid JSON format', 'error');
        return;
      }
    }
    await saveDraft(data);
  };

  if (!selectedId) {
    return (
      <div style={{ padding: 'var(--space-8) var(--space-6)' }}>
        <div className="page-header">
          <h1 className="page-title">Manifest Editor</h1>
        </div>
        <div className="card-elevated" style={{ padding: '80px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📜</div>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Election Manifest</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: 24 }}>Select an election to manage its configuration.</p>
          <div style={{ maxWidth: 300, margin: '0 auto' }}>
            <ElectionPicker value={selectedId} onChange={setSelectedId} />
          </div>
        </div>
      </div>
    );
  }

  const election = electionMap.get(selectedId);

  return (
    <div className="fade-in" style={{ background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: '100px' }}>
      <AdminPageHeader 
        title={election?.name || 'Manifest Editor'}
        breadcrumb="Configuration Workspace"
        onBack={() => setSelectedId('')}
        backLabel="INDEX"
        badge={isDraft ? <span className="badge badge-upcoming" style={{ fontSize: '10px' }}>DRAFT SOURCE</span> : undefined}
        actions={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="map-tabs" style={styles.tabsRoot}>
              <button className={`map-tab ${activeTab === 'form' ? 'active' : ''}`} onClick={() => handleSwitchTab('form')} style={styles.tabBtn}>VISUAL</button>
              <button className={`map-tab ${activeTab === 'json' ? 'active' : ''}`} onClick={() => handleSwitchTab('json')} style={styles.tabBtn}>JSON</button>
            </div>
            <div style={styles.vDivider} />
            <button onClick={handleSave} disabled={saving || (activeTab === 'json' && !!jsonError)} className="btn btn-outline" style={styles.actionBtn}>
              {saving ? 'SAVING...' : 'SAVE DRAFT'}
            </button>
            <button onClick={publish} disabled={saving} className="btn btn-primary" style={styles.actionBtn}>
              PUBLISH LIVE
            </button>
          </div>
        }
      />

      <div className="page-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: 'var(--space-6)' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><span className="spinner" /></div>
        ) : (
          <>
            {activeTab === 'form' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <ErrorBoundary>
                  <AllianceEditor 
                    alliances={manifest.alliances || []} 
                    contestingParties={contestingParties} 
                    partyMap={partyMap}
                    onUpdate={(val) => controller.updateManifest('alliances', val)} 
                  />
                </ErrorBoundary>
                
                <ErrorBoundary>
                  <TrackedEditor 
                    tracked={manifest.tracked || []} 
                    trackedOptions={trackedOptions}
                    alliances={manifest.alliances || []}
                    partyMap={partyMap}
                    onUpdate={(val) => controller.updateManifest('tracked', val)} 
                  />
                </ErrorBoundary>

                <ErrorBoundary>
                  <WatchlistEditor 
                    watchlists={manifest.watchlists || []}
                    contestingParties={contestingParties}
                    constituencies={constituencies}
                    partyMap={partyMap}
                    onUpdate={(val) => controller.updateManifest('watchlists', val)}
                    onSearchCandidates={searchCandidates}
                  />
                </ErrorBoundary>

                <ErrorBoundary>
                  <MilestonesEditor 
                    milestones={manifest.milestones || []} 
                    onUpdate={(val) => controller.updateManifest('milestones', val)} 
                  />
                </ErrorBoundary>

                <ErrorBoundary>
                  <CompareHistoryEditor 
                    compareWith={manifest.compare_with || []}
                    history={manifest.history || []}
                    historyYears={manifest.history_years || []}
                    elections={elections}
                    electionMap={electionMap}
                    onUpdateCompare={(val) => controller.updateManifest('compare_with', val)}
                    onUpdateHistory={(val) => controller.updateManifest('history', val)}
                    onUpdateHistoryYears={(val) => controller.updateManifest('history_years', val)}
                  />
                </ErrorBoundary>

                <ErrorBoundary>
                  <VoteSplitsEditor 
                    voteSplits={manifest.vote_splits || []}
                    contestingParties={contestingParties}
                    alliances={manifest.alliances || []}
                    partyMap={partyMap}
                    onUpdate={(val) => controller.updateManifest('vote_splits', val)}
                  />
                </ErrorBoundary>

                <ErrorBoundary>
                  <GeoConfigEditor 
                    geo={manifest.geo} 
                    onUpdate={(val) => controller.updateManifest('geo', val)} 
                  />
                </ErrorBoundary>

                <ErrorBoundary>
                  <LiveTabsEditor 
                    liveTabs={manifest.live_tabs || []} 
                    onUpdate={(val) => controller.updateManifest('live_tabs', val)} 
                  />
                </ErrorBoundary>

                <ErrorBoundary>
                  <RevisionEditor 
                    revision={manifest.revision} 
                    constituencies={constituencies} 
                  />
                </ErrorBoundary>
              </div>
            ) : (
              <div className="card-elevated" style={{ height: 'calc(100vh - 220px)', display: 'flex', flexDirection: 'column' }}>
                {jsonError && <div style={styles.jsonError}>{jsonError}</div>}
                <textarea
                  className="mf-json-editor"
                  style={styles.jsonTextarea}
                  value={jsonText}
                  onChange={(e) => {
                    setJsonText(e.target.value);
                    try { JSON.parse(e.target.value); setJsonError(''); } catch (err) {
                      setJsonError(err instanceof Error ? err.message : 'Invalid JSON');
                    }
                  }}
                  spellCheck={false}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  actionBtn: { height: '34px', fontSize: '11px', fontWeight: 700 },
  vDivider: { width: '1px', height: '20px', background: 'var(--border)', margin: '0 4px' },
  tabsRoot: { background: 'var(--bg-secondary)', padding: '2px', borderRadius: 'var(--radius-sm)' },
  tabBtn: { fontSize: '10px', fontWeight: 800, padding: '4px 16px' },
  jsonError: { 
    color: 'var(--danger)', fontSize: '11px', padding: '8px 16px', 
    background: 'var(--danger-soft)', borderBottom: '1px solid var(--border)' 
  },
  jsonTextarea: { 
    flex: 1, width: '100%', fontFamily: 'var(--font-mono)', fontSize: '13px', 
    padding: '24px', border: 'none', background: 'var(--bg-card)', 
    color: 'var(--text-primary)', resize: 'none' as const 
  },
};
