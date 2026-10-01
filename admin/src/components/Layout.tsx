import { Outlet } from 'react-router-dom';
import { ElectionProvider } from '../context/ElectionContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { Sidebar } from './shell/Sidebar';
import { TopBar } from './shell/TopBar';

/** VIEW: admin shell — grouped sidebar, top bar with global election picker, page outlet. Pages scroll themselves. */
export default function Layout() {
  return (
    <ElectionProvider>
      <ShellStatusProvider>
        <div className="flex h-screen bg-page font-sans text-ink">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-h-0 flex-1 overflow-hidden">
              <Outlet />
            </main>
          </div>
        </div>
      </ShellStatusProvider>
    </ElectionProvider>
  );
}
