import { Plus } from 'lucide-react';
import { useUnsavedEdits } from '../context/UnsavedEditsContext';
import { usePartyManager } from '../hooks/usePartyManager';
import { NEW_ID, useEntityRoute } from '../hooks/useEntityRoute';
import { EntityPage } from '../components/entity/EntityPage';
import { PartyRecord } from '../components/entity/parties/PartyRecord';
import { PartyCreateDialog, type NewParty } from '../components/entity/parties/PartyCreateDialog';
import { ECI_RECOGNITIONS, EciRecognitionBadge, type EciFilter } from '../components/entity/parties/eciRecognition';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { Select } from '../components/ui/Input';
import { DataTable, type Column } from '../components/ui/DataTable';
import { Pager } from '../components/ui/Pager';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { assetUrl } from '../utils/asset-url';
import type { Party } from '../types';

type PartyRow = Party & { candidate_count?: number };
type SymbolFilter = 'all' | 'has_logo' | 'has_eci' | 'missing';
const PAGE_SIZE = 25;

const COLUMNS: Column<PartyRow>[] = [
  {
    key: 'party',
    header: 'Party',
    cell: (p) => (
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control border border-line text-[10px] font-semibold text-white" style={{ background: p.color || 'var(--color-muted)' }}>
          {p.abbreviation || p.id.slice(0, 3)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium text-ink">{p.name}</div>
          <div className="font-mono text-[11px] text-muted">{p.id}</div>
        </div>
      </div>
    ),
  },
  { key: 'candidates', header: 'Candidates', className: 'tabular-nums text-ink-2', cell: (p) => (p.candidate_count ?? 0).toLocaleString('en-IN') },
  {
    key: 'symbol',
    header: 'Symbol',
    cell: (p) => (p.symbol_url || p.eci_symbol_url)
      ? <img src={assetUrl(p.symbol_url || p.eci_symbol_url || '')} alt="" className="h-6 w-6 object-contain" />
      : <Badge tone="warn">Missing</Badge>,
  },
  {
    key: 'eci',
    header: 'ECI recognition',
    cell: (p) => (p.eci_recognition ? <EciRecognitionBadge value={p.eci_recognition} /> : <span className="text-muted">–</span>),
  },
];

/**
 * PAGE: Parties — full-width registry table; a row opens the party's record page at /parties/:id, which replaces the
 * list (create at /parties/new, in a dialog over the list). The list hooks stay mounted under `parties/*`, so its search,
 * filters and page survive the round trip to a record.
 */
export default function Parties() {
  const { editorDirty } = useUnsavedEdits();
  const route = useEntityRoute('/parties', editorDirty);
  const list = usePartyManager();
  const rows = list.items as PartyRow[];

  const create = async (data: NewParty) => {
    const created = await list.handleCreate(data);
    if (created) route.open(created.id, { force: true });
  };

  if (route.id && !route.isNew) {
    return <PartyRecord key={route.id} id={route.id} onBack={() => route.close()} onSaved={list.refresh} />;
  }

  return (
    <>
      <EntityPage
        header={
          <PageHeader
            title="Parties"
            count={list.total}
            subtitle="Registry, colours and symbols"
            actions={<Button variant="primary" onClick={() => route.open(NEW_ID)}><Plus size={16} aria-hidden />New party</Button>}
          />
        }
        toolbar={
          <Toolbar>
            <SearchInput label="Search parties" placeholder="Search by name or ID…" value={list.search} onChange={list.handleSearch} />
            <Select aria-label="State" className="w-44" value={String(list.filters.stateId)} onChange={(e) => list.updateFilters({ stateId: e.target.value ? Number(e.target.value) : '' })}>
              <option value="">All states</option>
              {list.states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
            <Select aria-label="ECI recognition" className="w-44" value={list.filters.eci} onChange={(e) => list.updateFilters({ eci: e.target.value as EciFilter })}>
              <option value="all">All recognition</option>
              {ECI_RECOGNITIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              <option value="none">Not set</option>
            </Select>
            <Select aria-label="Symbol (this page)" className="w-48" value={list.filters.symbol} onChange={(e) => list.updateFilters({ symbol: e.target.value as SymbolFilter })}>
              <option value="all">All symbols</option>
              <option value="has_logo">Has logo</option>
              <option value="has_eci">Has ECI symbol</option>
              <option value="missing">Missing symbol</option>
            </Select>
          </Toolbar>
        }
        table={
          <DataTable
            label="Parties"
            columns={COLUMNS}
            rows={rows}
            rowKey={(p) => p.id}
            onRowClick={(p) => route.open(p.id)}
            loading={list.loading}
            empty={list.error
              ? <EmptyState title="Could not load parties" description={list.error} />
              : <EmptyState title="No parties match" description="Try a different search or filter." />}
            footer={
              <Pager
                page={list.page} totalPages={list.totalPages} total={list.total} pageSize={PAGE_SIZE} noun="parties" onPage={list.loadPage}
                note={list.filters.symbol !== 'all' ? 'symbol filter applies to this page' : undefined}
              />
            }
          />
        }
      />
      {route.isNew && <PartyCreateDialog saving={list.saving} onCreate={create} onClose={() => route.close()} />}
    </>
  );
}
