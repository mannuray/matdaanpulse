import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { createIngestKey, getIngestKeys, revokeIngestKey } from '../services/ingest.service';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { useElection } from '../context/ElectionContext';
import { Field } from '../components/ui/Field';
import { FormDialog } from '../components/ui/FormDialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { formatIst, timeAgo } from '../utils/time';
import type { IngestKeyRow } from '../types';

/** Expiry presets in days (the API allows up to 90). A key made at T-7 must outlast counting day: pick 14 or more then. */
const EXPIRY_DAYS = [1, 7, 14, 30, 60, 90];
const DEFAULT_EXPIRY_DAYS = 7;
const isExpired = (k: IngestKeyRow, now = Date.now()) => !!k.expires_at && new Date(k.expires_at).getTime() <= now;

/** PAGE: Ingest keys (SUPER_ADMIN) — machine keys the ingest jobs authenticate with; each is for one election and expires. */
export default function IngestKeys() {
  const { toast, toastError } = useToast();
  const { elections, electionId: selectedElection } = useElection();
  const [electionId, setElectionId] = useState('');
  const [days, setDays] = useState(DEFAULT_EXPIRY_DAYS);
  const [rows, setRows] = useState<IngestKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<IngestKeyRow | null>(null);

  const load = useCallback(async () => {
    try { setRows(await getIngestKeys()); setError(null); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openCreate = () => { setElectionId(selectedElection); setDays(DEFAULT_EXPIRY_DAYS); setCreating(true); };
  const closeCreate = () => { setCreating(false); setSecret(null); setName(''); };
  const create = async () => {
    if (!name.trim() || !electionId || busy) return;
    setBusy(true);
    try {
      const res = await createIngestKey(name.trim(), electionId, new Date(Date.now() + days * 86_400_000).toISOString());
      setSecret(res.key);
      setRows(r => [res.row, ...r]);
    } catch (e) { toastError(e, 'Could not create the key'); } finally { setBusy(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(secret ?? ''); toast('Key copied'); } catch { toast('Could not copy: select the key and copy it by hand'); }
  };
  const revoke = async () => {
    const k = revoking; setRevoking(null);
    if (!k) return;
    try { await revokeIngestKey(k.id); toast(`Key ${k.name} revoked`); await load(); }
    catch (e) { toastError(e, 'Could not revoke the key'); }
  };

  const columns: Column<IngestKeyRow>[] = [
    { key: 'name', header: 'Name', cell: k => <span className="font-medium text-ink">{k.name}</span> },
    { key: 'election', header: 'Election', className: 'text-ink-2', cell: k => (k.election_id ? elections.find(e => e.id === k.election_id)?.name ?? k.election_id : 'Any (legacy)') },
    { key: 'expires', header: 'Expires', className: 'text-ink-2', cell: k => (k.expires_at ? formatIst(k.expires_at) : 'no expiry') },
    { key: 'created', header: 'Created', className: 'text-ink-2', cell: k => formatIst(k.created_at) },
    { key: 'used', header: 'Last used', className: 'text-ink-2', cell: k => (k.last_used_at ? timeAgo(k.last_used_at) : 'never') },
    { key: 'status', header: 'Status', cell: k => (k.revoked_at ? <Badge tone="muted">revoked</Badge> : isExpired(k) ? <Badge tone="muted">expired</Badge> : <Badge tone="ok">active</Badge>) },
    { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', cell: k => (k.revoked_at || isExpired(k) ? null : <Button size="sm" variant="danger" onClick={() => setRevoking(k)}>Revoke</Button>) },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <PageHeader title="Ingest keys" count={rows.length} subtitle="Machine keys for the live-ingest jobs"
        actions={<Button variant="primary" onClick={openCreate}><Plus size={16} aria-hidden />New key</Button>} />
      <DataTable label="Ingest keys" columns={columns} rows={rows} rowKey={k => k.id} loading={loading}
        empty={error
          ? <EmptyState title="Could not load keys" description={error} action={<Button variant="outline" size="sm" onClick={() => { void load(); }}>Try again</Button>} />
          : <EmptyState title="No keys yet" description="Create one with New key." />} />
      <FormDialog open={creating} onRequestClose={closeCreate} title={secret ? 'Key created' : 'New key'}
        footer={secret
          ? <><span /><Button variant="primary" onClick={closeCreate}>Done</Button></>
          : <><span /><div className="flex gap-2"><Button variant="outline" onClick={closeCreate}>Cancel</Button><Button variant="primary" disabled={!name.trim() || !electionId || busy} onClick={() => { void create(); }}>Create</Button></div></>}>
        {secret ? (
          <div className="space-y-3">
            <Field label="New key value">
              <Input readOnly value={secret} onFocus={e => e.currentTarget.select()} className="font-mono" />
            </Field>
            <Button variant="outline" size="sm" onClick={() => { void copy(); }}>Copy</Button>
            <p className="text-sm text-warn-text">Copy it now: it will not be shown again.</p>
          </div>
        ) : (
          <form onSubmit={e => { e.preventDefault(); void create(); }}>
            <div className="space-y-3">
              <Field label="Key name" hint="Election and host, e.g. as2026-cloud-1 (names are unique across elections)">
                <Input value={name} onChange={e => setName(e.target.value)} />
              </Field>
              <Field label="Election" hint="The key can post only to this election">
                <Select value={electionId} onChange={e => setElectionId(e.target.value)}>
                  {!electionId && <option value="">Choose an election</option>}
                  {elections.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </Select>
              </Field>
              <Field label="Expires after" hint="Must outlast counting day; revoke the key when counting is over">
                <Select value={String(days)} onChange={e => setDays(Number(e.target.value))}>
                  {EXPIRY_DAYS.map(d => <option key={d} value={d}>{d === 1 ? '1 day' : `${d} days`}</option>)}
                </Select>
              </Field>
            </div>
          </form>
        )}
      </FormDialog>
      <ConfirmDialog open={!!revoking} title="Revoke key" tone="danger" confirmLabel="Revoke key"
        description={`Revoke key ${revoking?.name ?? ''}? Jobs using it stop at their next request.`}
        onCancel={() => setRevoking(null)} onConfirm={() => { void revoke(); }} />
    </div>
  );
}
