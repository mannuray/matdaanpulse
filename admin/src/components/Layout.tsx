import { Outlet, useLocation } from 'react-router-dom';
import { ElectionProvider } from '../context/ElectionContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { Sidebar } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';

/** VIEW: admin shell — grouped sidebar, top bar with global election picker, page outlet. */
export default function Layout() {
  // Rebuilt pages manage their own padding; legacy pages keep `.admin-content` padding until they migrate.
  const bare = useLocation().pathname.startsWith('/overrides');
  return (
    <ElectionProvider>
      <ShellStatusProvider>
        <div className="flex h-screen bg-page font-sans text-ink">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className={bare ? 'min-h-0 flex-1 overflow-hidden' : 'admin-content min-h-0 max-h-none flex-1 overflow-y-auto'}>
              <Outlet />
            </main>
          </div>
        </div>
      </ShellStatusProvider>
    </ElectionProvider>
  );
}
