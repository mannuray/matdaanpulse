import { ManifestSection } from './ManifestSection';
import { ChipSelect } from './SharedControls';
import type { Alliance, Party } from '../../types';

export function TrackedEditor({
  tracked,
  trackedOptions,
  alliances,
  partyMap,
  onUpdate
}: {
  tracked: string[];
  trackedOptions: { id: string; name: string }[];
  alliances: Alliance[];
  partyMap: Map<string, Party>;
  onUpdate: (tracked: string[]) => void;
}) {
  const items = tracked || [];

  return (
    <ManifestSection title="Tracked" description="Alliances/parties shown in the main tally bar" count={items.length}>
      <ChipSelect
        selected={items}
        options={(trackedOptions || []).map(o => ({ value: o.id, label: o.name }))}
        onAdd={id => onUpdate([...items, id])}
        onRemove={id => onUpdate(items.filter(x => x !== id))}
        renderChip={id => {
          const alliance = (alliances || []).find(a => a && a.id === id);
          const party = partyMap.get(id);
          const label = alliance ? alliance.name : (party?.abbreviation || party?.name || id);
          const color = alliance?.color || party?.color;
          return (
            <span key={id} className="mf-chip" style={{ borderColor: color || '#cbd5e1' }}>
              {color && <span className="mf-chip-dot" style={{ background: color }} />}
              {label}
              <span className="mf-chip-x" onClick={() => onUpdate(items.filter(x => x !== id))}>&times;</span>
            </span>
          );
        }}
      />
    </ManifestSection>
  );
}
