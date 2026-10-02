import { useEffect, useId, useState } from 'react';
import { useElection } from '../../../context/ElectionContext';
import { useCandidateEdit, candidateNumbersValid, type CandidateEditForm } from '../../../hooks/useCandidateEdit';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import { useRecordQuery } from '../../../hooks/useRecordQuery';
import { getCandidateResult } from '../../../services/candidate.service';
import type { LinkSuggestion } from '../../../hooks/useCandidateManager';
import { shortElectionName } from '../../shell/ElectionPicker';
import { RecordPage } from '../../record/RecordPage';
import { RecordCard, RecordMeta } from '../../record/RecordCard';
import { RecordLoadError } from '../../record/RecordLoadError';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { cn } from '../../ui/cn';
import { ElectionMismatch } from '../ElectionMismatch';
import { CandidateAffidavitFields, CandidateIdentityFields } from './CandidateFields';
import { CandidateResultCard } from './CandidateResultCard';
import { CandidateSeatCard } from './CandidateSeatCard';
import { CandidateMasterCard } from './CandidateMasterCard';
import type { Candidate } from '../../../types';

interface CandidateRecordProps {
  id: string;
  /** Same-name candidates in other elections (from the page's list hook), if any. */
  suggestion?: LinkSuggestion;
  selectedMatches?: Set<string>;
  onToggleMatch: (candidateId: string, matchId: string) => void;
  onLinkSuggested: (candidateId: string, matches: Candidate[]) => Promise<boolean>;
  /** Each loaded record (the page shows its seat in the list). Must be stable (a state setter). */
  onLoaded: (c: Candidate) => void;
  /** Saved or linking changed: refresh the list. */
  onChanged: () => void;
  /** "← Candidates · <seat>": back to the list, through the unsaved guard. */
  onBack: () => void;
  /** Open another candidate of the seat, through the unsaved guard. */
  onOpenCandidate: (id: string) => void;
}

/** The Incumbent toggle: a switch, so it reads as on / off rather than a checkbox in a form row. */
function IncumbentSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const labelId = useId();
  return (
    <label className="flex h-9 min-w-[220px] cursor-pointer items-center justify-between gap-3 rounded-control border border-line px-3 text-sm text-ink">
      <span id={labelId}>Incumbent candidate</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        onClick={() => onChange(!checked)}
        className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line-strong')}
      >
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all', checked ? 'left-[18px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

/**
 * Candidate record page at /candidates/:id: Candidate, Affidavit and the read-only Result on the left; the master
 * (person) record, the other candidates of the seat and record info on the right. The page keys it by id.
 */
export function CandidateRecord({ id, suggestion, selectedMatches, onToggleMatch, onLinkSuggested, onLoaded, onChanged, onBack, onOpenCandidate }: CandidateRecordProps) {
  const ed = useCandidateEdit(id);
  const { elections } = useElection();
  useUnsavedGuard(ed.dirty);
  const result = useRecordQuery(getCandidateResult, id);
  const c = ed.candidate;
  useEffect(() => { if (c) onLoaded(c); }, [c, onLoaded]);

  const { form, setForm } = ed;
  const set = (patch: Partial<CandidateEditForm>) => setForm({ ...form, ...patch });
  const electionName = (eid: string) => {
    const e = elections.find((x) => x.id === eid);
    return e ? shortElectionName(e.name, e.type, e.year) : eid;
  };
  const seatName = c?.constituency?.name ?? c?.const_id ?? '';
  const seatLabel = c?.constituency ? `${c.constituency.const_no} ${c.constituency.name}` : seatName;
  // The header shows the saved party; the list of parties has its colour even when the relation is missing.
  const party = c ? ed.parties.find((p) => p.id === c.party_id) ?? c.party : null;

  const save = async () => { if (await ed.handleSave()) onChanged(); };
  // The list refreshes only when a linking action actually changed something (not on cancel / failure).
  const linkTo = async (personId: string) => { if (await ed.linkToPerson(personId)) onChanged(); };
  const createMaster = async () => { if (await ed.createMasterRecord()) onChanged(); };
  const unlink = async () => { if (await ed.unlink()) onChanged(); };
  // Busy while "Link selected" runs, so a double click cannot create two person records.
  const [linkingSuggested, setLinkingSuggested] = useState(false);
  const linkSuggested = async () => {
    if (!c || !suggestion || linkingSuggested) return;
    setLinkingSuggested(true);
    try {
      if (await onLinkSuggested(c.id, suggestion.matches)) await ed.refresh();
    } finally {
      setLinkingSuggested(false);
    }
  };

  const error = !c && ed.loadError
    ? <RecordLoadError kind={ed.loadError} noun="candidate" onRetry={() => { void ed.refresh(); }} />
    : null;

  return (
    <RecordPage
      backLabel={seatLabel ? `Candidates · ${seatLabel}` : 'Candidates'}
      onBack={onBack}
      loading={!c && !error}
      error={error}
      leading={
        <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-lg font-semibold text-ink-2">
          {c?.person?.photo_url ? <img src={c.person.photo_url} alt="" className="h-full w-full object-cover" /> : c?.name.charAt(0)}
        </span>
      }
      title={c?.name}
      tags={c && (
        <>
          <Badge tone="muted" title={party?.name}>
            <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: party?.color || 'var(--color-muted)' }} />
            {party?.abbreviation || c.party_id || 'IND'}
          </Badge>
          {c.is_incumbent && <Badge tone="accent">Incumbent</Badge>}
        </>
      )}
      meta={c && `${electionName(c.election_id)} · ${seatLabel}`}
      dirty={ed.dirty}
      saving={ed.saving}
      canSave={!!form.name.trim() && candidateNumbersValid(form)}
      onCancel={ed.reset}
      onSave={save}
      main={c && (
        <>
          {ed.loadError === 'failed' && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-card border border-bad/40 bg-bad-soft p-4 text-sm text-bad-text">
              <div>
                <div className="font-medium">Could not reload candidate</div>
                <div className="text-xs">The details below may be out of date.</div>
              </div>
              {/* A reload would overwrite unsaved edits. */}
              <Button variant="outline" size="sm" disabled={ed.dirty} onClick={() => { void ed.refresh(); }}>Try again</Button>
            </div>
          )}
          <ElectionMismatch recordElectionId={c.election_id} />
          <RecordCard title="Candidate" subtitle="Nomination name and party">
            <CandidateIdentityFields
              form={form}
              onChange={set}
              parties={ed.parties}
              errors={ed.fieldErrors}
              besideParty={<IncumbentSwitch checked={form.is_incumbent} onChange={(is_incumbent) => set({ is_incumbent })} />}
            />
          </RecordCard>
          <RecordCard title="Affidavit" subtitle="Declared in the nomination affidavit">
            <CandidateAffidavitFields form={form} onChange={set} errors={ed.fieldErrors} />
          </RecordCard>
          <CandidateResultCard result={result.data} loading={result.loading} failed={result.failed} onRetry={result.retry} />
        </>
      )}
      aside={c && (
        <>
          <CandidateMasterCard
            candidate={c}
            locked={ed.dirty}
            busy={ed.isLinking || linkingSuggested}
            suggestion={suggestion}
            selectedMatches={selectedMatches}
            onToggleMatch={(matchId) => onToggleMatch(c.id, matchId)}
            linkingSuggested={linkingSuggested}
            onLinkSuggested={() => { void linkSuggested(); }}
            personSearch={ed.personSearch}
            onPersonSearch={ed.setPersonSearch}
            personResults={ed.personResults}
            onLinkTo={(personId) => { void linkTo(personId); }}
            onCreateMaster={() => { void createMaster(); }}
            onUnlink={() => { void unlink(); }}
            electionName={electionName}
          />
          <CandidateSeatCard
            candidateId={c.id}
            seatLabel={seatLabel}
            seatName={seatName}
            result={result.data}
            loading={result.loading}
            failed={result.failed}
            onRetry={result.retry}
            onOpen={onOpenCandidate}
          />
          <RecordCard title="Record">
            <RecordMeta id={id} updatedAt={c.updated_at} lastEdit={c.last_edit} />
          </RecordCard>
        </>
      )}
    />
  );
}
