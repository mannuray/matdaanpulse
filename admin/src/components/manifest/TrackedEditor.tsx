import { ManifestSection } from './ManifestSection';
import { Chip, ChipSelect } from './SharedControls';
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
    <ManifestSection title="Tracked" description="Alliances and parties shown in the main tally bar" count={items.length}>
      <ChipSelect
        label="Add to the tally"
        selected={items}
        options={(trackedOptions || []).map(o => ({ value: o.id, label: o.name }))}
        onAdd={id => onUpdate([...items, id])}
        onRemove={id => onUpdate(items.filter(x => x !== id))}
        renderChip={id => {
          const alliance = (alliances || []).find(a => a && a.id === id);
          const party = partyMap.get(id);
          const label = alliance ? alliance.name : (party?.abbreviation || party?.name || id);
          return (
            <Chip
              key={id}
              label={label}
              color={alliance?.color || party?.color}
              onRemove={() => onUpdate(items.filter(x => x !== id))}
            />
          );
        }}
      />
    </ManifestSection>
  );
}
