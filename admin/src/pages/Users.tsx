import { Plus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useShellStatus } from '../context/ShellStatusContext';
import { NEW_ID, useEntityRoute } from '../hooks/useEntityRoute';
import { roleLabel, useUserManager, USER_LIST_CAP } from '../hooks/useUserManager';
import { EntityPage } from '../components/entity/EntityPage';
import { UserPanel } from '../components/entity/users/UserPanel';
import { UserCreatePanel } from '../components/entity/users/UserCreatePanel';
import { PageHeader } from '../components/ui/PageHeader';
import { SearchInput, Toolbar } from '../components/ui/Toolbar';
import { DataTable, type Column } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge, type Tone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { formatIstDate } from '../utils/time';
import type { User } from '../types';

const ROLE_TONE: Record<User['role'], Tone> = { SUPER_ADMIN: 'accent', EDITOR: 'ok', VIEWER: 'muted' };

/** PAGE: Users (SUPER_ADMIN) — accounts table + panel at /users/:id, create at /users/new. */
export default function Users() {
  const { user: me } = useAuth();
  const { editorDirty } = useShellStatus();
  const route = useEntityRoute('/users', editorDirty);
  const m = useUserManager();
  const id = route.id;
  const selected = id && !route.isNew ? m.users.find((u) => u.id === id) ?? null : null;

  const columns: Column<User>[] = [
    {
      key: 'user', header: 'User',
      cell: (u) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-ink">{u.name}</span>
            {u.id === me?.id && <Badge tone="muted">You</Badge>}
          </div>
          <div className="truncate text-xs text-muted">{u.email}</div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', cell: (u) => <Badge tone={ROLE_TONE[u.role]}>{roleLabel(u.role)}</Badge> },
    { key: 'created', header: 'Created', className: 'whitespace-nowrap text-xs text-ink-2', cell: (u) => (u.created_at ? formatIstDate(u.created_at) : '—') },
  ];

  const panel = !id ? null : route.isNew ? (
    <UserCreatePanel saving={m.saving} onCreate={m.create} onCreated={(u) => route.open(u.id, { force: true })} onClose={() => route.close()} />
  ) : (
    <UserPanel
      key={id}
      user={selected}
      isSelf={id === me?.id}
      listLoading={m.loading}
      listError={m.error}
      saving={m.saving}
      onRetry={() => { void m.reload(); }}
      onClose={() => route.close()}
      onSave={(data) => m.update(id, data)}
      onDelete={() => m.remove(id)}
      onDeleted={() => route.close({ force: true })}
    />
  );

  return (
    <EntityPage
      header={
        <PageHeader
          title="Users"
          count={m.users.length}
          subtitle="Who can sign in to the admin panel"
          actions={<Button variant="primary" onClick={() => route.open(NEW_ID)}><Plus size={16} aria-hidden />New user</Button>}
        />
      }
      toolbar={
        <Toolbar>
          <SearchInput label="Search users" placeholder="Search by name or email…" value={m.search} onChange={m.setSearch} />
          {m.capped && <span className="text-xs text-muted">Showing first {USER_LIST_CAP}</span>}
        </Toolbar>
      }
      table={
        <DataTable
          label="Users"
          columns={columns}
          rows={m.visible}
          rowKey={(u) => u.id}
          selectedKey={id}
          onRowClick={(u) => route.open(u.id)}
          loading={m.loading}
          empty={m.error
            ? <EmptyState title="Could not load users" description={m.error} action={<Button variant="outline" size="sm" onClick={() => { void m.reload(); }}>Try again</Button>} />
            : m.users.length === 0
              ? <EmptyState title="No users yet" description="Create the first account with New user." />
              : <EmptyState title="No users match" description="Try a different name or email." />}
        />
      }
      panel={panel}
    />
  );
}
