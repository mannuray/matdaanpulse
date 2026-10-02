import { ArrowRight } from 'lucide-react';
import { RecordCard } from '../../record/RecordCard';
import { RecordLink } from '../../record/RecordLink';
import { SearchInput } from '../../ui/Toolbar';
import { Button } from '../../ui/Button';
import { contestsLabel } from '../../../utils/person-format';
import { assetUrl } from '../../../utils/asset-url';
import type { Candidate, PersonWithStats } from '../../../types';

interface CandidateMasterCardProps {
  candidate: Candidate;
  /** Every action reloads the record, which would drop unsaved edits: they wait for Save or Cancel. */
  locked: boolean;
  busy: boolean;
  /** The Change person search is open. */
  changing: boolean;
  onToggleChange: (open: boolean) => void;
  personSearch: string;
  onPersonSearch: (q: string) => void;
  /** Search results, without the candidate's own person. */
  personResults: PersonWithStats[];
  /** A person was picked: the page asks to confirm, then moves the contest. */
  onPickPerson: (person: PersonWithStats) => void;
  onSplit: () => void;
  /** Other persons with the same name (one of them may be this politician). */
  duplicates: PersonWithStats[];
}

const contestCount = (n: number) => `${n} ${n === 1 ? 'contest' : 'contests'}`;

/**
 * Candidate record, right column: the person (master) record this contest belongs to. Every candidate has one
 * (migration 018), so the card always shows it, with "Open person", Change person (a person search, confirmed by
 * the page), Split into new person (not on the person's only contest, which the backend refuses), and same-name
 * persons as Possible duplicates, each opening that person's page, where merge lives.
 */
export function CandidateMasterCard(props: CandidateMasterCardProps) {
  const { candidate: c, locked, busy, changing } = props;
  const person = c.person;
  const contests = c.person_contests?.contests ?? null;
  // Unknown counts as the only contest: Split stays off rather than risk a 409.
  const soleContest = contests === null || contests <= 1;
  const disabled = locked || busy;
  return (
    <RecordCard title="Master record" subtitle="The politician's record across elections">
      <div className="space-y-3">
        {locked && <p className="text-xs text-warn-text">Save or cancel your changes first.</p>}
        <div className="rounded-card border border-line">
          <div className="flex items-center gap-3 p-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-sm font-semibold text-ink-2">
              {person?.photo_url ? <img src={assetUrl(person.photo_url)} alt="" className="h-full w-full object-cover" /> : (person?.name ?? c.name).charAt(0)}
            </span>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-ink">{person?.name ?? c.name}</div>
              {c.person_contests
                ? <div className="text-xs text-muted">{contestsLabel(c.person_contests.contests, c.person_contests.first_year)}</div>
                : <div className="font-mono text-[11px] text-muted">Master id {c.person_id.split('-')[0]}</div>}
            </div>
          </div>
          <div className="border-t border-line px-3.5 py-2.5">
            <RecordLink to={`/persons/${c.person_id}`} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
              Open person <ArrowRight size={12} aria-hidden />
            </RecordLink>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={disabled} aria-expanded={changing} onClick={() => props.onToggleChange(!changing)}>
            Change person
          </Button>
          <Button size="sm" variant="outline" disabled={disabled || soleContest} onClick={props.onSplit}>
            Split into new person
          </Button>
        </div>
        {soleContest && <p className="text-xs text-muted">This is the person&apos;s only contest, so there is nothing to split.</p>}

        {changing && (
          <div className="space-y-2 rounded-card border border-line p-3">
            <SearchInput label="Find a person" placeholder="Search persons…" value={props.personSearch} onChange={props.onPersonSearch} />
            {props.personResults.length > 0 && (
              <ul className="space-y-1.5">
                {props.personResults.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 rounded-control border border-line px-2.5 py-1.5">
                    <div className="min-w-0 text-xs">
                      <div className="truncate font-medium text-ink">{p.name}</div>
                      <div className="text-muted">{contestCount(p.candidate_count)}</div>
                    </div>
                    <Button size="sm" variant="outline" disabled={disabled} aria-label={`Move to ${p.name}`} onClick={() => props.onPickPerson(p)}>
                      Move here
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button size="sm" variant="ghost" onClick={() => props.onToggleChange(false)}>Close search</Button>
          </div>
        )}

        {props.duplicates.length > 0 && (
          <div className="space-y-2 rounded-card border border-warn/40 bg-warn-soft p-3">
            <div>
              <p className="text-xs font-medium text-ink-2">Possible duplicates</p>
              <p className="text-[11px] text-muted">Same name, separate person record. Open it to merge the two (super admin).</p>
            </div>
            <ul className="space-y-1">
              {props.duplicates.map((p) => (
                <li key={p.id}>
                  <RecordLink to={`/persons/${p.id}`} className="block rounded-control border border-line bg-card px-2.5 py-1.5 text-xs hover:border-accent/50">
                    <span className="block truncate font-medium text-ink">{p.name}</span>
                    <span className="block truncate text-muted">
                      {[contestCount(p.candidate_count), ...p.elections.slice(0, 2)].join(' · ')}
                    </span>
                  </RecordLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </RecordCard>
  );
}
