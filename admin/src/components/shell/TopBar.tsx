import { useEffect, useState } from 'react';
import * as Menu from '@radix-ui/react-dropdown-menu';
import { Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useShellStatus } from '../../context/ShellStatusContext';
import { ElectionPicker } from './ElectionPicker';
import { HealthDot } from './HealthDot';
import { ShortcutsDialog } from './ShortcutsDialog';
import { CommandPalette } from './CommandPalette';
import { Kbd } from '../ui/Kbd';
import { cn } from '../ui/cn';

const LIVE_PILL = {
  open: { text: 'Live updates on', cls: 'bg-ok-soft text-ok-text border-ok/30', dot: 'bg-ok' },
  connecting: { text: 'Connecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
  reconnecting: { text: 'Reconnecting…', cls: 'bg-warn-soft text-warn-text border-warn/30', dot: 'bg-warn' },
} as const;

const isMac = () => typeof navigator !== 'undefined'
  && /mac/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? '');

export function TopBar() {
  const { user, logout, hasRole } = useAuth();
  const { live } = useShellStatus();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const initials = (user?.name ?? '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const pill = live === 'idle' ? null : LIVE_PILL[live];

  // ⌘K (macOS) / Ctrl+K anywhere opens the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.shiftKey || e.altKey || e.repeat || e.isComposing) return;
      if ((isMac() ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="tw-ui sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b border-line bg-card px-6">
      <div className="flex items-center gap-3">
        <ElectionPicker />
        <button
          type="button"
          aria-label="Search (⌘K)"
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 w-72 items-center gap-2 rounded-control border border-line bg-subtle px-2.5 text-xs text-muted hover:border-line-strong"
        >
          <Search size={14} aria-hidden />
          <span className="flex-1 text-left">Search seats, candidates…</span>
          <Kbd>⌘K</Kbd>
        </button>
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
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </header>
  );
}
