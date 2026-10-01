import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useElection } from '../context/ElectionContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { useCandidateManager, type NewCandidate, type PersonFilter } from '../hooks/useCandidateManager';
import { NEW_ID, useEntityRoute } from '../hooks/useEntityRoute';
import { shortElectionName } from '../components/shell/ElectionPicker';
import { EntityPage } from '../components/entity/EntityPage';
import { NoElection } from '../components/entity/NoElection';
import { CandidatePanel } from '../components/entity/candidates/CandidatePanel';
import { CandidateCreatePanel } from '../components/entity/candidates/CandidateCreatePanel';
import { PageHeader } from '../components/ui/PageHeader';
import { ChipGroup, SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Combobox } from '../components/ui/Combobox';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import type { Candidate } from '../types';

type Meta = { age?: number | string | null; criminal_cases?: number | string | null };
const meta = (c: Candidate) => (c.metadata ?? {}) as Meta;

/** PAGE: Candidates — one seat of the global election at a time; candidate panel at /candidates/:id (create at /candidates/new). */
export default function Candidates() {
  const { electionId, election, loading: electionsLoading, error } = useElection();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/candidates', editorDirty);
  const m = useCandidateManager(electionId);
  const [opened, setOpened] = useState<Candidate | null>(null);

  // Deep link / ⌘K: show the opened candidate's seat — only when the record (or election) changes,
  // so picking another seat afterwards is not undone.
  // Only the record whose panel is open counts: a closed panel must not move the seat on a later election switch.
  const current = opened && opened.id === route.id ? opened : null;
  useEffect(() => {
    if (current && current.election_id === electionId && current.const_id !== m.selectedConst) m.setSelectedConst(current.const_id);
  }, [current?.id, electionId]);

  const seatOptions = useMemo(
    () => m.constituencies.map((c) => ({ value: c.id, label: `${c.const_no} ${c.name}`, hint: c.type })),
    [m.constituencies],
  );
  const seat = m.constituencies.find((c) => c.id === m.selectedConst);

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
    { key: 'age', header: 'Age', className: 'tabular-nums text-ink-2', cell: (c) => meta(c).age ?? '–' },
    {
      key: 'cases',
      header: 'Cases',
      className: 'tabular-nums',
      cell: (c) => {
        const n = Number(meta(c).criminal_cases ?? 0);
        return <span className={n > 0 ? 'font-medium text-bad-text' : 'text-ink-2'}>{n}</span>;
      },
    },
    {
      key: 'person',
      header: 'Person',
      cell: (c) => c.person_id
        ? <Badge tone="ok">Linked</Badge>
        : m.linkingSuggestions.has(c.id) ? <Badge tone="accent">Suggestion</Badge> : <Badge tone="muted">Unlinked</Badge>,
    },
  ];

  const subtitle = [election ? shortElectionName(election.name, election.type, election.year) : null, seat ? `${seat.const_no} ${seat.name}` : null]
    .filter(Boolean).join(' · ');

  return (
    <EntityPage
      header={
        <PageHeader
          title="Candidates"
          count={m.counts.all}
          subtitle={subtitle}
          actions={<Button variant="primary" onClick={() => route.open(NEW_ID)}><Plus size={16} aria-hidden />New candidate</Button>}
        />
      }
      toolbar={
        <Toolbar>
          <Combobox label="Seat" className="w-64" options={seatOptions} value={m.selectedConst} onChange={m.setSelectedConst} placeholder="Find a seat…" />
          <ChipGroup<PersonFilter>
            label="Person link"
            value={m.personFilter}
            onChange={m.setPersonFilter}
            options={[
              { value: 'all', label: 'All', count: m.counts.all },
              { value: 'linked', label: 'Linked', count: m.counts.linked },
              { value: 'unlinked', label: 'Unlinked', count: m.counts.unlinked },
            ]}
          />
          <SearchInput label="Search names in this seat" placeholder="Search names in this seat…" value={m.search} onChange={m.setSearch} />
        </Toolbar>
      }
      table={
        <DataTable
          label="Candidates"
          columns={columns}
          rows={m.candidates}
          rowKey={(c) => c.id}
          selectedKey={route.id}
          onRowClick={(c) => route.open(c.id)}
          loading={m.loading || m.seatsLoading}
          empty={m.constituencies.length === 0
            ? <EmptyState title="No seats in this election" description="Add constituencies to this election first." />
            : <EmptyState title="No candidates match" description="Try another seat, filter or name." />}
        />
      }
      panel={!route.id ? null : route.isNew ? (
        <CandidateCreatePanel
          electionId={electionId}
          seats={m.constituencies}
          defaultSeat={m.selectedConst}
          saving={m.creating}
          onCreate={create}
          onClose={() => route.close()}
        />
      ) : (
        <CandidatePanel
          key={route.id}
          id={route.id}
          suggestion={m.linkingSuggestions.get(route.id)}
          selectedMatches={m.selectedMatches.get(route.id)}
          onToggleMatch={m.toggleMatch}
          onLinkSuggested={m.handleLink}
          onLoaded={setOpened}
          onChanged={m.refresh}
          onClose={() => route.close()}
        />
      )}
    />
  );
}
