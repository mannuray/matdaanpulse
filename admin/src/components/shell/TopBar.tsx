import * as Menu from '@radix-ui/react-dropdown-menu';
import { useAuth } from '../../context/AuthContext';
import { useShellStatus } from '../../context/ShellStatusContext';
import { ElectionPicker } from './ElectionPicker';
import { HealthDot } from './HealthDot';
import { ShortcutsDialog } from './ShortcutsDialog';
import { cn } from '../ui/cn';

const LIVE_PILL = {
  open: { text: 'Live updates on', cls: 'bg-ok-soft text-ok-text border-ok/30', dot: 'bg-ok' },
  connecting: { text: 'Connecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
  reconnecting: { text: 'Reconnecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
} as const;

export function TopBar() {
  const { user, logout, hasRole } = useAuth();
  const { live } = useShellStatus();
  const initials = (user?.name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const pill = live === 'idle' ? null : LIVE_PILL[live];

  return (
    <header className="tw-ui sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-card px-6">
      <div className="flex items-center gap-3">
        <ElectionPicker />
      </div>
      <div className="flex items-center gap-3 whitespace-nowrap">
        {pill && (
          <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium', pill.cls)}>
            <span className={cn('h-2 w-2 rounded-full', pill.dot)} aria-hidden />{pill.text}
          </span>
        )}
        <HealthDot canOpenStatus={hasRole('SUPER_ADMIN')} />
        <ShortcutsDialog />
        <Menu.Root>
          <Menu.Trigger className="flex items-center gap-2 rounded-control px-1.5 py-1 hover:bg-subtle">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar text-[11px] font-semibold text-white">{initials}</span>
            <span className="text-xs font-medium text-ink">{user?.name}</span>
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Content align="end" sideOffset={6} className="tw-ui z-50 min-w-44 rounded-card border border-line bg-card p-1 shadow-lg">
              <div className="px-2.5 py-1.5 text-[11px] text-muted">{user?.role.replace('_', ' ').toLowerCase()}</div>
              <Menu.Item onSelect={logout} className="cursor-pointer rounded-control px-2.5 py-1.5 text-sm text-ink outline-none data-[highlighted]:bg-subtle">
                Log out
              </Menu.Item>
            </Menu.Content>
          </Menu.Portal>
        </Menu.Root>
      </div>
    </header>
  );
}
