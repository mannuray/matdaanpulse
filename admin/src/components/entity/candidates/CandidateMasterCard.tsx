import { ArrowRight } from 'lucide-react';
import { RecordCard } from '../../record/RecordCard';
import { RecordLink } from '../../record/RecordLink';
import { SearchInput } from '../../ui/Toolbar';
import { Button } from '../../ui/Button';
import type { LinkSuggestion } from '../../../hooks/useCandidateManager';
import type { Candidate, PersonWithStats } from '../../../types';

interface CandidateMasterCardProps {
  candidate: Candidate;
  /** Linking reloads the record, which would drop unsaved edits: every action waits for Save or Cancel. */
  locked: boolean;
  busy: boolean;
  suggestion?: LinkSuggestion;
  selectedMatches?: Set<string>;
  onToggleMatch: (matchId: string) => void;
  linkingSuggested: boolean;
  onLinkSuggested: () => void;
  personSearch: string;
  onPersonSearch: (q: string) => void;
  personResults: PersonWithStats[];
  onLinkTo: (personId: string) => void;
  onCreateMaster: () => void;
  onUnlink: () => void;
  /** Short election name for a suggested match. */
  electionName: (electionId: string) => string;
}

/**
 * Candidate record, right column: the person (master) record this contest belongs to. Linked: the person, "Open
 * person" and Unlink (which asks first). Unlinked: same-name suggestions from other elections, a person search
 * (pre-filled with the name), and "Create new person record".
 */
export function CandidateMasterCard(props: CandidateMasterCardProps) {
  const { candidate: c, locked, busy } = props;
  const person = c.person;
  return (
    <RecordCard title="Master record" subtitle="The politician's record across elections">
      <div className="space-y-3">
        {locked && <p className="text-xs text-warn-text">Save or cancel your changes first.</p>}
        {person ? (
          <div className="rounded-card border border-line">
            <div className="flex items-center gap-3 p-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-sm font-semibold text-ink-2">
                {person.photo_url ? <img src={person.photo_url} alt="" className="h-full w-full object-cover" /> : person.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{person.name}</div>
                <div className="font-mono text-[11px] text-muted">Master id {person.id.split('-')[0]}</div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line px-3.5 py-2.5">
              <RecordLink to={`/persons/${person.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                Open person <ArrowRight size={12} aria-hidden />
              </RecordLink>
              <Button size="sm" variant="outline" disabled={locked || busy} onClick={props.onUnlink}>Unlink</Button>
            </div>
          </div>
        ) : (
          <>
            {props.suggestion && (
              <div className="space-y-2 rounded-card border border-line p-3">
                <p className="text-xs font-medium text-ink-2">Same name in other elections</p>
                <ul className="space-y-1">
                  {props.suggestion.matches.map((m) => (
                    <li key={m.id}>
                      <label className="flex items-center gap-2 text-xs text-ink">
                        <input type="checkbox" checked={props.selectedMatches?.has(m.id) ?? false} onChange={() => props.onToggleMatch(m.id)} />
                        {props.electionName(m.election_id)} · {m.const_id}{m.person_id ? ' · has a person record' : ''}
                      </label>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="primary" disabled={locked || busy || !props.selectedMatches?.size} onClick={props.onLinkSuggested}>
                  {props.linkingSuggested ? 'Linking…' : 'Link selected'}
                </Button>
              </div>
            )}
            <SearchInput label="Find a person" placeholder="Search persons…" value={props.personSearch} onChange={props.onPersonSearch} />
            {props.personResults.length > 0 && (
              <ul className="space-y-1.5">
                {props.personResults.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-control border border-line px-2.5 py-1.5">
                    <div className="min-w-0 text-xs">
                      <div className="truncate font-medium text-ink">{p.name}</div>
                      <div className="text-muted">{p.candidate_count} contests</div>
                    </div>
                    <Button size="sm" variant="outline" disabled={busy || locked} aria-label={`Link to ${p.name}`} onClick={() => props.onLinkTo(p.id)}>Link</Button>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="outline" disabled={busy || locked} onClick={props.onCreateMaster}>Create new person record</Button>
          </>
        )}
        <p className="text-xs text-muted">Links this contest to the politician&apos;s record across elections.</p>
      </div>
    </RecordCard>
  );
}
