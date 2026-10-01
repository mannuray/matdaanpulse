import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useElection } from '../../../context/ElectionContext';
import { confirmDiscardEdits } from '../../../context/ShellStatusContext';
import { useCandidateEdit, candidateNumbersValid, type CandidateForm } from '../../../hooks/useCandidateEdit';
import { useUnsavedGuard } from '../../../hooks/useUnsavedGuard';
import type { LinkSuggestion } from '../../../hooks/useCandidateManager';
import { shortElectionName } from '../../shell/ElectionPicker';
import { Sheet } from '../../ui/Sheet';
import { FormSection } from '../../ui/Field';
import { SearchInput } from '../../ui/Toolbar';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { PanelFooter } from '../PanelFooter';
import { ElectionMismatch } from '../ElectionMismatch';
import { CandidateFields } from './CandidateFields';
import type { Candidate } from '../../../types';

interface CandidatePanelProps {
  id: string;
  /** Same-name candidates in other elections (from the page's list hook), if any. */
  suggestion?: LinkSuggestion;
  selectedMatches?: Set<string>;
  onToggleMatch: (candidateId: string, matchId: string) => void;
  onLinkSuggested: (candidateId: string, matches: Candidate[]) => Promise<boolean>;
  /** Each loaded record (the page syncs the Seat select to it). Must be stable (a state setter). */
  onLoaded: (c: Candidate) => void;
  /** Saved or linking changed: refresh the table. */
  onChanged: () => void;
  onClose: () => void;
}

/** Candidate record: affidavit form, read-only person photo, and person-record linking (suggestions live here). */
export function CandidatePanel({ id, suggestion, selectedMatches, onToggleMatch, onLinkSuggested, onLoaded, onChanged, onClose }: CandidatePanelProps) {
  const ed = useCandidateEdit(id);
  const { elections } = useElection();
  useUnsavedGuard(ed.dirty);
  const c = ed.candidate;
  useEffect(() => { if (c) onLoaded(c); }, [c, onLoaded]);

  const { form, setForm } = ed;
  const set = (patch: Partial<CandidateForm>) => setForm({ ...form, ...patch });
  const electionName = (eid: string) => {
    const e = elections.find((x) => x.id === eid);
    return e ? shortElectionName(e.name, e.type, e.year) : eid;
  };
  const seatLabel = c?.constituency ? `${c.constituency.const_no} ${c.constituency.name}` : c?.const_id;

  const save = async () => { if (await ed.handleSave()) onChanged(); };
  const linkTo = async (personId: string) => { await ed.linkToPerson(personId); onChanged(); };
  const createMaster = async () => { await ed.createMasterRecord(); onChanged(); };
  const unlink = async () => { await ed.unlink(); onChanged(); };
  const linkSuggested = async () => {
    if (c && suggestion && await onLinkSuggested(c.id, suggestion.matches)) await ed.refresh();
  };
  // Every linking action reloads the record, which would silently drop unsaved form edits.
  const linkLocked = ed.dirty;
  const retry = <Button variant="outline" size="sm" onClick={() => { void ed.refresh(); }}>Try again</Button>;

  return (
    <Sheet
      open
      onRequestClose={onClose}
      title={c?.name ?? 'Candidate'}
      description={c ? `${electionName(c.election_id)} · ${seatLabel}` : undefined}
      footer={c ? <PanelFooter dirty={ed.dirty} saving={ed.saving} canSave={!!form.name.trim() && candidateNumbersValid(form)} onCancel={ed.reset} onSave={save} /> : undefined}
    >
      {!c ? (
        ed.loading
          ? <p className="py-10 text-center text-sm text-muted">Loading candidate…</p>
          : ed.loadError === 'failed'
            ? <EmptyState title="Could not load candidate" description="Check the connection and try again." action={retry} />
            : <EmptyState title="Candidate not found" description="Close this panel to go back to the list." />
      ) : (
        <div className="space-y-5">
          {ed.loadError === 'failed' && (
            <EmptyState title="Could not reload candidate" description="The details below may be out of date." action={retry} />
          )}
          <ElectionMismatch recordElectionId={c.election_id} />

          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-subtle text-lg font-semibold text-ink-2">
              {c.person?.photo_url ? <img src={c.person.photo_url} alt="" className="h-full w-full object-cover" /> : c.name.charAt(0)}
            </span>
            <div className="space-y-1">
              {c.is_incumbent && <Badge tone="warn">Incumbent</Badge>}
              <p className="text-[11px] text-muted">The photo comes from the linked person record.</p>
            </div>
          </div>

          <CandidateFields form={form} onChange={set} parties={ed.parties} />

          <FormSection title="Person record">
            {linkLocked && <p className="text-xs text-warn-text">Save or cancel your changes first.</p>}
            {c.person ? (
              <div className="flex items-start justify-between gap-3 rounded-card border border-accent/20 bg-accent-soft/50 p-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{c.person.name}</div>
                  <Link
                    to={`/persons/${c.person.id}`}
                    // An in-app link: neither beforeunload nor the sidebar guard sees it, so ask here.
                    onClick={(e) => { if (!confirmDiscardEdits(ed.dirty)) e.preventDefault(); }}
                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    Open person <ExternalLink size={12} aria-hidden />
                  </Link>
                </div>
                <Button size="sm" variant="danger" disabled={linkLocked} onClick={unlink}>Unlink</Button>
              </div>
            ) : (
              <>
                {suggestion && (
                  <div className="space-y-2 rounded-card border border-line p-3">
                    <p className="text-xs font-medium text-ink-2">Same name in other elections</p>
                    <ul className="space-y-1">
                      {suggestion.matches.map((m) => (
                        <li key={m.id}>
                          <label className="flex items-center gap-2 text-xs text-ink">
                            <input type="checkbox" checked={selectedMatches?.has(m.id) ?? false} onChange={() => onToggleMatch(c.id, m.id)} />
                            {electionName(m.election_id)} · {m.const_id}{m.person_id ? ' · has a person record' : ''}
                          </label>
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" variant="primary" disabled={linkLocked} onClick={linkSuggested}>Link selected</Button>
                  </div>
                )}
                <SearchInput label="Find a person" placeholder="Search persons…" value={ed.personSearch} onChange={ed.setPersonSearch} />
                <ul className="space-y-1.5">
                  {ed.personResults.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-control border border-line px-2.5 py-1.5">
                      <div className="min-w-0 text-xs">
                        <div className="truncate font-medium text-ink">{p.name}</div>
                        <div className="text-muted">{p.candidate_count} contests</div>
                      </div>
                      <Button size="sm" variant="outline" disabled={ed.isLinking || linkLocked} aria-label={`Link to ${p.name}`} onClick={() => linkTo(p.id)}>Link</Button>
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" disabled={ed.isLinking || linkLocked} onClick={createMaster}>Create new person record</Button>
              </>
            )}
          </FormSection>
        </div>
      )}
    </Sheet>
  );
}
