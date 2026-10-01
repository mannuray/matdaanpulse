import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { confirmDiscardEdits, useShellStatus } from '../../context/ShellStatusContext';
import { NAV_GROUPS } from '../../utils/navigation.config';
import { cn } from '../ui/cn';

export function Sidebar() {
  const { hasRole } = useAuth();
  const { pathname } = useLocation();
  const { editorDirty } = useShellStatus();
  const isActive = (path: string) => (path === '/' ? pathname === '/' : pathname.startsWith(path));

  return (
    <aside className="tw-ui flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-ink">
      <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
        <img src="/logo-mark.png" alt="" aria-hidden className="h-8 w-8 rounded-control" />
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">MatdaanPulse Admin</div>
          <div className="text-[11px] text-muted">Election results hub</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((i) => i.roles.length === 0 || i.roles.some((r) => hasRole(r)));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              <div className="px-3 pb-1.5 text-[11px] font-medium text-muted">{group.label}</div>
              {items.map(({ path, label, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  aria-current={isActive(path) ? 'page' : undefined}
                  // BrowserRouter has no useBlocker: ask here before an editor unmounts with unsaved edits.
                  // Compare the exact path: "Parties" while on /parties/BJP closes that record, so it asks too.
                  onClick={(e) => { if (pathname !== path && !confirmDiscardEdits(editorDirty)) e.preventDefault(); }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-control px-3 py-2 text-sm transition-colors',
                    isActive(path) ? 'bg-accent text-white' : 'hover:bg-white/5 hover:text-white',
                  )}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                </Link>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
