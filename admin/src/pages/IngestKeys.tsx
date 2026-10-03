import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { createIngestKey, getIngestKeys, revokeIngestKey } from '../services/ingest.service';
import { PageHeader } from '../components/ui/PageHeader';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Field } from '../components/ui/Field';
import { FormDialog } from '../components/ui/FormDialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { formatIst, timeAgo } from '../utils/time';
import type { IngestKeyRow } from '../types';

/** PAGE: Ingest keys (SUPER_ADMIN) — machine keys the ingest jobs authenticate with. */
export default function IngestKeys() {
  const { toast, toastError } = useToast();
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

  const closeCreate = () => { setCreating(false); setSecret(null); setName(''); };
  const create = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      const res = await createIngestKey(name.trim());
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
    { key: 'created', header: 'Created', className: 'text-ink-2', cell: k => formatIst(k.created_at) },
    { key: 'used', header: 'Last used', className: 'text-ink-2', cell: k => (k.last_used_at ? timeAgo(k.last_used_at) : 'never') },
    { key: 'status', header: 'Status', cell: k => (k.revoked_at ? <Badge tone="muted">revoked</Badge> : <Badge tone="ok">active</Badge>) },
    { key: 'actions', header: <span className="sr-only">Actions</span>, className: 'text-right', cell: k => (k.revoked_at ? null : <Button size="sm" variant="danger" onClick={() => setRevoking(k)}>Revoke</Button>) },
  ];

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-6">
      <PageHeader title="Ingest keys" count={rows.length} subtitle="Machine keys for the live-ingest jobs"
        actions={<Button variant="primary" onClick={() => setCreating(true)}><Plus size={16} aria-hidden />New key</Button>} />
      <DataTable label="Ingest keys" columns={columns} rows={rows} rowKey={k => k.id} loading={loading}
        empty={error
          ? <EmptyState title="Could not load keys" description={error} action={<Button variant="outline" size="sm" onClick={() => { void load(); }}>Try again</Button>} />
          : <EmptyState title="No keys yet" description="Create one with New key." />} />
      <FormDialog open={creating} onRequestClose={closeCreate} title={secret ? 'Key created' : 'New key'}
        footer={secret
          ? <><span /><Button variant="primary" onClick={closeCreate}>Done</Button></>
          : <><span /><div className="flex gap-2"><Button variant="outline" onClick={closeCreate}>Cancel</Button><Button variant="primary" disabled={!name.trim() || busy} onClick={() => { void create(); }}>Create</Button></div></>}>
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
            <Field label="Key name" hint="Who or what uses it, e.g. worker-sg">
              <Input value={name} onChange={e => setName(e.target.value)} />
            </Field>
          </form>
        )}
      </FormDialog>
      <ConfirmDialog open={!!revoking} title="Revoke key" tone="danger" confirmLabel="Revoke key"
        description={`Revoke key ${revoking?.name ?? ''}? Jobs using it stop at their next request.`}
        onCancel={() => setRevoking(null)} onConfirm={() => { void revoke(); }} />
    </div>
  );
}
