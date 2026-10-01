import { useElection } from '../../context/ElectionContext';
import { shortElectionName } from '../shell/ElectionPicker';
import { Button } from '../ui/Button';

/** Deep link / ⌘K into a record of another election: say so, and offer to switch the global election. */
export function ElectionMismatch({ recordElectionId }: { recordElectionId: string }) {
  const { electionId, elections, setElectionId } = useElection();
  if (!recordElectionId || !electionId || recordElectionId === electionId) return null;
  const e = elections.find((x) => x.id === recordElectionId);
  const name = e ? shortElectionName(e.name, e.type, e.year) : 'another election';
  return (
    <div role="status" className="flex items-center justify-between gap-3 rounded-card border border-warn/40 bg-warn-soft px-3 py-2 text-xs text-warn-text">
      <span>This record is in {name}, not the election selected in the top bar.</span>
      <Button size="sm" variant="outline" onClick={() => setElectionId(recordElectionId)}>Switch election</Button>
    </div>
  );
}
