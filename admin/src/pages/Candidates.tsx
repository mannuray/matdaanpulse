import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useElection } from '../context/ElectionContext';
import { useUnsavedEdits } from '../context/UnsavedEditsContext';
import { useCandidateManager, type NewCandidate } from '../hooks/useCandidateManager';
import { NEW_ID, useEntityRoute } from '../hooks/useEntityRoute';
import { shortElectionName } from '../components/shell/ElectionPicker';
import { EntityPage } from '../components/entity/EntityPage';
import { NoElection } from '../components/entity/NoElection';
import { CandidateRecord } from '../components/entity/candidates/CandidateRecord';
import { ARCHIVED_HINT, CandidateCreateArchived, CandidateCreateDialog } from '../components/entity/candidates/CandidateCreateDialog';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Combobox } from '../components/ui/Combobox';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import type { Candidate } from '../types';

/**
 * PAGE: Candidates — one seat of the global election at a time, full width; a row opens the candidate's record page at
 * /candidates/:id, which replaces the list (create at /candidates/new, in a dialog over the list). The list hooks stay
 * mounted under `candidates/*`, so the seat and search survive the round trip to a record.
 * `?seat=<constituency id>` picks the seat (the constituency record's "Candidates in this seat"); it is used once and then
 * dropped from the URL (replace), so a reload or a copied link never brings back a seat the user has since moved off.
 */
export default function Candidates() {
  const { electionId, election, loading: electionsLoading, error } = useElection();
  const { editorDirty } = useUnsavedEdits();
  const route = useEntityRoute('/candidates', editorDirty);
  const [params, setParams] = useSearchParams();
  const seatParam = params.get('seat');
  const m = useCandidateManager(electionId, seatParam ?? '');
  useEffect(() => {
    if (!seatParam) return;
    if (seatParam !== m.selectedConst) m.setSelectedConst(seatParam);
    setParams((prev) => { const next = new URLSearchParams(prev); next.delete('seat'); return next; }, { replace: true });
  }, [seatParam]);
  const [opened, setOpened] = useState<Candidate | null>(null);

  // Deep link / ⌘K: show the opened candidate's seat — only when the record (or election) changes,
  // so picking another seat afterwards is not undone.
  // Only the record that is open counts: a closed record must not move the seat on a later election switch.
  const current = opened && opened.id === route.id ? opened : null;
  useEffect(() => {
    if (current && current.election_id === electionId && current.const_id !== m.selectedConst) m.setSelectedConst(current.const_id);
  }, [current?.id, electionId]);

  const seatOptions = useMemo(
    () => m.constituencies.map((c) => ({ value: c.id, label: `${c.const_no} ${c.name}`, hint: c.type })),
    [m.constituencies],
  );
  const seat = m.constituencies.find((c) => c.id === m.selectedConst);
  // The backend refuses new candidates in a Finalized election (409), so the page does not offer it.
  const archived = election?.status === 'Finalized';

  // New candidate: show its seat (switching the Seat select reloads that seat; same seat → refresh), then open it.
  const create = async (data: NewCandidate) => {
    const created = await m.handleCreate(data);
    if (!created) return;
    if (created.const_id !== m.selectedConst) m.setSelectedConst(created.const_id); else void m.refresh();
    route.open(created.id, { force: true });
  };

  if (!electionId) {
    return (
      <EntityPage
        header={<PageHeader title="Candidates" />}
        table={electionsLoading ? <p className="p-10 text-center text-sm text-muted">Loading elections…</p> : <NoElection error={error} />}
      />
    );
  }

  if (route.id && !route.isNew) {
    return (
      <CandidateRecord
        key={route.id}
        id={route.id}
        onLoaded={setOpened}
        onChanged={m.refresh}
        onBack={() => route.close()}
        onOpenCandidate={(cid) => route.open(cid)}
      />
    );
  }

  const columns: Column<Candidate>[] = [
    {
      key: 'name',
      header: 'Candidate',
      cell: (c) => (
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.party?.color || 'var(--color-line-strong)' }} aria-hidden />
          <span className="font-medium text-ink">{c.name}</span>
          {c.is_incumbent && <Badge tone="warn">Incumbent</Badge>}
        </div>
      ),
    },
    { key: 'party', header: 'Party', cell: (c) => <Badge tone="muted">{c.party?.abbreviation || c.party_id || 'IND'}</Badge> },
    { key: 'age', header: 'Age', className: 'tabular-nums text-ink-2', cell: (c) => c.age ?? '–' },
    {
      key: 'cases',
      header: 'Cases',
      className: 'tabular-nums',
      // Unknown (null) is a dash, never 0.
      cell: (c) => c.criminal_cases === null || c.criminal_cases === undefined
        ? <span className="text-ink-2">–</span>
        : <span className={c.criminal_cases > 0 ? 'font-medium text-bad-text' : 'text-ink-2'}>{c.criminal_cases}</span>,
    },
  ];

  const subtitle = [election ? shortElectionName(election.name, election.type, election.year) : null, seat ? `${seat.const_no} ${seat.name}` : null]
    .filter(Boolean).join(' · ');

  return (
    <>
      <EntityPage
        header={
          <PageHeader
            title="Candidates"
            count={m.counts.all}
            subtitle={subtitle}
            actions={
              <span title={archived ? ARCHIVED_HINT : undefined}>
                <Button variant="primary" disabled={archived} onClick={() => route.open(NEW_ID)}><Plus size={16} aria-hidden />New candidate</Button>
              </span>
            }
          />
        }
        toolbar={
          <Toolbar>
            <Combobox label="Seat" className="w-64" options={seatOptions} value={m.selectedConst} onChange={m.setSelectedConst} placeholder="Find a seat…" />
            <SearchInput label="Search names in this seat" placeholder="Search names in this seat…" value={m.search} onChange={m.setSearch} />
          </Toolbar>
        }
        table={
          <DataTable
            label="Candidates"
            columns={columns}
            rows={m.candidates}
            rowKey={(c) => c.id}
            onRowClick={(c) => route.open(c.id)}
            loading={m.loading || m.seatsLoading}
            empty={m.error
              ? <EmptyState
                  title={m.error === 'seats' ? 'Could not load seats' : 'Could not load candidates'}
                  description="Check the connection and try again."
                  action={<Button variant="outline" size="sm" onClick={() => { void m.refresh(); }}>Try again</Button>}
                />
              : m.constituencies.length === 0
                ? <EmptyState title="No seats in this election" description="Add constituencies to this election first." />
                : <EmptyState title="No candidates match" description="Try another seat or name." />}
          />
        }
      />
      {route.isNew && (archived
        ? <CandidateCreateArchived onClose={() => route.close()} />
        : (
          <CandidateCreateDialog
            electionId={electionId}
            seats={m.constituencies}
            defaultSeat={m.selectedConst}
            saving={m.creating}
            onCreate={create}
            onClose={() => route.close()}
          />
        ))}
    </>
  );
}
