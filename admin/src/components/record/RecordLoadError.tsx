import { Button } from '../ui/Button';
import type { RecordLoadErrorKind } from '../../hooks/useRecordQuery';

interface RecordLoadErrorProps {
  kind: RecordLoadErrorKind;
  /** Lower case, e.g. "party": "Party not found" / "Could not load party". */
  noun: string;
  onRetry: () => void;
}

/** The `error` of a RecordPage whose record did not load: "not found" (no retry), or a failure with Try again. */
export function RecordLoadError({ kind, noun, onRetry }: RecordLoadErrorProps) {
  const title = kind === 'not_found' ? `${noun.charAt(0).toUpperCase()}${noun.slice(1)} not found` : `Could not load ${noun}`;
  const hint = kind === 'not_found' ? 'It may have been removed. Go back to the list.' : 'Check the connection and try again.';
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-xs">{hint}</div>
      </div>
      {kind === 'failed' && <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
