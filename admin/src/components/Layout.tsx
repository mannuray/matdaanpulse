import { Outlet, useLocation } from 'react-router-dom';
import { ElectionProvider } from '../context/ElectionContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { Sidebar } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';

/** Rebuilt pages manage their own padding and scrolling; legacy pages keep `.admin-content` until they migrate. Each page task appends its path. */
export const BARE_PATHS: string[] = ['/overrides', '/parties', '/elections', '/persons', '/candidates', '/constituencies', '/manifests', '/', '/feedback', '/users'];
/** Exact path or a sub-path. '/' is exact only: its sub-path prefix would be '//'. */
export const isBare = (pathname: string) => BARE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** VIEW: admin shell — grouped sidebar, top bar with global election picker, page outlet. */
export default function Layout() {
  const bare = isBare(useLocation().pathname);
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
