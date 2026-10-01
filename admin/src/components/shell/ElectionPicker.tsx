import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { useElection } from '../../context/ElectionContext';
import { confirmDiscardEdits, useShellStatus } from '../../context/ShellStatusContext';

/** Short label for the top bar: "Bihar VS 2025". */
export function shortElectionName(name: string, type: string, year: number): string {
  const base = name.replace(/\b(Vidhan Sabha|Lok Sabha|Assembly|General)\b.*$/i, '').trim();
  // National Lok Sabha names reduce to nothing: "Lok Sabha 2029", not "…Election 2029 LS 2029".
  if (!base) return `Lok Sabha ${year}`;
  return `${base} ${type} ${year}`.trim();
}

export function ElectionPicker() {
  const { elections, electionId, setElectionId } = useElection();
  const { editorDirty } = useShellStatus();
  if (elections.length === 0) return null;
  // Controlled: declining the prompt simply leaves the current election selected.
  const change = (id: string) => { if (confirmDiscardEdits(editorDirty)) setElectionId(id); };
  return (
    <Select.Root value={electionId} onValueChange={change}>
      <Select.Trigger aria-label="Election" className="inline-flex h-8 items-center gap-2 rounded-full border border-line bg-subtle px-3 text-xs font-medium text-ink whitespace-nowrap hover:bg-line/50">
        <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
        <Select.Value />
        <Select.Icon><ChevronDown size={14} className="text-muted" /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content position="popper" sideOffset={6} className="z-50 max-h-80 overflow-hidden rounded-card border border-line bg-card shadow-lg">
          <Select.Viewport className="p-1">
            {elections.map((e) => (
              <Select.Item key={e.id} value={e.id} className="flex cursor-pointer items-center justify-between gap-6 rounded-control px-2.5 py-1.5 text-xs text-ink outline-none data-[highlighted]:bg-accent-soft">
                <Select.ItemText>{shortElectionName(e.name, e.type, e.year)}</Select.ItemText>
                <span className="flex items-center gap-2 text-muted">
                  {e.status === 'Live' && <span className="text-ok-text">Live</span>}
                  <Select.ItemIndicator><Check size={12} /></Select.ItemIndicator>
                </span>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
