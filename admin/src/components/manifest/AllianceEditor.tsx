import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, PartySearch, updateAt, removeAt } from './SharedControls';
import type { Alliance, Party } from '../../types';

export function AllianceEditor({
  alliances,
  contestingParties,
  partyMap,
  onUpdate
}: {
  alliances: Alliance[];
  contestingParties: Party[];
  partyMap: Map<string, Party>;
  onUpdate: (alliances: Alliance[]) => void;
}) {
  const items = alliances || [];

  return (
    <ManifestSection title="Alliances" description="Coalition groupings shown on the map and tally" count={items.length} defaultOpen>
      {items.length === 0 && <EmptyState text="No alliances configured" />}
      {items.map((a, i) => {
        if (!a) return null;
        return (
          <div 
            key={i} 
            className="mf-alliance-card" 
            style={{ 
              borderLeft: `3px solid ${a.color || 'var(--border)'}`, 
              padding: 'var(--space-2) var(--space-4)', 
              marginBottom: 'var(--space-2)',
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <div className="mf-alliance-top" style={{ gap: 'var(--space-2)' }}>
              <input type="color" className="mf-color-pick" style={{ width: 24, height: 24 }} value={a.color || '#666666'}
                onChange={e => onUpdate(updateAt(items, i, { color: e.target.value }))} />
              <input className="form-input mf-input-sm" style={{ width: 80 }} placeholder="ID (e.g. NDA)" value={a.id || ''}
                onChange={e => onUpdate(updateAt(items, i, { id: e.target.value }))} />
              <input className="form-input mf-input-sm" style={{ flex: 1 }} placeholder="Alliance Name" value={a.name || ''}
                onChange={e => onUpdate(updateAt(items, i, { name: e.target.value }))} />
              <button className="mf-remove-btn" 
                onClick={() => onUpdate(removeAt(items, i))} title="Remove alliance">&times;</button>
            </div>
            <div className="mf-alliance-parties" style={{ marginTop: 'var(--space-2)', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div className="mf-chips" style={{ flex: 1, gap: '4px' }}>
                {(a.parties || []).map((pid: string) => {
                  const p = partyMap.get(pid);
                  return (
                    <span key={pid} className="mf-chip" style={{ borderColor: p?.color || 'var(--border)' }}>
                      {p?.color && <span className="mf-chip-dot" style={{ background: p.color }} />}
                      {p?.abbreviation || p?.name || pid}
                      <span className="mf-chip-x" onClick={() => {
                        onUpdate(updateAt(items, i, { parties: (a.parties || []).filter((x: string) => x !== pid) }));
                      }}>&times;</span>
                    </span>
                  );
                })}
              </div>
              <PartySearch 
                parties={contestingParties || []} 
                onSelect={(p) => {
                  if (p && !(a.parties || []).includes(p.id)) {
                    onUpdate(updateAt(items, i, { parties: [...(a.parties || []), p.id] }));
                  }
                }} 
              />
            </div>
          </div>
        );
      })}
      <AddButton label="Add Alliance" onClick={() =>
        onUpdate([...items, { id: '', name: '', color: '#666666', parties: [] }])} />
    </ManifestSection>
  );
}
