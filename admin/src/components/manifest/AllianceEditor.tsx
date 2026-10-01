import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, Chip, PartySearch, RemoveButton, updateAt, removeAt } from './SharedControls';
import { Input } from '../ui/Input';
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
    <ManifestSection title="Alliances" description="Coalition groupings shown on the map and tally" count={items.length}>
      {items.length === 0 && <EmptyState text="No alliances configured" />}
      {items.map((a, i) => {
        if (!a) return null;
        const n = i + 1;
        return (
          <div
            key={i}
            className="space-y-2 rounded-control border border-l-4 border-line bg-card p-3"
            style={a.color ? { borderLeftColor: a.color } : undefined}
          >
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`Alliance ${n} colour`}
                value={a.color || '#666666'}
                onChange={e => onUpdate(updateAt(items, i, { color: e.target.value }))}
                className="h-8 w-9 shrink-0 cursor-pointer rounded-control border border-line bg-card p-0.5"
              />
              <Input aria-label={`Alliance ${n} ID`} className="h-8 w-24 text-xs" placeholder="ID (e.g. NDA)" value={a.id || ''}
                onChange={e => onUpdate(updateAt(items, i, { id: e.target.value }))} />
              <Input aria-label={`Alliance ${n} name`} className="h-8 flex-1 text-xs" placeholder="Alliance name" value={a.name || ''}
                onChange={e => onUpdate(updateAt(items, i, { name: e.target.value }))} />
              <RemoveButton label={`Remove alliance ${a.name || n}`} onClick={() => onUpdate(removeAt(items, i))} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-1 flex-wrap gap-1">
                {(a.parties || []).map((pid: string) => {
                  const p = partyMap.get(pid);
                  const label = p?.abbreviation || p?.name || pid;
                  return (
                    <Chip
                      key={pid}
                      label={label}
                      color={p?.color}
                      removeLabel={`Remove ${label} from ${a.name || 'alliance'}`}
                      onRemove={() => onUpdate(updateAt(items, i, { parties: (a.parties || []).filter((x: string) => x !== pid) }))}
                    />
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
      <AddButton label="Add alliance" onClick={() =>
        onUpdate([...items, { id: '', name: '', color: '#666666', parties: [] }])} />
    </ManifestSection>
  );
}
