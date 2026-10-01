import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from '../context/ToastContext';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { ElectionProvider } from '../context/ElectionContext';
import { EditRedirect } from '../components/routing/EditRedirect';
import { Sidebar } from '../components/shell/Sidebar';
import { ElectionPicker } from '../components/shell/ElectionPicker';

/** Prints the current path + query (data-testid="where"). */
export function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

interface HarnessOptions {
  /**
   * Also mount the real ElectionProvider, Sidebar and ElectionPicker (for pages that read the global election, and for
   * the unsaved guard on shell navigation). The test must mock `useAuth` and `getElections`.
   */
  shell?: boolean;
}

/** Mounts an entity page exactly like App.tsx: `${base}/*` plus the `${base}/:id/edit` redirect. */
export function renderEntityPage(base: string, page: ReactElement, at: string, { shell = false }: HarnessOptions = {}) {
  const routes = (
    <>
      <Routes>
        <Route path={`${base}/:id/edit`} element={<EditRedirect base={base} />} />
        <Route path={`${base}/*`} element={page} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </>
  );
  return render(
    <ToastProvider>
      <ShellStatusProvider>
        <MemoryRouter initialEntries={[at]}>
          {shell
            ? <ElectionProvider><Sidebar /><ElectionPicker />{routes}</ElectionProvider>
            : routes}
        </MemoryRouter>
      </ShellStatusProvider>
    </ToastProvider>,
  );
}
