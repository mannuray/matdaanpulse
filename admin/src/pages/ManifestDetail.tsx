import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useManifestEditor } from '../hooks/useManifestEditor';
import ElectionPicker from '../components/ElectionPicker';
import AdminLandingCard from '../components/common/AdminLandingCard';
import AdminPageHeader from '../components/common/AdminPageHeader';
import Spinner from '../components/atoms/Spinner';
import type { Election, ManifestData, Party, Alliance } from '../types';

/**
 * PAGE: Manifest Detail (MVC: View)
 * Advanced explorer for election configuration metadata.
 */
export default function ManifestDetail() {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const canWrite = hasRole('SUPER_ADMIN', 'EDITOR');
  const controller = useManifestEditor();

  const { 
    selectedId, setSelectedId, manifest, loading, isDraft,
    partyMap, electionMap
  } = controller;

  // ── SELECTION VIEW ──
  if (!selectedId) {
    return (
      <AdminLandingCard
        title="Manifest Explorer"
        subtitle="System Configuration Engine"
        description="Select an election cycle to view and verify its technical manifest, alliances, and tracked metadata."
        icon="📜"
        selectedId={selectedId}
        onSelectionChange={setSelectedId}
      />
    );
  }

  const election = electionMap.get(selectedId);

  return (
    <div className="fade-in" style={styles.pageRoot}>
      <AdminPageHeader 
        title={election?.name || 'Loading...'}
        breadcrumb="Manifest Summary"
        onBack={() => setSelectedId('')}
        backLabel="INDEX"
        badge={isDraft ? <span className="badge badge-upcoming" style={{ fontSize: '10px' }}>DRAFT VERSION</span> : undefined}
        actions={
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 240 }}>
              <ElectionPicker value={selectedId} onChange={setSelectedId} />
            </div>
            {canWrite && (
              <button onClick={() => navigate(`/manifests/${selectedId}/edit`)} className="btn btn-primary" style={styles.editBtn}>
                EDIT SOURCE CONFIG
              </button>
            )}
          </div>
        }
      />

      <div style={styles.mainContainer}>
        {loading ? (
          <Spinner label="Hydrating manifest schema..." />
        ) : (
          <div style={styles.dashboardGrid}>
            
            {/* Left Column: Core Setup */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              {/* Stats Overview */}
              <div style={styles.statsRow}>
                <ManifestStat label="Alliances" value={manifest.alliances?.length || 0} />
                <ManifestStat label="Watchlists" value={manifest.watchlists?.length || 0} />
                <ManifestStat label="Tracked" value={manifest.tracked?.length || 0} />
                <ManifestStat label="Milestones" value={manifest.milestones?.length || 0} />
              </div>

              {/* Alliances Card */}
              <div className="card-elevated" style={styles.cardPadding}>
                <h3 className="card-title-tiny">Political Alliances</h3>
                <div style={styles.allianceList}>
                  {manifest.alliances?.map(a => (
                    <div key={a.id} style={styles.allianceRow}>
                      <div style={{ ...styles.allianceColor, background: a.color }} />
                      <div style={{ flex: 1 }}>
                        <div style={styles.allianceName}>{a.name}</div>
                        <div style={styles.allianceParties}>
                          {a.parties.map(pId => (
                            <span key={pId} style={styles.partyChip}>
                              <span style={{ ...styles.partyDot, background: partyMap.get(pId)?.color || '#cbd5e1' }} />
                              {pId}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!manifest.alliances || manifest.alliances.length === 0) && (
                    <div style={styles.emptyText}>No alliances configured.</div>
                  )}
                </div>
              </div>

              {/* Vote Splits */}
              <div className="card-elevated" style={styles.cardPadding}>
                <h3 className="card-title-tiny">Vote Split Intelligence</h3>
                <div style={{ display: 'grid', gap: 12 }}>
                  {manifest.vote_splits?.map((vs, i) => (
                    <div key={i} style={styles.vsRow}>
                      <div style={styles.vsSpoiler}>{vs.spoiler}</div>
                      <div style={styles.vsLabel}>HURTS</div>
                      <div style={styles.vsTarget}>{vs.hurts}</div>
                      <div style={styles.vsTag}>{vs.label}</div>
                    </div>
                  ))}
                  {(!manifest.vote_splits || manifest.vote_splits.length === 0) && (
                    <div style={styles.emptyText}>No split analysis configured.</div>
                  )}
                </div>
              </div>

              {/* History Context */}
              <div className="card-elevated" style={styles.cardPadding}>
                <h3 className="card-title-tiny">Comparison History Context</h3>
                <div style={styles.historyList}>
                  {manifest.history?.map((histId, i) => {
                    const histEl = electionMap.get(histId);
                    const year = manifest.history_years?.[i];
                    return (
                      <div key={histId} style={styles.historyItem}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={styles.historyYearBadge}>{year || histEl?.year || '??'}</span>
                          <div>
                            <div style={styles.historyName}>{histEl?.name || histId}</div>
                            <div style={styles.historyMetaText}>{histEl?.type} &middot; {histId.split('-')[0]}</div>
                          </div>
                        </div>
                        {i === 0 && <span className="badge badge-editor" style={{ fontSize: '8px' }}>BASELINE</span>}
                      </div>
                    );
                  })}
                  {(!manifest.history || manifest.history.length === 0) && (
                    <div style={styles.emptyText}>No historical elections configured for comparison.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Features */}
            <aside style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              
              <div className="card-elevated" style={styles.cardPadding}>
                <h3 className="card-title-tiny">Dashboard Watchlists</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {manifest.watchlists?.map(w => (
                    <div key={w.id} style={styles.watchlistGroup}>
                      <div style={styles.watchlistTitle}>{w.name}</div>
                      <div style={styles.watchlistEntries}>
                        {w.entries.map((e, i) => (
                          <div key={i} style={styles.entryRow}>
                            <div style={{ ...styles.partyDotSmall, background: partyMap.get(e.party_id)?.color || '#cbd5e1' }} />
                            <div style={{ flex: 1 }}>
                              <div style={styles.entryName}>{e.name}</div>
                              <div style={styles.entryMeta}>{e.role ? `${e.role} · ` : ''}{e.party_id} · {e.const_id}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(!manifest.watchlists || manifest.watchlists.length === 0) && (
                    <div style={styles.emptyText}>No watchlists defined.</div>
                  )}
                </div>
              </div>

              {/* Geo Configuration */}
              <div className="card-elevated" style={styles.cardPadding}>
                <h3 className="card-title-tiny">Geographical Engine</h3>
                {manifest.geo?.map_url && (
                  <div style={styles.mapPreviewBox}>
                    <div style={styles.mapOverlay}>
                      <span style={{ fontSize: '10px', fontWeight: 800 }}>LIVE MAP SOURCE</span>
                    </div>
                    <img 
                      src={manifest.geo.map_url.replace('.json', '.svg')}
                      alt="Map Preview"
                      style={styles.mapImg}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent && !parent.querySelector('.map-fallback')) {
                          const div = document.createElement('div');
                          div.className = 'map-fallback';
                          div.innerHTML = '<span style="font-size: 40px; opacity: 0.2">🗺️</span>';
                          parent.appendChild(div);
                        }
                      }}
                    />
                  </div>
                )}
                <div style={styles.infoList}>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>DATA ENDPOINT</span>
                    <span style={{...styles.infoValue, fontSize: '10px', color: 'var(--accent)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {manifest.geo?.map_url || 'DEFAULT'}
                    </span>
                  </div>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>CENTER</span>
                    <span style={styles.infoValue}>{manifest.geo?.center ? `${manifest.geo.center[0]}, ${manifest.geo.center[1]}` : 'AUTO'}</span>
                  </div>
                  <div style={styles.infoItem}>
                    <span style={styles.infoLabel}>ZOOM</span>
                    <span style={styles.infoValue}>{manifest.geo?.zoom || 'AUTO'}</span>
                  </div>
                </div>
              </div>

              {/* Majority Milestones */}
              <div className="card-elevated" style={styles.cardPadding}>
                <h3 className="card-title-tiny">Majority Milestones</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {manifest.milestones?.map((m, i) => (
                    <div key={i} style={styles.milestoneBox}>
                      <span style={styles.milestoneLabel}>{m.label}</span>
                      <span style={styles.milestoneValue}>{m.value}</span>
                    </div>
                  ))}
                </div>
              </div>

            </aside>
          </div>
        )}
      </div>
    </div>
  );
}

function ManifestStat({ label, value }: { label: string, value: number }) {
  return (
    <div className="card-elevated" style={styles.statCard}>
      <div style={styles.statLabel}>{label}</div>
      <div style={styles.statValue}>{value}</div>
    </div>
  );
}

const styles = {
  pageRoot: { background: 'var(--bg-secondary)', minHeight: '100vh', paddingBottom: 100 },
  editBtn: { height: 34, padding: '0 24px', fontSize: '11px', fontWeight: 800 },
  mainContainer: { maxWidth: '1400px', margin: 'var(--space-6) auto 0', padding: '0 var(--space-6)' },
  cardPadding: { padding: 'var(--space-6)' },
  dashboardGrid: { display: 'grid', gridTemplateColumns: '1fr 420px', gap: 'var(--space-6)', alignItems: 'start' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  statCard: { padding: '16px 20px', background: 'var(--bg-card)', borderLeft: '4px solid var(--accent)' },
  statLabel: { fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' as const, marginBottom: 4 },
  statValue: { fontSize: '24px', fontWeight: 900, color: 'var(--text-primary)' },
  allianceList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  allianceRow: { display: 'flex', gap: 16, alignItems: 'center', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius)', position: 'relative' as const },
  allianceColor: { position: 'absolute' as const, left: 0, top: 10, bottom: 10, width: 4, borderRadius: '0 4px 4px 0' },
  allianceName: { fontSize: '14px', fontWeight: 800, marginBottom: 6 },
  allianceParties: { display: 'flex', flexWrap: 'wrap' as const, gap: 6 },
  partyChip: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: '10px', fontWeight: 700 },
  partyDot: { width: 6, height: 6, borderRadius: '50%' },
  vsRow: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-secondary)', padding: '8px 16px', borderRadius: 'var(--radius-sm)' },
  vsSpoiler: { fontSize: '12px', fontWeight: 800, color: 'var(--danger)' },
  vsLabel: { fontSize: '9px', fontWeight: 900, color: 'var(--text-muted)' },
  vsTarget: { fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' },
  vsTag: { marginLeft: 'auto', fontSize: '10px', fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-soft)', padding: '2px 8px', borderRadius: 4 },
  historyList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  historyItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '10px 16px', borderRadius: 'var(--radius-sm)' },
  historyYearBadge: { width: 36, height: 36, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 900, color: 'var(--text-muted)' },
  historyName: { fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' },
  historyMetaText: { fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' as const },
  milestoneBox: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottom: '1px solid var(--bg-secondary)' },
  milestoneLabel: { fontSize: '12px', fontWeight: 700 },
  milestoneValue: { fontSize: '14px', fontWeight: 900, color: 'var(--accent)' },
  watchlistGroup: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  watchlistTitle: { fontSize: '11px', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase' as const, borderBottom: '1px solid var(--accent-soft)', paddingBottom: 4 },
  watchlistEntries: { display: 'grid', gap: 12 },
  entryRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  partyDotSmall: { width: 8, height: 8, borderRadius: '50%', marginTop: 5 },
  entryName: { fontSize: '13px', fontWeight: 800 },
  entryMeta: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700 },
  mapPreviewBox: { width: '100%', height: '160px', background: 'var(--bg-sidebar)', borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative' as const, marginBottom: 16, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mapOverlay: { position: 'absolute' as const, top: 12, left: 12, background: 'rgba(255,255,255,0.9)', padding: '2px 8px', borderRadius: 4, zIndex: 1, boxShadow: 'var(--shadow-sm)' },
  mapImg: { width: '100%', height: '100%', objectFit: 'contain' as const, padding: '12px' },
  infoList: { display: 'flex', flexDirection: 'column' as const, gap: 12 },
  infoItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--bg-secondary)', paddingBottom: 8 },
  infoLabel: { fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)' },
  infoValue: { fontSize: '12px', fontWeight: 800, color: 'var(--text-primary)' },
  emptyText: { fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' as const },
};
